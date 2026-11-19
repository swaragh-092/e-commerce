'use strict';
const Joi = require('joi');

const uuidArray = Joi.array().items(Joi.string().uuid()).default([]);
const couponType = Joi.string().valid('percentage', 'fixed_amount', 'free_shipping');
const applicableTo = Joi.string().valid('all', 'category', 'product', 'brand');
const visibility = Joi.string().valid('private', 'public');
const customerEligibility = Joi.string().valid('all', 'authenticated', 'first_order');
const campaignStatus = Joi.string().valid('draft', 'active', 'paused', 'archived');
const applicationMode = Joi.string().valid('manual', 'suggest', 'auto');
const stackingRules = Joi.object({
    allowOrderDiscounts: Joi.boolean().default(false),
    allowShippingDiscounts: Joi.boolean().default(true),
    allowMultipleCoupons: Joi.boolean().default(false),
}).default({
    allowOrderDiscounts: false,
    allowShippingDiscounts: true,
    allowMultipleCoupons: false,
});

const createCouponSchema = Joi.object({
    code: Joi.string().trim().max(50).uppercase().required(),
    name: Joi.string().trim().max(255).required(),
    description: Joi.string().allow('', null).optional(),
    type: couponType.required(),
    value: Joi.number().precision(2).when('type', {
        is: 'free_shipping',
        then: Joi.number().min(0).max(0).default(0),
        otherwise: Joi.when('type', {
            is: 'percentage',
            then: Joi.number().min(0.01).max(100).required(),
            otherwise: Joi.number().min(0.01).max(99999999.99).required(),
        }),
    }).required(),
    minOrderAmount: Joi.number().precision(2).min(0).max(99999999.99).default(0),
    maxDiscount: Joi.number().precision(2).min(0).max(99999999.99).allow(null).optional(),
    usageLimit: Joi.number().integer().min(1).max(2147483647).allow(null).optional(),
    perUserLimit: Joi.number().integer().min(1).max(2147483647).default(1),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).required(), 
    isActive: Joi.boolean().default(true),
    campaignStatus: campaignStatus.default('active'),
    applicationMode: applicationMode.default('manual'),
    stackingRules,
    applicableTo: applicableTo.default('all'),
    applicableIds: uuidArray,
    excludedProductIds: uuidArray,
    excludedCategoryIds: uuidArray,
    excludedBrandIds: uuidArray,
    excludeSaleItems: Joi.boolean().default(false),
    visibility: visibility.default('private'),
    customerEligibility: customerEligibility.default('all'),
    isExclusive: Joi.boolean().default(false),
    priority: Joi.number().integer().min(0).max(2147483647).default(0),
});

const updateCouponSchema = Joi.object({
    code: Joi.string().trim().max(50).uppercase().optional(),
    name: Joi.string().trim().max(255).optional(),
    description: Joi.string().allow('', null).optional(),
    type: couponType.optional(),
    value: Joi.number().precision(2).min(0).max(99999999.99).optional(),
    minOrderAmount: Joi.number().precision(2).min(0).max(99999999.99).optional(),
    maxDiscount: Joi.number().precision(2).min(0).max(99999999.99).allow(null).optional(),
    usageLimit: Joi.number().integer().min(1).max(2147483647).allow(null).optional(),
    perUserLimit: Joi.number().integer().min(1).max(2147483647).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().when('startDate', {
        is: Joi.exist(),
        then: Joi.date().iso().greater(Joi.ref('startDate')),
        otherwise: Joi.date().iso(),
    }).optional(),
    isActive: Joi.boolean().optional(),
    campaignStatus: campaignStatus.optional(),
    applicationMode: applicationMode.optional(),
    stackingRules: stackingRules.optional(),
    applicableTo: applicableTo.optional(),
    applicableIds: uuidArray.optional(),
    excludedProductIds: uuidArray.optional(),
    excludedCategoryIds: uuidArray.optional(),
    excludedBrandIds: uuidArray.optional(),
    excludeSaleItems: Joi.boolean().optional(),
    visibility: visibility.optional(),
    customerEligibility: customerEligibility.optional(),
    isExclusive: Joi.boolean().optional(),
    priority: Joi.number().integer().min(0).max(2147483647).optional(),
});

const buyNowItemSchema = Joi.object({
    productId: Joi.string().uuid().required(),
    variantId: Joi.string().uuid().allow(null),
    quantity: Joi.number().integer().min(1).default(1),
});

const validateCouponSchema = Joi.object({
    code: Joi.string().trim().max(50).uppercase().required(),
    subtotal: Joi.number().precision(2).min(0).max(99999999.99).required(),
    shippingCost: Joi.number().precision(2).min(0).max(99999999.99).optional(),
    email: Joi.string().trim().email().optional(),
    buyNowItem: buyNowItemSchema.optional(),
});

const eligibleCouponsSchema = Joi.object({
    subtotal: Joi.number().precision(2).min(0).max(99999999.99).optional(),
    shippingCost: Joi.number().precision(2).min(0).max(99999999.99).optional(),
    email: Joi.string().trim().email().optional(),
    buyNowItem: buyNowItemSchema.optional(),
});

module.exports = {
    createCouponSchema,
    updateCouponSchema,
    validateCouponSchema,
    eligibleCouponsSchema,
};
