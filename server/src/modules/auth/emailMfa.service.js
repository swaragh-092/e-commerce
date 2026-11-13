'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sequelize, User, Role, Permission, OtpToken, RefreshToken } = require('../index');
const AppError = require('../../utils/AppError');
const { AUTH_TIME } = require('../../config/constants');
const { enrichUserAuthorization } = require('../../config/permissions');
const { canUseEmailMfa, loadMfaPolicy } = require('./mfaPolicy');
const { getIssAud, generateTokens, hashToken } = require('./tokenUtils');

const PURPOSE = 'staff-email-mfa';
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const denied = () => new AppError('UNAUTHORIZED', 401, 'Email verification expired or is unavailable. Sign in again or use your authenticator.');
const hashCode = (...values) => crypto.createHmac('sha256', process.env.JWT_ACCESS_SECRET)
  .update(JSON.stringify([PURPOSE, ...values])).digest('hex');
const binding = user => user.emailMfaPasswordBinding;
const isBound = user => Boolean(binding(user));
const issueChallenge = (user, context = {}) => jwt.sign({
  id: user.id, purpose: PURPOSE, binding: binding(user), jti: crypto.randomUUID(),
  ...context,
}, process.env.JWT_ACCESS_SECRET, { ...getIssAud(), algorithm: 'HS256', expiresIn: '5m' });

const readChallenge = token => {
  try {
    const claims = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { ...getIssAud(), algorithms: ['HS256'] });
    if (claims.purpose === PURPOSE) return claims;
  } catch { /* Return one error for all invalid challenges. */ }
  throw denied();
};

// Both sending and verification take the account lock. This limits guessing
// and delivery across browsers, IPs and API workers using the same database.
const withChallenge = (token, action) => {
  const claims = readChallenge(token);
  return sequelize.transaction(async transaction => {
    const user = await User.scope('withPassword').findByPk(claims.id, {
      include: [{ model: Role, as: 'roles', include: [{ model: Permission, as: 'permissions' }] }],
      lock: { level: transaction.LOCK.UPDATE, of: User },
      transaction,
    });
    if (!user || user.status !== 'active' || !isBound(user) || binding(user) !== claims.binding
        || (user.scheduledDeletionAt && new Date(user.scheduledDeletionAt) <= new Date())
        || !canUseEmailMfa(user, await loadMfaPolicy(user, transaction))
        || claims.exp * 1000 <= Date.now()) throw denied();
    const where = { identifier: user.id, purpose: PURPOSE };
    const record = await OtpToken.findOne({ where, transaction, lock: transaction.LOCK.UPDATE });
    return action({ user, claims, where, record, transaction });
  });
};

const sendCode = async (token, ipAddress) => {
  const delivery = await withChallenge(token, async ({ user, claims, where, record, transaction }) => {
    if (record && Date.now() - new Date(record.createdAt).getTime() < WINDOW_MS) {
      throw new AppError('TOO_MANY_REQUESTS', 429, 'An email code was requested recently. Use the code you received, try your authenticator, or sign in again in five minutes.');
    }
    if (record) await record.destroy({ transaction });
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    await OtpToken.create({
      ...where, otpHash: hashCode(claims.jti, code), maxAttempts: MAX_ATTEMPTS,
      expiresAt: new Date(claims.exp * 1000), createdByIp: ipAddress,
    }, { transaction });
    return { email: user.email, code };
  });

  try {
    await require('../notification/channels/email.channel').send({
      to: delivery.email,
      subject: 'Your staff sign-in code',
      text: `Your sign-in code is ${delivery.code}. It expires within five minutes. If you did not request this code, ignore this email.`,
      sensitive: true,
    });
  } catch {
    throw new AppError('EMAIL_DELIVERY_FAILED', 503, 'The sign-in email could not be sent. Use your authenticator or try again.');
  }
};

const verifyCode = async (token, code, ipAddress) => {
  const result = await withChallenge(token, async ({ user, claims, record, transaction }) => {
    if (claims.reauthSid) {
      const lockedSession = await RefreshToken.findByPk(claims.reauthSid, { attributes: ['id', 'userId', 'revokedAt'], transaction });
      if (!lockedSession || lockedSession.userId !== user.id || lockedSession.revokedAt) throw new AppError('FORBIDDEN', 403, 'Reauthentication must use the same administrator account');
    }
    if (!record || record.expiresAt <= new Date() || record.attempts >= record.maxAttempts) return null;
    const expected = Buffer.from(record.otpHash, 'hex');
    const submitted = Buffer.from(hashCode(claims.jti, code), 'hex');
    if (!crypto.timingSafeEqual(expected, submitted)) {
      await record.increment('attempts', { transaction });
      return null;
    }

    // Keep the spent record for the per-account send cooldown.
    await record.update({ attempts: record.maxAttempts }, { transaction });
    const id = crypto.randomUUID();
    const tokens = generateTokens(user, id, {
      mfaVerified: true,
      mfaMethod: 'email',
      mfaBinding: user.emailMfaPasswordBinding,
    });
    const staffSession = require('../../config/permissions').isAdminUser(user);
    const ttl = staffSession ? 12 * 60 * 60 * 1000 : (claims.rememberMe ? AUTH_TIME.REMEMBER_ME_TTL_MS : AUTH_TIME.REFRESH_TOKEN_TTL_MS);
    await RefreshToken.create({
      id, userId: user.id, token: hashToken(tokens.refreshToken), createdByIp: ipAddress,
      expiresAt: new Date(Date.now() + ttl),
      absoluteExpiresAt: new Date(Date.now() + ttl),
      lastActiveAt: new Date(),
    }, { transaction });
    await user.update({ lastLoginAt: new Date() }, { transaction });
    const publicUser = await User.findByPk(user.id, {
      include: [{ model: Role, as: 'roles', include: [{ model: Permission, as: 'permissions' }] }],
      transaction,
    });
    return { user: enrichUserAuthorization(publicUser), tokens, ...(staffSession ? { adminSessionExpiresAt: new Date(Date.now() + ttl) } : {}), rememberMe: claims.rememberMe === true, knownDevice: claims.knownDevice === true,
      ...(staffSession && claims.rememberMe ? { rememberedDeviceToken: await require('./rememberedDevice').issue(user.id) } : {}) };
  });
  if (!result) throw new AppError('VALIDATION_ERROR', 400, 'Invalid or expired email code. Check the code or use your authenticator.');
  return result;
};

module.exports = { binding, isBound, issueChallenge, sendCode, verifyCode };
