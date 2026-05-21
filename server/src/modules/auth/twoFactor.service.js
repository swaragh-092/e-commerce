'use strict';

const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { encrypt, decrypt } = require('../../utils/crypto');
const { User } = require('../index');
const AppError = require('../../utils/AppError');

const APP_NAME = process.env.APP_NAME || 'E-Commerce Pro';

const setup = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError('NOT_FOUND', 404, 'User not found');
  if (user.twoFactorEnabled) throw new AppError('VALIDATION_ERROR', 400, '2FA is already enabled');

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(user.email, APP_NAME, secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauth);

  // Store encrypted secret (not yet enabled — user must verify first)
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

  await user.update({ twoFactorEnabled: true });
  return { enabled: true };
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

  await user.update({ twoFactorEnabled: false, twoFactorSecret: null });
  return { enabled: false };
};

const verify = (user, totpCode) => {
  if (!user.twoFactorSecret) return false;
  const secret = decrypt(user.twoFactorSecret);
  return authenticator.verify({ token: totpCode, secret });
};

module.exports = { setup, enable, disable, verify };
