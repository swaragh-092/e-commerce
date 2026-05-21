'use strict';

const OtpService = require('./otp.service');
const AuthService = require('./auth.service');
const NotificationService = require('../notification/notification.service');
const { success } = require('../../utils/response');
const logger = require('../../utils/logger');

const sendOtp = async (req, res, next) => {
  try {
    const { phone } = req.validated;
    const otp = await OtpService.generate(phone, 'login', req.ip);

    // Send OTP via SMS
    try {
      if (NotificationService && NotificationService.send) {
        await NotificationService.send('otp_login', phone, { otp, expires_in: '5 minutes' });
      }
    } catch (e) {
      logger.error('OTP SMS send failed', { phone, error: e.message });
    }

    return success(res, { expiresIn: 300 }, 'OTP sent successfully');
  } catch (err) { next(err); }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { phone, code } = req.validated;
    await OtpService.verify(phone, code, 'login');
    const result = await AuthService.loginByPhone(phone, req.ip);
    return success(res, result, 'Login successful');
  } catch (err) { next(err); }
};

module.exports = { sendOtp, verifyOtp };
