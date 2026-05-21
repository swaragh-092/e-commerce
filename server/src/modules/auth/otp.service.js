'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { OtpToken } = require('../index');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const OTP_COOLDOWN_MS = 60 * 1000; // 60 seconds between sends
const MAX_ATTEMPTS = 3;

const hashOtp = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

const generate = async (identifier, purpose = 'login', ip) => {
  // Cooldown check: 1 request per 60s per identifier
  const recent = await OtpToken.findOne({
    where: {
      identifier,
      purpose,
      createdAt: { [Op.gte]: new Date(Date.now() - OTP_COOLDOWN_MS) },
    },
    order: [['createdAt', 'DESC']],
  });

  if (recent) {
    throw new AppError('TOO_MANY_REQUESTS', 429, 'Please wait 60 seconds before requesting a new OTP');
  }

  // Invalidate any existing OTPs for this identifier+purpose
  await OtpToken.destroy({ where: { identifier, purpose } });

  // Generate 6-digit OTP
  const otp = String(crypto.randomInt(100000, 1000000));

  await OtpToken.create({
    identifier,
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
  const record = await OtpToken.findOne({
    where: { identifier, purpose },
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

  if (hashOtp(otp) !== record.otpHash) {
    await record.increment('attempts');
    const remaining = record.maxAttempts - record.attempts - 1;
    throw new AppError('VALIDATION_ERROR', 400, `Invalid OTP. ${remaining > 0 ? remaining + ' attempts remaining.' : 'OTP invalidated.'}`);
  }

  // Success — destroy the token
  await record.destroy();
  return true;
};

module.exports = { generate, verify, hashOtp };
