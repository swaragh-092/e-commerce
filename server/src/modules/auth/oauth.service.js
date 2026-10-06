'use strict';

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const crypto = require('crypto');
const { sequelize, User, RefreshToken, Role, Permission } = require('../index');
const { enrichUserAuthorization } = require('../../config/permissions');
const { AUTH_TIME } = require('../../config/constants');
const { hashToken, generateTokens, signTempTwoFactorToken } = require('./tokenUtils');

const authUserInclude = [
  { model: Role, as: 'roles', through: { attributes: [] }, include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }] },
];

const initializeGoogleStrategy = () => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return;

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/google/callback`,
    passReqToCallback: true,
  }, async (req, _accessToken, _refreshToken, profile, done) => {
    try {
      const result = await findOrCreateOAuthUser(profile, req.ip);
      done(null, result);
    } catch (err) {
      done(err);
    }
  }));

  passport.serializeUser((data, done) => done(null, data));
  passport.deserializeUser((data, done) => done(null, data));
};

const findOrCreateOAuthUser = async (profile, clientIp) => {
  const rawEmail = profile.emails?.[0]?.value;
  const emailIsVerified = profile.emails?.[0]?.verified === true
    || profile._json?.email_verified === true;
  if (!rawEmail || !emailIsVerified) {
    throw new Error('Google did not return a verified email address');
  }
  const email = String(rawEmail).trim().toLowerCase();

  return sequelize.transaction(async (t) => {
    let user = await User.findOne({
      where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), email),
      transaction: t,
    });
    if (!user) {
      user = await User.create({
        email,
        firstName: String(profile.name?.givenName || profile.displayName || 'User').trim().slice(0, 100),
        lastName: String(profile.name?.familyName || '').trim().slice(0, 100),
        password: crypto.randomBytes(32).toString('hex'),
        role: 'customer',
        status: 'active',
        emailVerified: true,
      }, { transaction: t });

      const customerRole = await Role.findOne({ where: { slug: 'customer' }, transaction: t });
      if (!customerRole) throw new Error('System error: customer role not found');
      await user.setRoles([customerRole], { transaction: t });
    } else if (user.status !== 'active') {
      throw new Error('Account is inactive');
    } else {
      if (user.email !== email) {
        await user.update({ email }, { transaction: t });
        user.email = email;
      }
    }

    // Check if 2FA is enabled — return temp token instead of full auth
    if (user.twoFactorEnabled) {
      return { requiresTwoFactor: true, tempToken: signTempTwoFactorToken(user.id) };
    }

    const sessionId = crypto.randomUUID();
    const tokens = generateTokens(user, sessionId);
    await RefreshToken.create({
      id: sessionId,
      userId: user.id,
      token: hashToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + AUTH_TIME.REFRESH_TOKEN_TTL_MS),
      createdByIp: clientIp || 'oauth-google',
    }, { transaction: t });

    await user.update({ lastLoginAt: new Date(), emailVerified: true }, { transaction: t });

    const userData = await User.findByPk(user.id, { include: authUserInclude, transaction: t });
    return { user: enrichUserAuthorization(userData), tokens };
  });
};

module.exports = { initializeGoogleStrategy, findOrCreateOAuthUser };
