'use strict';
const router = require('express').Router();
const orderController = require('./order.controller');
const { validate } = require('../../middleware/validate.middleware');
const { 
  placeOrderSchema, 
  updateOrderStatusSchema, 
  createFulfillmentSchema,
  updateFulfillmentStatusSchema,
  updateShipmentStatusSchema,
  createPutBackSchema,
  updatePutBackStatusSchema,
  processRefundSchema,
  addOrderNoteSchema,
  listOrdersQuerySchema,
} = require('./order.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema, idAndFulfillmentIdParamSchema } = require('../../utils/common.validation');



const { featureGate } = require('../../middleware/featureGate.middleware');

router.use(featureGate('orders'));

router.post('/', authenticate, authorizePermissions(PERMISSIONS.CHECKOUT_SELF), validate(placeOrderSchema), orderController.placeOrder);

router.get('/', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(listOrdersQuerySchema, 'query'), orderController.getOrders);
router.get('/:id/tracking', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(idParamSchema, 'params'), orderController.getFulfillmentTracking);
router.get('/:id', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(idParamSchema, 'params'), orderController.getOrderById);
router.post('/:id/cancel', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(idParamSchema, 'params'), orderController.cancelOrder);
router.post('/:id/returns', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(createPutBackSchema), orderController.createReturnRequest);
router.post('/:id/replacements', authenticate, authorizePermissions(PERMISSIONS.ACCOUNT_SELF), validate(createPutBackSchema), orderController.createReplacementRequest);

// Admin
router.put('/:id/status', authenticate, authorizePermissions(PERMISSIONS.ORDERS_UPDATE_STATUS), validate(idParamSchema, 'params'), validate(updateOrderStatusSchema), auditLog('Order'), orderController.updateStatus);
router.post('/:id/refund', authenticate, authorizePermissions(PERMISSIONS.ORDERS_REFUND), validate(processRefundSchema), auditLog('Order'), orderController.processRefund);
router.post('/:id/fulfillments', authenticate, authorizePermissions(PERMISSIONS.ORDERS_UPDATE_STATUS), validate(idParamSchema, 'params'), validate(createFulfillmentSchema), auditLog('Order'), orderController.createFulfillment);
router.patch('/:id/fulfillments/:fulfillmentId/status', authenticate, authorizePermissions(PERMISSIONS.ORDERS_UPDATE_STATUS), validate(idAndFulfillmentIdParamSchema, 'params'), validate(updateFulfillmentStatusSchema), auditLog('Fulfillment'), orderController.updateFulfillmentStatus);
router.patch('/:id/shipments/:shipmentId', authenticate, authorizePermissions(PERMISSIONS.ORDERS_UPDATE_STATUS), validate(updateShipmentStatusSchema), auditLog('Shipment'), orderController.updateShipmentStatus);
router.patch('/:id/returns/:returnId/status', authenticate, authorizePermissions(PERMISSIONS.ORDERS_UPDATE_STATUS), validate(updatePutBackStatusSchema), auditLog('OrderReturn'), orderController.updatePutBackStatus);
router.post('/:id/history/notes', authenticate, authorizePermissions(PERMISSIONS.ORDERS_UPDATE_STATUS), validate(addOrderNoteSchema), orderController.addNote);


module.exports = router;

