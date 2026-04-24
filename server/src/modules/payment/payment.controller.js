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
        const result = await PaymentService.handleWebhook(req.body, signature);
        return success(res, result, 'Webhook processed');
    } catch (err) { next(err); }
};

const confirmCodPayment = async (req, res, next) => {
    try {
        const result = await PaymentService.confirmCodPayment(req.user.id, req.params.orderId);
        return success(res, result, 'COD payment confirmed');
    } catch (err) { next(err); }
};

module.exports = { createOrder, verifyPayment, handleWebhook, confirmCodPayment };
