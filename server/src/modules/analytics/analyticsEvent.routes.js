'use strict';

const router = require('express').Router();
const Joi = require('joi');
const { optionalAuth } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { featureGate } = require('../../middleware/featureGate.middleware');
const { createLimiter } = require('../../middleware/rateLimiter.middleware');
const controller = require('./analyticsEvent.controller');

const checkoutStartSchema = Joi.object({
  checkoutSessionId: Joi.string().uuid().required(),
});

const pageViewSchema = Joi.object({
  path: Joi.string().max(500).pattern(/^\/(?!\/|(?:admin|api|uploads|health)(?:\/|$))[^?#\\]*$/i).required(),
  sessionId: Joi.string().uuid({ version: 'uuidv4' }).required(),
  slug: Joi.string().max(255).pattern(/^[\w-]+$/).optional(),
  referrer: Joi.string().allow('').max(2048),
  utmSource: Joi.string().allow('').max(255),
  utmMedium: Joi.string().allow('').max(255),
  utmCampaign: Joi.string().allow('').max(255),
});
const pageViewLimiter = createLimiter(1, 120, 'Too many page view events', { prefix: 'page-view' });

router.post('/page-view', pageViewLimiter, featureGate('analytics'), validate(pageViewSchema), controller.recordPageView);
router.post('/checkout-started', featureGate('analytics'), featureGate('checkout'), optionalAuth, validate(checkoutStartSchema), controller.recordCheckoutStart);

module.exports = router;
