'use strict';
const Joi = require('joi');
const {
    ORDER_STATUS_VALUES,
    SHIPMENT_STATUS_VALUES,
    ORDER_SHIPPING_STATUS_VALUES,
    PUT_BACK_RECORD_STATUS_VALUES,
    LEGACY_PUT_BACK_STATUS_VALUES,
    REFUND_STATUS_VALUES,
} = require('../../utils/orderWorkflow');

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

const FULFILLMENT_STATUS_VALUES = ['pending', ...SHIPMENT_STATUS_VALUES];

const createFulfillmentSchema = Joi.object({
    trackingNumber: Joi.string().max(255).allow(null, ''),
    courier: Joi.string().max(100).allow(null, ''),
    expectedDeliveryDate: Joi.date().iso().allow(null).optional(),
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

const updateShipmentStatusSchema = Joi.object({
    status: Joi.string().valid(...SHIPMENT_STATUS_VALUES).optional(),
    trackingNumber: Joi.string().max(255).allow(null, '').optional(),
    trackingUrl: Joi.string().uri().max(500).allow(null, '').optional(),
    courierName: Joi.string().max(100).allow(null, '').optional(),
    expectedDeliveryDate: Joi.date().iso().optional(),
}).or('status', 'trackingNumber', 'trackingUrl', 'courierName', 'expectedDeliveryDate');

const putBackItemSchema = Joi.object({
    orderItemId: Joi.string().uuid().required(),
    shipmentItemId: Joi.string().uuid().allow(null).optional(),
    quantity: Joi.number().integer().min(1).required(),
    reason: Joi.string().allow(null, '').optional(),
    metadata: Joi.object().unknown(true).optional(),
});

const createPutBackSchema = Joi.object({
    reason: Joi.string().allow(null, '').optional(),
    metadata: Joi.object().unknown(true).optional(),
    items: Joi.array().items(putBackItemSchema).min(1).required(),
});

const updatePutBackStatusSchema = Joi.object({
    status: Joi.string().valid(...PUT_BACK_RECORD_STATUS_VALUES, ...LEGACY_PUT_BACK_STATUS_VALUES).required(),
});

const processRefundSchema = Joi.object({
    returnId: Joi.string().uuid().allow(null).optional(),
    amount: Joi.number().positive().optional(),
    status: Joi.string().valid(...REFUND_STATUS_VALUES).optional(),
    providerRefundId: Joi.string().max(255).allow(null, '').optional(),
    reason: Joi.string().allow(null, '').optional(),
    metadata: Joi.object().unknown(true).optional(),
});

const addOrderNoteSchema = Joi.object({
    note: Joi.string().max(1000).required(),
});

// Include storefront display statuses (delivered, shipped, placed) that the customer-facing UI uses as filters
const ALLOWED_STATUS_FILTER_VALUES = [...ORDER_STATUS_VALUES, 'delivered', 'shipped', 'placed', 'out_for_delivery'];

const csvEnum = (allowed) => Joi.string().max(200).custom((value, helpers) => {
    const items = value.split(',').map(s => s.trim()).filter(Boolean);
    const invalid = items.filter(s => !allowed.includes(s));
    if (invalid.length) return helpers.error('any.invalid');
    return value;
});

const listOrdersQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: csvEnum(ALLOWED_STATUS_FILTER_VALUES).optional(),
    orderShippingStatus: csvEnum(ORDER_SHIPPING_STATUS_VALUES).optional(),
    search: Joi.string().max(200).trim().optional(),
    productId: Joi.string().uuid().optional(),
});

module.exports = {
    placeOrderSchema,
    updateOrderStatusSchema,
    createFulfillmentSchema,
    updateFulfillmentStatusSchema,
    updateShipmentStatusSchema,
    createPutBackSchema,
    updatePutBackStatusSchema,
    processRefundSchema,
    addOrderNoteSchema,
    listOrdersQuerySchema,
};
