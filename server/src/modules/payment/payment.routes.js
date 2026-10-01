'use strict';
const router = require('express').Router();
const paymentController = require('./payment.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { createOrderSchema, gatewayIdParamSchema, verifyPaymentSchema, markFailedSchema, codConfirmSchema } = require('./payment.validation');
const { PERMISSIONS } = require('../../config/permissions');
const { orderIdParamSchema } = require('../../utils/common.validation');


const { featureGate } = require('../../middleware/featureGate.middleware');
const { webhookLimiter } = require('../../middleware/rateLimiter.middleware');

// Provider webhooks must stay reachable even when the `payments` feature is
// off (fail-closed gate would otherwise force providers into retry storms)
// and get a dedicated limiter instead of the global API bucket.
router.post('/webhook/cashfree', webhookLimiter, paymentController.handleCashfreeWebhook);
router.post('/webhook/stripe', webhookLimiter, paymentController.handleStripeWebhook);
router.post('/webhook', webhookLimiter, paymentController.handleWebhook);

// PayU front-channel return (browser redirect, urlencoded form)
router.post('/payu/return', paymentController.handlePayUReturn);

router.use(featureGate('payments'));

router.post('/create-order', authenticate, authorizePermissions(PERMISSIONS.CHECKOUT_SELF), validate(createOrderSchema), paymentController.createOrder);
router.post('/verify/:orderId', authenticate, authorizePermissions(PERMISSIONS.CHECKOUT_SELF), validate(orderIdParamSchema, 'params'), validate(verifyPaymentSchema), paymentController.verifyPayment);
router.post('/fail/:orderId', authenticate, authorizePermissions(PERMISSIONS.CHECKOUT_SELF), validate(orderIdParamSchema, 'params'), validate(markFailedSchema), paymentController.markFailed);

// Admin: confirm cash was collected for a COD order
router.post('/cod/confirm/:orderId', authenticate, authorizePermissions(PERMISSIONS.ORDERS_UPDATE_STATUS), validate(orderIdParamSchema, 'params'), validate(codConfirmSchema), paymentController.confirmCodPayment);


// Admin: gateway manager — list statuses + save credentials
router.get('/gateways', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_READ), paymentController.getGatewayStatuses);
router.post('/gateways/:id/configure', authenticate, authorizePermissions(PERMISSIONS.SETTINGS_MANAGE), validate(gatewayIdParamSchema, 'params'), paymentController.saveGatewayCredentials);


module.exports = router;
