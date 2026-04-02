'use strict';
const Joi = require('joi');

const createCouponSchema = Joi.object({
    code: Joi.string().max(50).uppercase().required(),
    type: Joi.string().valid('percentage', 'fixed_amount').required(),
    value: Joi.number().positive().required(),
    minOrderAmount: Joi.number().min(0).default(0),
    maxDiscount: Joi.number().min(0).optional(),
    usageLimit: Joi.number().integer().min(1).optional(),
    perUserLimit: Joi.number().integer().min(1).default(1),
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().required(), 
    isActive: Joi.boolean().default(true),
    applicableTo: Joi.string().valid('all', 'category', 'product').default('all'),
    applicableIds: Joi.array().items(Joi.string().uuid()).optional()
});

const updateCouponSchema = Joi.object({
    code: Joi.string().max(50).uppercase().optional(),
    type: Joi.string().valid('percentage', 'fixed_amount').optional(),
    value: Joi.number().positive().optional(),
    minOrderAmount: Joi.number().min(0).optional(),
    maxDiscount: Joi.number().min(0).optional(),
    usageLimit: Joi.number().integer().min(1).optional(),
    perUserLimit: Joi.number().integer().min(1).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    isActive: Joi.boolean().optional(),
    applicableTo: Joi.string().valid('all', 'category', 'product').optional(),
    applicableIds: Joi.array().items(Joi.string().uuid()).optional()
});

const validateCouponSchema = Joi.object({
    code: Joi.string().max(50).uppercase().required(),
    subtotal: Joi.number().min(0).required()
});

module.exports = {
    createCouponSchema,
    updateCouponSchema,
    validateCouponSchema
};
