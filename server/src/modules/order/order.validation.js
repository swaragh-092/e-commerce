'use strict';
const Joi = require('joi');

const placeOrderSchema = Joi.object({
    shippingAddressId: Joi.string().uuid().required(),
    couponCode: Joi.string().max(50).uppercase().optional().allow(null, ''),
    notes: Joi.string().allow(null, '')
});

const updateOrderStatusSchema = Joi.object({
    status: Joi.string().valid('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded').required()
});

module.exports = {
    placeOrderSchema,
    updateOrderStatusSchema
};
