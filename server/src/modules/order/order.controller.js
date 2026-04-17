'use strict';
const OrderService = require('./order.service');
const { success, paginated } = require('../../utils/response');
const { PERMISSIONS, getPermissionsForUser } = require('../../config/permissions');

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

const updateStatus = async (req, res, next) => {
  try {
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
    const order = await OrderService.refundOrder(req.params.id, req.user.id);
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

module.exports = {
  placeOrder,
  getOrders,
  getOrderById,
  updateStatus,
  cancelOrder,
  refundOrder,
  createFulfillment,
};
