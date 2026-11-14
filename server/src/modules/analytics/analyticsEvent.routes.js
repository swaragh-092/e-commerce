'use strict';

const router = require('express').Router();
const Joi = require('joi');
const { optionalAuth } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validate.middleware');
const controller = require('./analyticsEvent.controller');

const checkoutStartSchema = Joi.object({
  checkoutSessionId: Joi.string().uuid().required(),
});

router.post('/checkout-started', optionalAuth, validate(checkoutStartSchema), controller.recordCheckoutStart);

module.exports = router;
