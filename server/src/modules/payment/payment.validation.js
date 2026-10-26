'use strict';
const Joi = require('joi');

const createOrderSchema = Joi.object({
    orderId: Joi.string().uuid().required()
});

const gatewayIdParamSchema = Joi.object({
    id: Joi.string().valid('razorpay', 'cashfree', 'stripe', 'payu').required(),
});

// Verify body: provider-specific shapes, unknown keys rejected to catch
// client bugs early. Cashfree needs no extra fields (server fetches status).
const verifyPaymentSchema = Joi.object({
    provider: Joi.string().valid('razorpay', 'cashfree', 'stripe', 'payu').optional(),
    razorpay_order_id: Joi.string().max(255).optional(),
    razorpay_payment_id: Joi.string().max(255).optional(),
    razorpay_signature: Joi.string().max(512).optional(),
    session_id: Joi.string().max(255).optional(),
}).unknown(false);

const markFailedSchema = Joi.object({
    reason: Joi.string().max(500).allow(null, '').optional(),
});

const codConfirmSchema = Joi.object({
    amount: Joi.number().positive().precision(2).optional(),
});

module.exports = { createOrderSchema, gatewayIdParamSchema, verifyPaymentSchema, markFailedSchema, codConfirmSchema };
