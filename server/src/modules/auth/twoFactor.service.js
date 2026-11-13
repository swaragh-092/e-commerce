'use strict';

const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

// Allow 1 step before/after current time (±30 seconds tolerance)
authenticator.options = { window: 1 };
const { encrypt, decrypt } = require('../../utils/crypto');
const { User, RefreshToken, sequelize } = require('../index');
const AppError = require('../../utils/AppError');
const { isEnrollmentRequired, loadMfaPolicy } = require('./mfaPolicy');
const { revokeUserSessions } = require('./sessionRevocation');

const APP_NAME = process.env.APP_NAME || 'E-Commerce Pro';
const AccountEvents = require('./accountEvents');
const { generateTokens, hashToken } = require('./tokenUtils');
const { AUTH_TIME } = require('../../config/constants');

const replacementSession = async (user, transaction, ipAddress) => {
  const id = crypto.randomUUID();
  const tokens = generateTokens(user, id, { mfaVerified: true });
  await RefreshToken.create({ id, userId: user.id, token: hashToken(tokens.refreshToken),
    expiresAt: new Date(Date.now() + AUTH_TIME.REFRESH_TOKEN_TTL_MS), createdByIp: ipAddress || null,
  }, { transaction });
  return tokens;
};

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');
const sameSecret = (left, right) => ['ciphertext', 'iv', 'tag', 'version']
  .every(field => left?.[field] === right?.[field]);

const generateBackupCodes = () => {
  const codes = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(4).toString('hex')); // 8-char hex codes
  }
  return codes;
};

const setup = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  if (user.status !== 'active') throw new AppError('FORBIDDEN', 403, 'Your account is inactive');
  if (user.twoFactorEnabled) throw new AppError('VALIDATION_ERROR', 400, '2FA is already enabled');

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, APP_NAME, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

  await user.update({ twoFactorSecret: encrypt(secret) });

  return { qrCodeDataUrl, otpauth, secret };
};

const enable = async (userId, totpCode, { createSession = false, ipAddress } = {}) => {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  if (user.twoFactorEnabled) throw new AppError('VALIDATION_ERROR', 400, '2FA is already enabled');
  if (!user.twoFactorSecret) throw new AppError('VALIDATION_ERROR', 400, 'Run 2FA setup first');

  let secret;
  try {
    secret = decrypt(user.twoFactorSecret);
  } catch {
    throw new AppError('VALIDATION_ERROR', 400, '2FA setup expired or corrupted. Please run setup again.');
  }
  if (!authenticator.verify({ token: totpCode, secret })) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid verification code');
  }

  // Generate backup codes
  const plainCodes = generateBackupCodes();
  const hashedCodes = plainCodes.map(c => hashCode(c));

  let tokens;
  await sequelize.transaction(async transaction => {
    const locked = await User.scope('withPassword').findByPk(userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!locked || locked.status !== 'active' || locked.twoFactorEnabled || !sameSecret(locked.twoFactorSecret, user.twoFactorSecret)) {
      throw new AppError('VALIDATION_ERROR', 409, 'MFA setup changed. Reload your profile and try again.');
    }
    await revokeUserSessions([user.id], transaction);
    await locked.update({
      twoFactorEnabled: true,
      twoFactorBackupCodes: hashedCodes,
    }, { transaction });
    if (createSession) tokens = await replacementSession(locked, transaction, ipAddress);
  });

  AccountEvents.emit('2fa_enabled', { userId });

  // Return plain codes ONCE — user must save them
  return { enabled: true, backupCodes: plainCodes, ...(tokens ? { tokens } : {}) };
};

