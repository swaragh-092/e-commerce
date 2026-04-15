'use strict';

const Joi = require('joi');

const sharedProductAttributeFields = {
    isVariantAttr: Joi.boolean().default(false),
    sortOrder: Joi.number().integer().min(0).default(0),
};

const addProductAttributeSchema = Joi.alternatives().try(
    Joi.object({
        attributeId: Joi.string().uuid().required()
            .messages({ 'any.required': 'attributeId is required for global attributes' }),
        valueId: Joi.string().uuid().required()
            .messages({ 'any.required': 'valueId is required for global attributes' }),
        customName: Joi.forbidden(),
        customValue: Joi.forbidden(),
        ...sharedProductAttributeFields,
    }),
    Joi.object({
        attributeId: Joi.forbidden(),
        valueId: Joi.forbidden(),
        customName: Joi.string().max(100).required()
            .messages({ 'any.required': 'customName is required for custom attributes' }),
        customValue: Joi.string().max(255).required()
            .messages({ 'any.required': 'customValue is required for custom attributes' }),
        ...sharedProductAttributeFields,
    })
).messages({
    'alternatives.match': 'Provide either attributeId + valueId or customName + customValue',
});

const updateProductAttributeSchema = Joi.object({
    valueId: Joi.string().uuid(),
    customValue: Joi.string().max(255),
    isVariantAttr: Joi.boolean(),
    sortOrder: Joi.number().integer().min(0),
}).min(1).messages({ 'object.min': 'At least one field is required to update' });

const generateVariantsSchema = Joi.object({
    defaultPrice: Joi.number().precision(2).min(0),
    defaultStockQty: Joi.number().integer().min(0).default(0),
});

const addVariantSchema = Joi.object({
    sku: Joi.string().max(100).allow('', null).optional(),
    price: Joi.number().precision(2).min(0).required()
        .messages({ 'any.required': 'price is required' }),
    stockQty: Joi.number().integer().min(0).default(0),
    isActive: Joi.boolean().default(true),
    sortOrder: Joi.number().integer().min(0).default(0),
    options: Joi.array().items(
        Joi.object({
            attributeId: Joi.string().uuid().required(),
            valueId: Joi.string().uuid().required(),
        })
    ).min(1).required()
        .messages({ 'any.required': 'options are required - each variant needs at least one attribute+value' }),
});

const updateVariantSchema = Joi.object({
    sku: Joi.string().max(100).allow('', null),
    price: Joi.number().precision(2).min(0),
    stockQty: Joi.number().integer().min(0),
    isActive: Joi.boolean(),
    sortOrder: Joi.number().integer().min(0),
}).min(1).messages({ 'object.min': 'At least one field is required to update' });

module.exports = {
    addProductAttributeSchema,
    updateProductAttributeSchema,
    generateVariantsSchema,
    addVariantSchema,
    updateVariantSchema,
};
