'use strict';
const router = require('express').Router();
const orderController = require('./order.controller');
const { validate } = require('../../middleware/validate.middleware');
const { placeOrderSchema, updateOrderStatusSchema } = require('./order.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const { auditLog } = require('../audit/audit.middleware');

router.post('/', authenticate, validate(placeOrderSchema), orderController.placeOrder);
router.get('/', authenticate, orderController.getOrders);
router.get('/:id', authenticate, orderController.getOrderById);
router.post('/:id/cancel', authenticate, orderController.cancelOrder);

// Admin
router.put('/:id/status', authenticate, authorize('admin', 'super_admin'), validate(updateOrderStatusSchema), auditLog('Order'), orderController.updateStatus);

module.exports = router;
