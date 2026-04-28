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
        const payload = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString('utf8')) : req.body;
        const result = await PaymentService.handleWebhook(payload, signature);
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
        res.redirect('/payment/failure');
    }
};

const confirmCodPayment = async (req, res, next) => {
    try {
        const result = await PaymentService.confirmCodPayment(req.user.id, req.params.orderId);
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

module.exports = { createOrder, verifyPayment, handleWebhook, handleCashfreeWebhook, handleStripeWebhook, handlePayUReturn, confirmCodPayment, getGatewayStatuses, saveGatewayCredentials };
