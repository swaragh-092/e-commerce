'use strict';
const Joi = require('joi');
const { ORDER_STATUS_VALUES } = require('../../utils/orderWorkflow');

const placeOrderSchema = Joi.object({
    shippingAddressId: Joi.string().uuid().required(),
    couponCode: Joi.string().max(50).uppercase().optional().allow(null, ''),
    couponCodes: Joi.array().items(Joi.string().max(50).uppercase()).optional().default([]),
    notes: Joi.string().allow(null, ''),
    paymentMethod: Joi.string().valid('razorpay', 'stripe', 'payu', 'cashfree', 'cod').default('razorpay'),
    shippingQuoteId: Joi.string().uuid().optional(),
    checkoutSessionId: Joi.string().uuid().optional(),
    buyNowItem: Joi.object({
        productId: Joi.string().uuid().required(),
        variantId: Joi.string().uuid().allow(null),
        quantity: Joi.number().integer().min(1).default(1),
    }).optional(),
});

const updateOrderStatusSchema = Joi.object({
    status: Joi.string().valid(...ORDER_STATUS_VALUES).required()
});

const FULFILLMENT_STATUS_VALUES = ['pending', 'shipped', 'delivered', 'returned'];

const createFulfillmentSchema = Joi.object({
    trackingNumber: Joi.string().max(255).allow(null, ''),
    courier: Joi.string().max(100).allow(null, ''),
    notes: Joi.string().allow(null, ''),
    status: Joi.string().valid(...FULFILLMENT_STATUS_VALUES).default('pending'),
    providerId: Joi.string().uuid().allow(null).optional(),
    items: Joi.array().items(Joi.object({
        orderItemId: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).required(),
    })).min(1).required(),
});

const updateFulfillmentStatusSchema = Joi.object({
    status: Joi.string().valid(...FULFILLMENT_STATUS_VALUES).required()
});

module.exports = {
    placeOrderSchema,
    updateOrderStatusSchema,
    createFulfillmentSchema,
    updateFulfillmentStatusSchema,
};
