'use strict';

const rateLimit = require('express-rate-limit');

// Helper to create limiters
const createLimiter = (windowMinutes, maxRequests, message) => {
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
  });
};

// Defined rate limiters based on Phase 1 requirements
const loginLimiter = createLimiter(15, 20, 'Too many login attempts, please try again after 15 minutes');
const registerLimiter = createLimiter(60, 20, 'Too many accounts created from this IP, please try again after an hour');
const forgotPasswordLimiter = createLimiter(60, 3, 'Too many password reset requests, please try again after an hour');
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
});
const couponLimiter = createLimiter(1, 10, 'Too many coupon validation requests');
const globalLimiter = createLimiter(15, 2000, 'Too many requests to this API, please try again later');
const publicApiLimiter = createLimiter(15, 500, 'Too many requests to public endpoints, please try again later');


const verifyEmailLimiter = createLimiter(15, 5, 'Too many verification attempts, please try again after 15 minutes');
const resetPasswordLimiter = createLimiter(15, 5, 'Too many reset attempts, please try again after 15 minutes');
const refreshLimiter = createLimiter(15, 30, 'Too many refresh requests, please try again after 15 minutes');

const bulkOperationLimiter = createLimiter(1, 5, 'Too many bulk operations, please try again in a minute');
const otpSendLimiter = createLimiter(1, 1, 'Please wait 60 seconds before requesting a new OTP');
const otpVerifyLimiter = createLimiter(15, 5, 'Too many OTP verification attempts, please try again after 15 minutes');
const twoFactorLimiter = createLimiter(15, 5, 'Too many 2FA attempts, please try again after 15 minutes');
const mediaUploadLimiter = createLimiter(15, 50, 'Too many uploads, please try again after 15 minutes');
const searchLimiter = createLimiter(1, 30, 'Too many search requests, please slow down');
// AI assistant calls are expensive — limit tightly per-user to prevent abuse.
const aiAssistantLimiter = createLimiter(15, 10, 'Too many AI assistant requests. Please wait before trying again.');

module.exports = {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  verifyEmailLimiter,
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
};


