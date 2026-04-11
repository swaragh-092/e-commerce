'use strict';
const Joi = require('joi');

const placeOrderSchema = Joi.object({
    shippingAddressId: Joi.string().uuid().required(),
    couponCode: Joi.string().max(50).uppercase().optional().allow(null, ''),
    couponCodes: Joi.array().items(Joi.string().max(50).uppercase()).optional().default([]),
    notes: Joi.string().allow(null, ''),
    buyNowItem: Joi.object({
        productId: Joi.string().uuid().required(),
        variantId: Joi.string().uuid().allow(null),
        quantity: Joi.number().integer().min(1).default(1),
    }).optional(),
});

const updateOrderStatusSchema = Joi.object({
    status: Joi.string().valid('pending_payment', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded').required()
});

module.exports = {
    placeOrderSchema,
    updateOrderStatusSchema
};
