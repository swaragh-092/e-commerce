'use strict';
const router = require('express').Router();
const express = require('express');
const paymentController = require('./payment.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createIntentSchema } = require('./payment.validation');

router.post('/create-intent', authenticate, validate(createIntentSchema), paymentController.createIntent);

// Note: webhook body parser must be express.raw()
// Our main app.js already checks `req.originalUrl.includes('/webhook')` and avoids parsing as JSON.
router.post('/webhook', express.raw({type: 'application/json'}), paymentController.handleWebhook);

module.exports = router;
