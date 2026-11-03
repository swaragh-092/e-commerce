'use strict';

const rateLimit = require('express-rate-limit');
const PostgresRateLimitStore = require('../utils/postgresRateLimitStore');

// Helper to create limiters
let limiterSequence = 0;
const createLimiter = (windowMinutes, maxRequests, message, { prefix, shared = true } = {}) => {
  const storePrefix = prefix || `shared-limiter-${++limiterSequence}`;
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: message || 'Too many requests, please try again later.'
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    ...(shared ? { store: new PostgresRateLimitStore(storePrefix) } : {}),
  });
};

// Defined rate limiters based on Phase 1 requirements
const loginLimiter = createLimiter(15, 20, 'Too many login attempts, please try again after 15 minutes', { prefix: 'login' });
const registerLimiter = createLimiter(60, 20, 'Too many accounts created from this IP, please try again after an hour', { prefix: 'register' });
const forgotPasswordLimiter = createLimiter(60, 3, 'Too many password reset requests, please try again after an hour', { prefix: 'forgot-password' });
const reviewLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'You have reached the daily limit for reviews. Please try again tomorrow.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new PostgresRateLimitStore('review'),
});
const couponLimiter = createLimiter(1, 10, 'Too many coupon validation requests', { prefix: 'coupon' });
// Keep high-volume traffic shaping in-process. Authentication and abuse-prone
// route limits below use PostgreSQL so their counters are shared by all workers.
const globalLimiter = createLimiter(15, 2000, 'Too many requests to this API, please try again later', { shared: false });
const publicApiLimiter = createLimiter(15, 500, 'Too many requests to public endpoints, please try again later', { shared: false });


const verifyEmailLimiter = createLimiter(15, 5, 'Too many verification attempts, please try again after 15 minutes', { prefix: 'verify-email' });
const guestOrderClaimLimiter = createLimiter(15, 3, 'Too many guest order link requests. Please try again after 15 minutes.', { prefix: 'guest-order-claim' });
const resetPasswordLimiter = createLimiter(15, 5, 'Too many reset attempts, please try again after 15 minutes', { prefix: 'reset-password' });
const refreshLimiter = createLimiter(15, 30, 'Too many refresh requests, please try again after 15 minutes', { prefix: 'refresh' });

const bulkOperationLimiter = createLimiter(1, 5, 'Too many bulk operations, please try again in a minute', { prefix: 'bulk-operation' });
const otpSendLimiter = createLimiter(1, 1, 'Please wait 60 seconds before requesting a new OTP', { prefix: 'otp-send' });
const otpVerifyLimiter = createLimiter(15, 5, 'Too many OTP verification attempts, please try again after 15 minutes', { prefix: 'otp-verify' });
const twoFactorLimiter = createLimiter(15, 5, 'Too many 2FA attempts, please try again after 15 minutes', { prefix: 'two-factor' });
const mediaUploadLimiter = createLimiter(15, 50, 'Too many uploads, please try again after 15 minutes', { prefix: 'media-upload' });
const searchLimiter = createLimiter(1, 30, 'Too many search requests, please slow down', { prefix: 'search' });
// AI assistant calls are expensive — limit tightly per-user to prevent abuse.
const aiAssistantLimiter = createLimiter(15, 10, 'Too many AI assistant requests. Please wait before trying again.', { prefix: 'ai-assistant' });
const inventoryAlertLimiter = createLimiter(1, 60, 'Too many inventory alert requests, please try again shortly', { prefix: 'inventory-alert' });
const inventoryAlertTestLimiter = createLimiter(5, 5, 'Too many test alert emails requested, please try again in a few minutes', { prefix: 'inventory-alert-test' });
const adminDashboardLimiter = createLimiter(1, 120, 'Too many dashboard requests, please try again shortly', { prefix: 'admin-dashboard' });
const webhookLimiter = createLimiter(1, 120, 'Too many webhook events received, please try again shortly', { prefix: 'payment-webhook' });
const shippingWebhookLimiter = createLimiter(1, 120, 'Too many shipping webhook events received, please try again shortly', { prefix: 'shipping-webhook' });

module.exports = {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  verifyEmailLimiter,
  guestOrderClaimLimiter,
  resetPasswordLimiter,
  refreshLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
  twoFactorLimiter,
  reviewLimiter,
  couponLimiter,
  globalLimiter,
  publicApiLimiter,
  bulkOperationLimiter,
  mediaUploadLimiter,
  searchLimiter,
  aiAssistantLimiter,
  inventoryAlertLimiter,
  inventoryAlertTestLimiter,
  adminDashboardLimiter,
  webhookLimiter,
  shippingWebhookLimiter,
  createLimiter,
};
