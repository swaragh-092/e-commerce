'use strict';

const router = require('express').Router();
const { validate } = require('../../middleware/validate.middleware');
const { 
  loginLimiter, 
  registerLimiter, 
  forgotPasswordLimiter,
  verifyEmailLimiter,
  resetPasswordLimiter,
  refreshLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  twoFactorLimiter,
} = require('../../middleware/rateLimiter.middleware');

const { 
  registerSchema, 
  loginSchema, 
  refreshSchema, 
  logoutSchema,
  forgotPasswordSchema, 
  resetPasswordSchema,
  resendVerificationSchema,
  verifyEmailSchema
} = require('./auth.validation');

const { authenticate } = require('../../middleware/auth.middleware');
const authController = require('./auth.controller');
const twoFactorController = require('./twoFactor.controller');
const otpController = require('./otp.controller');
const passport = require('passport');
const { initializeGoogleStrategy } = require('./oauth.service');

initializeGoogleStrategy();

const Joi = require('joi');
const totpCodeSchema = Joi.object({ code: Joi.string().length(6).pattern(/^\d+$/).required() });
const twoFactorVerifySchema = Joi.object({
  tempToken: Joi.string().required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required(),
});
const otpSendSchema = Joi.object({ phone: Joi.string().pattern(/^\d{10,15}$/).required() });
const otpVerifySchema = Joi.object({
  phone: Joi.string().pattern(/^\d{10,15}$/).required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required(),
});

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', refreshLimiter, validate(refreshSchema), authController.refresh);
router.post('/logout', authenticate, validate(logoutSchema), authController.logout);

router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), authController.resetPassword);

router.post('/resend-verification', forgotPasswordLimiter, validate(resendVerificationSchema), authController.resendVerification);

router.post('/verify-email', verifyEmailLimiter, validate(verifyEmailSchema), authController.verifyEmail);

// 2FA routes
router.post('/2fa/verify', twoFactorLimiter, validate(twoFactorVerifySchema), authController.verifyTwoFactor);
router.post('/2fa/setup', authenticate, twoFactorController.setup);
router.post('/2fa/enable', authenticate, twoFactorLimiter, validate(totpCodeSchema), twoFactorController.enable);
router.post('/2fa/disable', authenticate, twoFactorLimiter, validate(totpCodeSchema), twoFactorController.disable);

// Phone OTP routes
router.post('/otp/send', otpSendLimiter, validate(otpSendSchema), otpController.sendOtp);
router.post('/otp/verify', otpVerifyLimiter, validate(otpVerifySchema), otpController.verifyOtp);

// Google OAuth routes
if (process.env.GOOGLE_CLIENT_ID) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
  router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=oauth_failed` }), (req, res) => {
    const { tokens } = req.user;
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    res.redirect(`${clientUrl}/oauth/callback#accessToken=${encodeURIComponent(tokens.accessToken)}&refreshToken=${encodeURIComponent(tokens.refreshToken)}`);
  });
}

module.exports = router;
