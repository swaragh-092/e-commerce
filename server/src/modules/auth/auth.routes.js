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
const { setAuthCookies, setRememberedDeviceCookie } = require('./authCookies');
const { getClientBaseUrl } = require('./authRedirects');

initializeGoogleStrategy();

const adminSession = async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const data = require('./adminSession').status(req.user, req.authSession);
    data.knownDevice = await require('./rememberedDevice').recognize(req.cookies?.remembered_device, req.user.id);
    return success(res, data, 'Admin session status');
  } catch (error) { next(error); }
};
const adminActivity = async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const data = await require('./adminSession').recordActivity(req.user, req.authSession.id);
    return success(res, data, 'Admin activity recorded');
  } catch (error) { next(error); }
};
const requireAdminSession = async (req, res, next) => {
  try {
    const { isAdminUser } = require('../../config/permissions');
    if (!isAdminUser(req.user)) return next(new (require('../../utils/AppError'))('FORBIDDEN', 403, 'Admin access required'));
    req.authSession = req.authSession || null;
    if (!req.authSession) return next(new (require('../../utils/AppError'))('UNAUTHORIZED', 401, 'Admin session not found'));
    next();
  } catch (error) { next(error); }
};
router.get('/admin-session', authenticate, requireAdminSession, adminSession);
router.post('/admin-session/activity', authenticate, requireAdminSession, adminActivity);

const Joi = require('joi');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const mfaSettings = require('./mfaSettings.controller');
const { policySchema } = require('./mfaPolicy');
const mfaSettingsSchema = Joi.object({
  policy: policySchema.required(),
  verification: Joi.object({
    currentPassword: Joi.string().max(1024).required(),
    code: Joi.string().pattern(/^\d{6}$/).optional(),
  }).required(),
});
router.get('/mfa-policy', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_READ), mfaSettings.get);
router.put('/mfa-policy', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_MANAGE), twoFactorLimiter,
  validate(mfaSettingsSchema), mfaSettings.update);
const totpCodeSchema = Joi.object({ code: Joi.string().length(6).pattern(/^\d+$/).required() });
// Disable accepts a TOTP code OR a single-use backup code (lost-device recovery).
const disableTwoFactorSchema = Joi.object({
  code: Joi.string().required().pattern(/^(\d{6}|[a-f0-9]{8})$/i).messages({
    'string.pattern.base': 'Code must be a 6-digit TOTP or 8-character backup code',
  }),
});
const twoFactorVerifySchema = Joi.object({
  tempToken: Joi.string().required(),
  code: Joi.string().required().pattern(/^(\d{6}|[a-f0-9]{8})$/i).messages({
    'string.pattern.base': 'Code must be a 6-digit TOTP or 8-character backup code',
  }),
  trustDevice: Joi.boolean().default(false),
});
const otpSendSchema = Joi.object({ phone: Joi.string().pattern(/^\d{10,15}$/).required() });
const otpVerifySchema = Joi.object({
  phone: Joi.string().pattern(/^\d{10,15}$/).required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required(),
});

router.post('/register', registerLimiter, validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh', refreshLimiter, validate(refreshSchema), authController.refresh);
// Logout accepts refresh-only (no `authenticate`) so an expired access token
// doesn't block logout; ownership is proven by the signed refresh JWT itself.
router.post('/logout', validate(logoutSchema), authController.logout);

router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), authController.resetPassword);

router.post('/resend-verification', verifyEmailLimiter, validate(resendVerificationSchema), authController.resendVerification);

router.post('/verify-email', verifyEmailLimiter, validate(verifyEmailSchema), authController.verifyEmail);

// Email codes are offered only by the password flow.
const emailMfa = require('./emailMfa.service');
const { success } = require('../../utils/response');
const { stripAuthTokens } = require('./authCookies');
const emailChallengeSchema = Joi.object({ emailChallenge: Joi.string().max(2048).required() });
router.post('/2fa/email/send', twoFactorLimiter, validate(emailChallengeSchema), async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    await emailMfa.sendCode(req.validated.emailChallenge, req.ip);
    return success(res, null, 'Email code sent');
  } catch (error) { return next(error); }
});
router.post('/2fa/email/verify', twoFactorLimiter,
  validate(emailChallengeSchema.keys({ code: Joi.string().pattern(/^\d{6}$/).required() })),
  async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const result = await emailMfa.verifyCode(req.validated.emailChallenge, req.validated.code, req.ip);
      setAuthCookies(res, result.tokens, { rememberMe: result.rememberMe, adminSessionExpiresAt: result.adminSessionExpiresAt });
      setRememberedDeviceCookie(res, result.rememberedDeviceToken);
      return success(res, stripAuthTokens(result));
    } catch (error) { return next(error); }
  });

// 2FA routes
router.post('/2fa/verify', twoFactorLimiter, validate(twoFactorVerifySchema), authController.verifyTwoFactor);
router.post('/2fa/setup', authenticate, twoFactorLimiter, twoFactorController.setup);
router.post('/2fa/enable', authenticate, twoFactorLimiter, validate(totpCodeSchema), twoFactorController.enable);
router.post('/2fa/disable', authenticate, twoFactorLimiter, validate(disableTwoFactorSchema), twoFactorController.disable);
router.post('/2fa/backup-codes', authenticate, twoFactorLimiter, validate(totpCodeSchema), twoFactorController.regenerateBackupCodes);

// Phone OTP routes
router.post('/otp/send', otpSendLimiter, validate(otpSendSchema), otpController.sendOtp);
router.post('/otp/verify', otpVerifyLimiter, validate(otpVerifySchema), otpController.verifyOtp);

// Google OAuth routes
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const clientUrl = getClientBaseUrl();
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
  router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: `${clientUrl}/login?error=oauth_failed` }), (req, res) => {
    if (req.user.requiresTwoFactor) {
      res.redirect(`${clientUrl}/login?requiresTwoFactor=true&tempToken=${encodeURIComponent(req.user.tempToken)}`);
    } else {
      const { tokens } = req.user;
      setAuthCookies(res, tokens);
      res.redirect(`${clientUrl}/oauth/callback`);
    }
  });
}

module.exports = router;
