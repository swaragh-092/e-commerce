'use strict';
const Joi = require('joi');

const createOrderSchema = Joi.object({
    orderId: Joi.string().uuid().required()
});

const gatewayIdParamSchema = Joi.object({
    id: Joi.string().valid('razorpay', 'cashfree', 'stripe', 'payu').required(),
});

module.exports = { createOrderSchema, gatewayIdParamSchema };
