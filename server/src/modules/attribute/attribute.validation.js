'use strict';

const Joi = require('joi');

// --- Attribute Template schemas ---

const createAttributeSchema = Joi.object({
    name: Joi.string().max(100).required()
        .messages({ 'any.required': 'Attribute name is required' }),
    sortOrder: Joi.number().integer().min(0).default(0),
});

const updateAttributeSchema = Joi.object({
    name: Joi.string().max(100),
    sortOrder: Joi.number().integer().min(0),
}).min(1).messages({ 'object.min': 'At least one field is required to update' });

// --- Attribute Value schemas ---

const addValueSchema = Joi.object({
    value: Joi.string().max(100).required()
        .messages({ 'any.required': 'Value is required' }),
    sortOrder: Joi.number().integer().min(0).default(0),
});

// --- Category-Attribute link schemas ---

const linkAttributeSchema = Joi.object({
    attributeId: Joi.string().uuid().required()
        .messages({ 'any.required': 'Attribute ID is required' }),
});

// --- Bulk Variant Generator schema ---

const bulkGenerateSchema = Joi.object({
    attributes: Joi.array().items(
        Joi.object({
            name: Joi.string().max(100).required(),
            values: Joi.array().items(Joi.string().max(100)).min(1).required(),
        })
    ).min(1).required()
        .messages({ 'any.required': 'At least one attribute with values is required' }),
});

// --- Clone Variants schema ---

const cloneVariantsSchema = Joi.object({
    sourceProductId: Joi.string().uuid().required()
        .messages({ 'any.required': 'Source product ID is required' }),
});

// --- Single Variant CRUD schemas ---

const singleVariantSchema = Joi.object({
    name: Joi.string().max(100).required()
        .messages({ 'any.required': 'Attribute name is required' }),
    value: Joi.string().max(100).required()
        .messages({ 'any.required': 'Value is required' }),
    priceModifier: Joi.number().precision(2).default(0),
    quantity: Joi.number().integer().min(0).default(0),
    sku: Joi.string().max(100).allow('', null).optional(),
});

const updateVariantSchema = Joi.object({
    name: Joi.string().max(100),
    value: Joi.string().max(100),
    priceModifier: Joi.number().precision(2),
    quantity: Joi.number().integer().min(0),
    sku: Joi.string().max(100).allow('', null),
}).min(1);

module.exports = {
    createAttributeSchema,
    updateAttributeSchema,
    addValueSchema,
    linkAttributeSchema,
    bulkGenerateSchema,
    cloneVariantsSchema,
    singleVariantSchema,
    updateVariantSchema,
};
