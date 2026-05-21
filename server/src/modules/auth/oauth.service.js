'use strict';

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sequelize, User, RefreshToken, Role, Permission } = require('../index');
const { enrichUserAuthorization } = require('../../config/permissions');
const { AUTH_TIME } = require('../../config/constants');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateTokens = (user) => {
  const payload = { id: user.id, role: user.role };
  return {
    accessToken: jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }),
    refreshToken: jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }),
  };
};

const authUserInclude = [
  { model: Role, as: 'roles', through: { attributes: [] }, include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }] },
];

const initializeGoogleStrategy = () => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return;

  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.SERVER_URL || 'http://localhost:5000'}/api/auth/google/callback`,
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const result = await findOrCreateOAuthUser(profile);
      done(null, result);
    } catch (err) {
      done(err);
    }
  }));

  passport.serializeUser((data, done) => done(null, data));
  passport.deserializeUser((data, done) => done(null, data));
};

const findOrCreateOAuthUser = async (profile) => {
  const email = profile.emails?.[0]?.value;
  if (!email) throw new Error('No email returned from Google');

  return sequelize.transaction(async (t) => {
    let user = await User.findOne({ where: { email }, transaction: t });

    if (!user) {
      user = await User.create({
        email,
        firstName: profile.name?.givenName || profile.displayName || 'User',
        lastName: profile.name?.familyName || '',
        password: crypto.randomBytes(32).toString('hex'),
        role: 'customer',
        status: 'active',
        emailVerified: true,
      }, { transaction: t });

      const customerRole = await Role.findOne({ where: { slug: 'customer' }, transaction: t });
      if (customerRole) await user.setRoles([customerRole], { transaction: t });
    } else if (user.status !== 'active') {
      throw new Error('Account is inactive');
    }

    const tokens = generateTokens(user);
    await RefreshToken.create({
      userId: user.id,
      token: hashToken(tokens.refreshToken),
      expiresAt: new Date(Date.now() + AUTH_TIME.REFRESH_TOKEN_TTL_MS),
      createdByIp: 'oauth-google',
    }, { transaction: t });

    await user.update({ lastLoginAt: new Date(), emailVerified: true }, { transaction: t });

    const userData = await User.findByPk(user.id, { include: authUserInclude, transaction: t });
    return { user: enrichUserAuthorization(userData), tokens };
  });
};

module.exports = { initializeGoogleStrategy, findOrCreateOAuthUser };
