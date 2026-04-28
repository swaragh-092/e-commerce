'use strict';
const router = require('express').Router();
const paymentController = require('./payment.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createOrderSchema } = require('./payment.validation');
const { PERMISSIONS } = require('../../config/permissions');

router.post('/create-order', authenticate, validate(createOrderSchema), paymentController.createOrder);
router.post('/verify/:orderId', authenticate, paymentController.verifyPayment);

// Provider webhooks are parsed as raw bodies by app.js
router.post('/webhook/cashfree', paymentController.handleCashfreeWebhook);

// Stripe webhook
router.post('/webhook/stripe', paymentController.handleStripeWebhook);

// PayU return
router.post('/payu/return', paymentController.handlePayUReturn);

// Razorpay webhook
router.post('/webhook', paymentController.handleWebhook);

// Admin: confirm cash was collected for a COD order
router.post('/cod/confirm/:orderId', authenticate, authorizePermissions(PERMISSIONS.ORDERS_UPDATE_STATUS), paymentController.confirmCodPayment);

// Admin: gateway manager — list statuses + save credentials
router.get('/gateways', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_READ), paymentController.getGatewayStatuses);
router.post('/gateways/:id/configure', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_MANAGE), paymentController.saveGatewayCredentials);

module.exports = router;
