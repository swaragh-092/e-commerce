'use strict';

const crypto = require('crypto');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

// Allow 1 step before/after current time (±30 seconds tolerance)
authenticator.options = { window: 1 };
const { encrypt, decrypt } = require('../../utils/crypto');
const { User } = require('../index');
const AppError = require('../../utils/AppError');

const APP_NAME = process.env.APP_NAME || 'E-Commerce Pro';
const AccountEvents = require('./accountEvents');

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

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
  if (user.twoFactorEnabled) throw new AppError('VALIDATION_ERROR', 400, '2FA is already enabled');

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, APP_NAME, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

  await user.update({ twoFactorSecret: encrypt(secret) });

  return { qrCodeDataUrl, otpauth, secret };
};

const enable = async (userId, totpCode) => {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  if (user.twoFactorEnabled) throw new AppError('VALIDATION_ERROR', 400, '2FA is already enabled');
  if (!user.twoFactorSecret) throw new AppError('VALIDATION_ERROR', 400, 'Run 2FA setup first');

  const secret = decrypt(user.twoFactorSecret);
  if (!authenticator.verify({ token: totpCode, secret })) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid verification code');
  }

  // Generate backup codes
  const plainCodes = generateBackupCodes();
  const hashedCodes = plainCodes.map(c => hashCode(c));

  await user.update({
    twoFactorEnabled: true,
    twoFactorBackupCodes: hashedCodes,
  });

  AccountEvents.emit('2fa_enabled', { userId });

  // Return plain codes ONCE — user must save them
  return { enabled: true, backupCodes: plainCodes };
};

const disable = async (userId, totpCode) => {
  const user = await User.scope('withPassword').findByPk(userId);
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  if (!user.twoFactorEnabled) throw new AppError('VALIDATION_ERROR', 400, '2FA is not enabled');
  if (!user.twoFactorSecret) throw new AppError('VALIDATION_ERROR', 400, '2FA secret missing');

  const secret = decrypt(user.twoFactorSecret);
  if (!authenticator.verify({ token: totpCode, secret })) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid verification code');
  }

  await user.update({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null });
  AccountEvents.emit('2fa_disabled', { userId });
  return { enabled: false };
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

  const hashed = hashCode(code);
  if (!user.twoFactorBackupCodes.includes(hashed)) return false;

  const { sequelize } = require('../index');
  return sequelize.transaction(async (t) => {
    const locked = await User.findByPk(user.id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!locked.twoFactorBackupCodes) return false;

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

  const secret = decrypt(user.twoFactorSecret);
  if (!authenticator.verify({ token: totpCode, secret })) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid verification code');
  }

  const plainCodes = generateBackupCodes();
  const hashedCodes = plainCodes.map(c => hashCode(c));
  await user.update({ twoFactorBackupCodes: hashedCodes });

  return { backupCodes: plainCodes };
};

module.exports = { setup, enable, disable, verify, verifyBackupCode, regenerateBackupCodes };
