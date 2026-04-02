'use strict';
const OrderService = require('./order.service');
const { success, paginated } = require('../../utils/response');

const placeOrder = async (req, res, next) => {
    try {
        const result = await OrderService.placeOrder(req.user.id, req.validated);
        return success(res, result, 'Order placed successfully', 201);
    } catch (err) { next(err); }
};

const getOrders = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        // If super_admin or admin hitting /orders, we treat them as fetching their own unless they explicitly want all 
        // Typically, /orders for everyone versus /admin/orders or based on role checks in service. 
        // The API.md says `GET /orders My orders (customer) / All orders (admin)`
        const isAdminSession = req.user.role === 'admin' || req.user.role === 'super_admin';
        // But an admin might want to view own orders? Usually we trust `isAdmin`
        const result = await OrderService.getOrders(req.user.id, isAdminSession, page, limit);
        return paginated(res, result.rows, { page, limit, total: result.count });
    } catch (err) { next(err); }
};

const getOrderById = async (req, res, next) => {
    try {
        const isAdminSession = req.user.role === 'admin' || req.user.role === 'super_admin';
        const order = await OrderService.getOrderById(req.params.id, req.user.id, isAdminSession);
        return success(res, order);
    } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
    try {
        const order = await OrderService.updateStatus(req.params.id, req.validated.status, req.user.id);
        return success(res, order, 'Order status updated');
    } catch (err) { next(err); }
};

const cancelOrder = async (req, res, next) => {
    try {
        const order = await OrderService.cancelOrder(req.params.id, req.user.id);
        return success(res, order, 'Order cancelled');
    } catch (err) { next(err); }
};

module.exports = {
    placeOrder,
    getOrders,
    getOrderById,
    updateStatus,
    cancelOrder
};
