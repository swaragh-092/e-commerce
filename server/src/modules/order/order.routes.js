'use strict';
const router = require('express').Router();
const orderController = require('./order.controller');
const { validate } = require('../../middleware/validate.middleware');
const { 
  placeOrderSchema, 
  updateOrderStatusSchema, 
  createFulfillmentSchema,
  updateFulfillmentStatusSchema 
} = require('./order.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { PERMISSIONS } = require('../../config/permissions');

const { featureGate } = require('../../middleware/featureGate.middleware');

router.use(featureGate('orders'));

router.post('/', authenticate, validate(placeOrderSchema), orderController.placeOrder);
router.get('/', authenticate, orderController.getOrders);
router.get('/:id/tracking', authenticate, orderController.getFulfillmentTracking);
router.get('/:id', authenticate, orderController.getOrderById);
router.post('/:id/cancel', authenticate, orderController.cancelOrder);

// Admin
router.put('/:id/status', authenticate, authorizePermissions(PERMISSIONS.ORDERS_UPDATE_STATUS), validate(updateOrderStatusSchema), auditLog('Order'), orderController.updateStatus);
router.post('/:id/refund', authenticate, authorizePermissions(PERMISSIONS.ORDERS_REFUND), auditLog('Order'), orderController.refundOrder);
router.post('/:id/fulfillments', authenticate, authorizePermissions(PERMISSIONS.ORDERS_UPDATE_STATUS), validate(createFulfillmentSchema), auditLog('Order'), orderController.createFulfillment);
router.patch('/:id/fulfillments/:fulfillmentId/status', authenticate, authorizePermissions(PERMISSIONS.ORDERS_UPDATE_STATUS), validate(updateFulfillmentStatusSchema), auditLog('Fulfillment'), orderController.updateFulfillmentStatus);

module.exports = router;
