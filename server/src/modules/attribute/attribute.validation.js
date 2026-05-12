'use strict';

const Joi = require('joi');

// --- Attribute Template schemas ---
const displayTypes = ['auto', 'swatch', 'image', 'button', 'chip', 'radio', 'dropdown', 'text'];
const valueTypes = ['auto', 'color', 'size', 'weight', 'length', 'storage', 'volume', 'material', 'pattern', 'text', 'number'];

const createAttributeSchema = Joi.object({
    name: Joi.string().max(100).required()
        .messages({ 'any.required': 'Attribute name is required' }),
    sortOrder: Joi.number().integer().min(0).default(0),
    displayType: Joi.string().valid(...displayTypes).default('auto'),
    valueType: Joi.string().valid(...valueTypes).default('auto'),
    unit: Joi.string().max(20).allow('', null),
});

const updateAttributeSchema = Joi.object({
    name: Joi.string().max(100),
    sortOrder: Joi.number().integer().min(0),
    displayType: Joi.string().valid(...displayTypes),
    valueType: Joi.string().valid(...valueTypes),
    unit: Joi.string().max(20).allow('', null),
}).min(1).messages({ 'object.min': 'At least one field is required to update' });

// --- Attribute Value schemas ---

const addValueSchema = Joi.object({
    value: Joi.string().max(100).required()
        .messages({ 'any.required': 'Value is required' }),
    sortOrder: Joi.number().integer().min(0).default(0),
    displayLabel: Joi.string().max(100).allow('', null),
    swatchColor: Joi.string().max(32).allow('', null),
    imageUrl: Joi.string().max(500).allow('', null),
    unitLabel: Joi.string().max(20).allow('', null),
    metadata: Joi.object().default({}),
});

const updateValueSchema = Joi.object({
    value: Joi.string().max(100),
    sortOrder: Joi.number().integer().min(0),
    displayLabel: Joi.string().max(100).allow('', null),
    swatchColor: Joi.string().max(32).allow('', null),
    imageUrl: Joi.string().max(500).allow('', null),
    unitLabel: Joi.string().max(20).allow('', null),
    metadata: Joi.object(),
}).min(1).messages({ 'object.min': 'At least one field is required to update' });

// --- Category-Attribute link schemas ---

const linkAttributeSchema = Joi.object({
    attributeId: Joi.string().uuid().required()
        .messages({ 'any.required': 'Attribute ID is required' }),
});

// --- Clone Variants schema ---

const cloneVariantsSchema = Joi.object({
    sourceProductId: Joi.string().uuid().required()
        .messages({ 'any.required': 'Source product ID is required' }),
});

module.exports = {
    createAttributeSchema,
    updateAttributeSchema,
    addValueSchema,
    updateValueSchema,
    linkAttributeSchema,
    cloneVariantsSchema,
};
