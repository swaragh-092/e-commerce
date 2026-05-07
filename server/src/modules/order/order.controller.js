'use strict';
const OrderService = require('./order.service');
const { success, paginated } = require('../../utils/response');
const { PERMISSIONS, getPermissionsForUser } = require('../../config/permissions');
const AppError = require('../../utils/AppError');

const hasOrderAdminAccess = (user) => getPermissionsForUser(user).includes(PERMISSIONS.ORDERS_READ);

const placeOrder = async (req, res, next) => {
  try {
    const result = await OrderService.placeOrder(req.user.id, req.validated);
    return success(res, result, 'Order placed successfully', 201);
  } catch (err) {
    next(err);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const isAdminSession = hasOrderAdminAccess(req.user);
    const result = await OrderService.getOrders(req.user.id, isAdminSession, page, limit, { status, search });
    return paginated(res, result.rows, result.count, page, limit);
  } catch (err) {
    next(err);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const isAdminSession = hasOrderAdminAccess(req.user);
    const order = await OrderService.getOrderById(req.params.id, req.user.id, isAdminSession);
    return success(res, order);
  } catch (err) {
    next(err);
  }
};

const getFulfillmentTracking = async (req, res, next) => {
  try {
    const isAdminSession = hasOrderAdminAccess(req.user);
    const tracking = await OrderService.getFulfillmentTracking(req.params.id, req.user.id, isAdminSession);
    return success(res, tracking);
  } catch (err) {
    next(err);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    if (!hasOrderAdminAccess(req.user)) {
      throw new AppError('FORBIDDEN', 403, 'You do not have permission to update order status');
    }
    const order = await OrderService.updateStatus(req.params.id, req.validated.status, req.user.id);
    req._auditAction = 'STATUS_CHANGE';
    req._auditChanges = { status: req.validated.status };
    return success(res, order, 'Order status updated');
  } catch (err) {
    next(err);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const order = await OrderService.cancelOrder(req.params.id, req.user.id);
    return success(res, order, 'Order cancelled');
  } catch (err) {
    next(err);
  }
};

const refundOrder = async (req, res, next) => {
  try {
    const isAdmin = hasOrderAdminAccess(req.user);
    const order = await OrderService.refundOrder(req.params.id, req.user.id, isAdmin);
    req._auditAction = 'STATUS_CHANGE';
    req._auditChanges = { status: 'refunded' };
    return success(res, order, 'Order refunded successfully');
  } catch (err) {
    next(err);
  }
};

const createFulfillment = async (req, res, next) => {
  try {
    const fulfillment = await OrderService.createFulfillment(req.params.id, req.validated, req.user.id);
    return success(res, fulfillment, 'Shipment created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const updateFulfillmentStatus = async (req, res, next) => {
  try {
    const result = await OrderService.updateFulfillmentStatus(
      req.params.id,
      req.params.fulfillmentId,
      req.validated.status,
      req.user.id
    );
    return success(res, result, 'Shipment status updated successfully');
  } catch (err) {
    next(err);
  }
};

const updateShipmentStatus = async (req, res, next) => {
  try {
    const result = await OrderService.updateShipmentStatus(
      req.params.id,
      req.params.shipmentId,
      req.validated,
      req.user.id
    );
    return success(res, result, 'Shipment updated successfully');
  } catch (err) {
    next(err);
  }
};

const createReturnRequest = async (req, res, next) => {
  try {
    const isAdmin = hasOrderAdminAccess(req.user);
    const result = await OrderService.createReturnRequest(req.params.id, req.validated, req.user.id, isAdmin);
    return success(res, result, 'Return request created', 201);
  } catch (err) {
    next(err);
  }
};

const createReplacementRequest = async (req, res, next) => {
  try {
    const isAdmin = hasOrderAdminAccess(req.user);
    const result = await OrderService.createReplacementRequest(req.params.id, req.validated, req.user.id, isAdmin);
    return success(res, result, 'Replacement request created', 201);
  } catch (err) {
    next(err);
  }
};

const updatePutBackStatus = async (req, res, next) => {
  try {
    const isAdmin = hasOrderAdminAccess(req.user);
    if (!isAdmin) {
      throw new AppError('FORBIDDEN', 403, 'You do not have permission to update return/replacement status');
    }
    const result = await OrderService.updatePutBackStatus(
      req.params.id,
      req.params.returnId,
      req.validated.status,
      req.user.id,
      isAdmin
    );
    return success(res, result, 'Return/replacement status updated');
  } catch (err) {
    next(err);
  }
};

const processRefund = async (req, res, next) => {
  try {
    const isAdmin = hasOrderAdminAccess(req.user);
    const result = await OrderService.processRefund(req.params.id, req.validated, req.user.id, isAdmin);
    return success(res, result, 'Refund processed', 201);
  } catch (err) {
    next(err);
  }
};

const addNote = async (req, res, next) => {
  try {
    if (!hasOrderAdminAccess(req.user)) {
      throw new AppError('FORBIDDEN', 403, 'You do not have permission to add notes to orders');
    }
    const event = await OrderService.addNote(req.params.id, req.validated.note, req.user.id);
    return success(res, event, 'Note added to order history', 201);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  placeOrder,
  getOrders,
  getOrderById,
  getFulfillmentTracking,
  updateStatus,
  cancelOrder,
  refundOrder,
  createFulfillment,
  updateFulfillmentStatus,
  updateShipmentStatus,
  createReturnRequest,
  createReplacementRequest,
  updatePutBackStatus,
  processRefund,
  addNote,
};
