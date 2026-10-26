'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { OtpToken } = require('../index');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds between sends
const MAX_ATTEMPTS = 3;

const OTP_PEPPER = process.env.OTP_PEPPER || process.env.CREDENTIAL_ENCRYPTION_KEY || '';

// 6-digit codes have only ~20 bits of entropy — hash with a server-side pepper
// so a DB read alone doesn't enable offline brute-force. Changing the pepper
// invalidates outstanding OTPs (5-min TTL, negligible).
const hashOtp = (otp) => crypto.createHash('sha256').update(`${OTP_PEPPER}:${otp}`).digest('hex');

const generate = async (identifier, purpose = 'login', ip) => {
  const normalizedId = String(identifier || '').trim();
  if (!normalizedId) throw new AppError('VALIDATION_ERROR', 400, 'Phone number is required');
  // Cooldown check: 1 request per 60s per identifier ACROSS purposes, so
  // alternating `login` / `phone_change` for the same number can't spam SMS.
  const recent = await OtpToken.findOne({
    where: {
      identifier: normalizedId,
      createdAt: { [Op.gte]: new Date(Date.now() - OTP_COOLDOWN_MS) },
    },
    order: [['createdAt', 'DESC']],
  });

  if (recent) {
    throw new AppError('TOO_MANY_REQUESTS', 429, 'Please wait 60 seconds before requesting a new OTP');
  }

  // Invalidate any existing OTPs for this identifier+purpose
  await OtpToken.destroy({ where: { identifier: normalizedId, purpose } });

  // Generate 6-digit OTP
  const otp = String(crypto.randomInt(100000, 1000000));

  await OtpToken.create({
    identifier: normalizedId,
    otpHash: hashOtp(otp),
    purpose,
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MS),
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    createdByIp: ip,
  });

  return otp;
};

const verify = async (identifier, otp, purpose = 'login') => {
  const normalizedId = String(identifier || '').trim();
  const normalizedOtp = String(otp || '').trim();
  const record = await OtpToken.findOne({
    where: { identifier: normalizedId, purpose },
    order: [['createdAt', 'DESC']],
  });

  if (!record) {
    throw new AppError('VALIDATION_ERROR', 400, 'No OTP found. Please request a new one.');
  }

  if (record.expiresAt < new Date()) {
    await record.destroy();
    throw new AppError('VALIDATION_ERROR', 400, 'OTP has expired. Please request a new one.');
  }

  if (record.attempts >= record.maxAttempts) {
    await record.destroy();
    throw new AppError('VALIDATION_ERROR', 400, 'Too many failed attempts. Please request a new OTP.');
  }

  if (hashOtp(normalizedOtp) !== record.otpHash) {
    const attemptsNow = (record.attempts || 0) + 1;
    await record.increment('attempts');
    const remaining = record.maxAttempts - attemptsNow;
    if (remaining <= 0) {
      await record.destroy();
      throw new AppError('VALIDATION_ERROR', 400, 'Too many failed attempts. Please request a new OTP.');
    }
    throw new AppError('VALIDATION_ERROR', 400, `Invalid OTP. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
  }

  // Success — destroy the token
  await record.destroy();
  return true;
};

module.exports = { generate, verify, hashOtp };
