'use strict';

const router = require('express').Router();
const { validate } = require('../../middleware/validate.middleware');
const { 
  loginLimiter, 
  registerLimiter, 
  forgotPasswordLimiter 
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

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshSchema), authController.refresh);
router.post('/logout', authenticate, validate(logoutSchema), authController.logout);

router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

router.post('/resend-verification', forgotPasswordLimiter, validate(resendVerificationSchema), authController.resendVerification);

router.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);

module.exports = router;
