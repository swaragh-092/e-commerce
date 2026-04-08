'use strict';
const router = require('express').Router();
const express = require('express');
const paymentController = require('./payment.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createOrderSchema } = require('./payment.validation');

router.post('/create-order', authenticate, validate(createOrderSchema), paymentController.createOrder);
router.post('/verify/:orderId', authenticate, paymentController.verifyPayment);

// Razorpay webhooks are JSON
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
