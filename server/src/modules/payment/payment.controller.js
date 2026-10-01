'use strict';
const PaymentService = require('./payment.service');
const { success } = require('../../utils/response');

const createOrder = async (req, res, next) => {
    try {
        const result = await PaymentService.createOrder(req.user.id, req.validated.orderId);
        return success(res, result);
    } catch (err) { next(err); }
};

const verifyPayment = async (req, res, next) => {
    try {
        const result = await PaymentService.verifyPayment(req.user.id, req.params.orderId, req.body);
        return success(res, result);
    } catch (err) { next(err); }
};

const handleWebhook = async (req, res, next) => {
    try {
        const signature = req.headers['x-razorpay-signature'];
        // Pass raw bytes through: service verifies HMAC over the exact raw
        // body Razorpay signed. Pre-parsing + JSON.stringify breaks this.
        const result = await PaymentService.handleWebhook(req.body, signature);
        return success(res, result, 'Webhook processed');
    } catch (err) { next(err); }
};

const handleCashfreeWebhook = async (req, res, next) => {
    try {
        const result = await PaymentService.handleCashfreeWebhook(req.body, req.headers);
        return success(res, result, 'Cashfree webhook processed');
    } catch (err) { next(err); }
};


const handleStripeWebhook = async (req, res, next) => {
    try {
        const signature = req.headers['stripe-signature'];
        const result = await PaymentService.handleStripeWebhook(req.body, signature);
        return success(res, result, 'Stripe webhook processed');
    } catch (err) { next(err); }
};

const handlePayUReturn = async (req, res, next) => {
    try {
        const result = await PaymentService.handlePayUReturn(req.body);
        const appUrl = process.env.CLIENT_URL?.split(',')[0] || process.env.APP_URL || 'http://localhost:3000';
        if (result.success) {
            res.redirect(`${appUrl}/payment/success?orderId=${result.orderId}`);
        } else {
            res.redirect(`${appUrl}/payment/failure?orderId=${result.orderId}&status=${result.status}`);
        }
    } catch (err) { 
        console.error(err);
        const appUrl = process.env.CLIENT_URL?.split(',')[0] || process.env.APP_URL || 'http://localhost:3000';
        res.redirect(`${appUrl}/payment/failure`);
    }
};

const markFailed = async (req, res, next) => {
    try {
        const { Order } = require('../index');
        const order = await Order.findOne({ where: { id: req.params.orderId, userId: req.user.id } });
        if (!order) {
            const err = new Error('Order not found');
            err.statusCode = 404;
            throw err;
        }
        const result = await PaymentService.markPaymentFailed({
            orderId: order.id,
            provider: order.paymentMethod,
            reason: req.validated?.reason || req.body?.reason || 'customer aborted payment',
        });
        return success(res, result, 'Payment marked as failed');
    } catch (err) { next(err); }
};

const confirmCodPayment = async (req, res, next) => {
    try {
        const result = await PaymentService.confirmCodPayment(req.user.id, req.params.orderId, req.body || {});
        return success(res, result, 'COD payment confirmed');
    } catch (err) { next(err); }
};

const getGatewayStatuses = async (req, res, next) => {
    try {
        const gateways = await PaymentService.getGatewayStatuses();
        return success(res, gateways);
    } catch (err) { next(err); }
};

const saveGatewayCredentials = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await PaymentService.saveGatewayCredentials(id, req.body, req.user.id);
        return success(res, result, 'Gateway credentials saved');
    } catch (err) { next(err); }
};

module.exports = { createOrder, verifyPayment, markFailed, handleWebhook, handleCashfreeWebhook, handleStripeWebhook, handlePayUReturn, confirmCodPayment, getGatewayStatuses, saveGatewayCredentials };
