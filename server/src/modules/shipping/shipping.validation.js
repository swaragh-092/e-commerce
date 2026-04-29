'use strict';

const Joi = require('joi');

const buyNowItemSchema = Joi.object({
    productId: Joi.string().uuid().required(),
    variantId: Joi.string().uuid().allow(null),
    quantity: Joi.number().integer().min(1).default(1),
});

const calculateShippingSchema = Joi.object({
    shippingAddressId: Joi.string().uuid().required(),
    checkoutSessionId: Joi.string().uuid().optional(),
    paymentMethod: Joi.string().valid('razorpay', 'stripe', 'payu', 'cashfree', 'cod').default('razorpay'),
    couponCode: Joi.string().max(50).uppercase().optional().allow(null, ''),
    couponCodes: Joi.array().items(Joi.string().max(50).uppercase()).optional().default([]),
    buyNowItem: buyNowItemSchema.optional(),
});

const providerUpdateSchema = Joi.object({
    name: Joi.string().max(100).optional(),
    enabled: Joi.boolean().optional(),
    isDefault: Joi.boolean().optional(),
    mode: Joi.string().max(50).optional(),
    supportsCod: Joi.boolean().optional(),
    supportsReturns: Joi.boolean().optional(),
    supportsReversePickup: Joi.boolean().optional(),
    supportsHeavyItems: Joi.boolean().optional(),
    supportsFragileItems: Joi.boolean().optional(),
    maxWeightKg: Joi.number().min(0).allow(null).optional(),
    maxLengthCm: Joi.number().min(0).allow(null).optional(),
    maxBreadthCm: Joi.number().min(0).allow(null).optional(),
    maxHeightCm: Joi.number().min(0).allow(null).optional(),
    supportedRegions: Joi.array().items(Joi.string()).optional(),
    blockedRegions: Joi.array().items(Joi.string()).optional(),
    credentials: Joi.object().unknown(true).optional(),
    settings: Joi.object().unknown(true).optional(),
});

const zoneSchema = Joi.object({
    name: Joi.string().max(100).required(),
    country: Joi.string().max(100).allow(null, '').optional(),
    state: Joi.string().max(100).allow(null, '').optional(),
    city: Joi.string().max(100).allow(null, '').optional(),
    pincodes: Joi.array().items(Joi.string().max(20)).optional().default([]),
    blockedPincodes: Joi.array().items(Joi.string().max(20)).optional().default([]),
    enabled: Joi.boolean().optional().default(true),
});

const zoneUpdateSchema = Joi.object({
    name: Joi.string().max(100).optional(),
    country: Joi.string().max(100).allow(null, '').optional(),
    state: Joi.string().max(100).allow(null, '').optional(),
    city: Joi.string().max(100).allow(null, '').optional(),
    pincodes: Joi.array().items(Joi.string().max(20)).optional(),
    blockedPincodes: Joi.array().items(Joi.string().max(20)).optional(),
    enabled: Joi.boolean().optional(),
});

const ruleSchema = Joi.object({
    name: Joi.string().max(150).required(),
    priority: Joi.number().integer().optional().default(100),
    enabled: Joi.boolean().optional().default(true),
    strictOverride: Joi.boolean().optional().default(false),
    zoneId: Joi.string().uuid().allow(null).optional(),
    providerId: Joi.string().uuid().allow(null).optional(),
    conditionType: Joi.string().max(50).optional().default('all'),
    conditions: Joi.object().unknown(true).optional().default({}),
    rateType: Joi.string().valid(
        'free',
        'flat',
        'free_above_threshold',
        'per_kg_slab',        // base charge + per-500g slabs with zone multiplier
        'volumetric',         // alias for per_kg_slab emphasising volumetric billing
        'percent_of_order'    // X% of cart subtotal
    ).optional().default('flat'),
    rateConfig: Joi.object().unknown(true).optional().default({}),
    codAllowed: Joi.boolean().optional().default(true),
    codFee: Joi.number().min(0).optional().default(0),
    estimatedMinDays: Joi.number().integer().min(0).allow(null).optional(),
    estimatedMaxDays: Joi.number().integer().min(0).allow(null).optional(),
}).custom((value, helpers) => {
    if (value.estimatedMinDays != null && value.estimatedMaxDays != null && value.estimatedMinDays > value.estimatedMaxDays) {
        return helpers.message('estimatedMinDays must be <= estimatedMaxDays');
    }
    return value;
});

const ruleUpdateSchema = Joi.object({
    name: Joi.string().max(150).optional(),
    priority: Joi.number().integer().optional(),
    enabled: Joi.boolean().optional(),
    strictOverride: Joi.boolean().optional(),
    zoneId: Joi.string().uuid().allow(null).optional(),
    providerId: Joi.string().uuid().allow(null).optional(),
    conditionType: Joi.string().max(50).optional(),
    conditions: Joi.object().unknown(true).optional(),
    rateType: Joi.string().valid(
        'free',
        'flat',
        'free_above_threshold',
        'per_kg_slab',
        'volumetric',
        'percent_of_order'
    ).optional(),
    rateConfig: Joi.object().unknown(true).optional(),
    codAllowed: Joi.boolean().optional(),
    codFee: Joi.number().min(0).optional(),
    estimatedMinDays: Joi.number().integer().min(0).allow(null).optional(),
    estimatedMaxDays: Joi.number().integer().min(0).allow(null).optional(),
}).custom((value, helpers) => {
    if (value.estimatedMinDays != null && value.estimatedMaxDays != null && value.estimatedMinDays > value.estimatedMaxDays) {
        return helpers.message('estimatedMinDays must be <= estimatedMaxDays');
    }
    return value;
});

module.exports = {
    calculateShippingSchema,
    providerUpdateSchema,
    zoneSchema,
    zoneUpdateSchema,
    ruleSchema,
    ruleUpdateSchema,
};
