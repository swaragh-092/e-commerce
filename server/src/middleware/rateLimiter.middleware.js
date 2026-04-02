'use strict';

const rateLimit = require('express-rate-limit');

// Helper to create limiters
const createLimiter = (windowMinutes, maxRequests, message) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    message: {
      success: false,
      code: 'TOO_MANY_REQUESTS',
      message: message || 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Defined rate limiters based on Phase 1 requirements
const loginLimiter = createLimiter(15, 10, 'Too many login attempts, please try again after 15 minutes');
const registerLimiter = createLimiter(60, 3, 'Too many accounts created from this IP, please try again after an hour');
const forgotPasswordLimiter = createLimiter(60, 3, 'Too many password reset requests, please try again after an hour');
const reviewLimiter = createLimiter(24 * 60, 5, 'You have reached the daily limit for reviews');
const couponLimiter = createLimiter(1, 10, 'Too many coupon validation requests');
const globalLimiter = createLimiter(15, 100, 'Too many requests to this API, please try again later');

module.exports = {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  reviewLimiter,
  couponLimiter,
  globalLimiter,
};
