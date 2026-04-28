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

module.exports = { createOrder, verifyPayment, handleWebhook, handleCashfreeWebhook, confirmCodPayment, getGatewayStatuses, saveGatewayCredentials };
