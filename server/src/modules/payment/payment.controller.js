'use strict';
const PaymentService = require('./payment.service');
const { success } = require('../../utils/response');

const createIntent = async (req, res, next) => {
    try {
        const result = await PaymentService.createIntent(req.user.id, req.validated.orderId);
        return success(res, result);
    } catch (err) { next(err); }
};

const handleWebhook = async (req, res, next) => {
    try {
        const signature = req.headers['stripe-signature'];
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        
        // Wait, app.js already runs express.raw() only on /webhook endpoints BUT gives us req.body
        const result = await PaymentService.handleWebhook(req.body, signature, secret);
        res.json(result);
    } catch (err) { next(err); }
};

module.exports = { createIntent, handleWebhook };
