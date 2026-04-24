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

// Razorpay webhooks are JSON
router.post('/webhook', paymentController.handleWebhook);

// Admin: confirm cash was collected for a COD order
router.post('/cod/confirm/:orderId', authenticate, authorizePermissions(PERMISSIONS.ORDERS_UPDATE_STATUS), paymentController.confirmCodPayment);

module.exports = router;