const disable = async (userId, totpCode, { createSession = false, ipAddress } = {}) => {
  const user = await User.scope('withPassword').findByPk(userId, { include: ['roles'] });
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  if (isEnrollmentRequired(user, await loadMfaPolicy(user))) throw new AppError('MFA_REQUIRED', 403, 'MFA is required for your role. Contact your operator for recovery.');
  if (!user.twoFactorEnabled) throw new AppError('VALIDATION_ERROR', 400, '2FA is not enabled');
  if (!user.twoFactorSecret) throw new AppError('VALIDATION_ERROR', 400, '2FA secret missing');

  let secret;
  try {
    secret = decrypt(user.twoFactorSecret);
  } catch {
    throw new AppError('VALIDATION_ERROR', 400, '2FA secret is corrupted. Please contact support to reset 2FA.');
  }
  // Accept a TOTP code OR a backup code, so a lost device alone is not a
  // permanent lockout. Backup codes are single-use and consumed here.
  let valid = false;
  try {
    valid = authenticator.verify({ token: totpCode, secret });
  } catch { valid = false; }
  if (!valid) {
    valid = await verifyBackupCode(user, totpCode);
  }
  if (!valid) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid verification code');
  }

  let tokens;
  await sequelize.transaction(async transaction => {
    const locked = await User.scope('withPassword').findByPk(userId, { include: ['roles'], transaction,
      lock: { level: transaction.LOCK.UPDATE, of: User } });
    if (locked?.status !== 'active' || !locked.twoFactorEnabled || !sameSecret(locked.twoFactorSecret, user.twoFactorSecret)) {
      throw new AppError('VALIDATION_ERROR', 409, 'MFA changed. Reload your profile and try again.');
    }
    if (isEnrollmentRequired(locked, await loadMfaPolicy(locked, transaction))) {
      throw new AppError('MFA_REQUIRED', 403, 'MFA is required for your role.');
    }
    await revokeUserSessions([user.id], transaction);
    await locked.update({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null }, { transaction });
    if (createSession) tokens = await replacementSession(locked, transaction, ipAddress);
  });
  AccountEvents.emit('2fa_disabled', { userId });
  return { enabled: false, ...(tokens ? { tokens } : {}) };
};

const verify = (user, totpCode) => {
  if (!user.twoFactorSecret) return false;
  try {
    const secret = decrypt(user.twoFactorSecret);
    return authenticator.verify({ token: totpCode, secret });
  } catch (e) {
    throw new AppError('VALIDATION_ERROR', 400, '2FA secret is corrupted. Please disable and re-enable 2FA.');
  }
};

const verifyBackupCode = async (user, code) => {
  if (!user.twoFactorBackupCodes || !Array.isArray(user.twoFactorBackupCodes)) return false;

  const hashed = hashCode(String(code || '').trim().toLowerCase());
  if (!user.twoFactorBackupCodes.includes(hashed)) return false;

  const { sequelize } = require('../index');
  return sequelize.transaction(async (t) => {
    const locked = await User.scope('withPassword').findByPk(user.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!locked?.twoFactorBackupCodes) return false;

    const idx = locked.twoFactorBackupCodes.indexOf(hashed);
    if (idx === -1) return false;

    const remaining = [...locked.twoFactorBackupCodes];
    remaining.splice(idx, 1);
    locked.twoFactorBackupCodes = remaining;
    await locked.save({ transaction: t });
    return true;
  });
};

const regenerateBackupCodes = async (userId, totpCode) => {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  if (!user.twoFactorEnabled) throw new AppError('VALIDATION_ERROR', 400, '2FA is not enabled');

  let secret;
  try {
    secret = decrypt(user.twoFactorSecret);
  } catch {
    throw new AppError('VALIDATION_ERROR', 400, '2FA secret is corrupted. Please disable and re-enable 2FA.');
  }
  if (!authenticator.verify({ token: totpCode, secret })) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid verification code');
  }

  const plainCodes = generateBackupCodes();
  const hashedCodes = plainCodes.map(c => hashCode(c));
  await user.update({ twoFactorBackupCodes: hashedCodes });

  return { backupCodes: plainCodes };
};

module.exports = { setup, enable, disable, verify, verifyBackupCode, regenerateBackupCodes };
