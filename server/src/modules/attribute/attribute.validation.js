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

// --- Clone Variants schema ---

const cloneVariantsSchema = Joi.object({
    sourceProductId: Joi.string().uuid().required()
        .messages({ 'any.required': 'Source product ID is required' }),
});

module.exports = {
    createAttributeSchema,
    updateAttributeSchema,
    addValueSchema,
    linkAttributeSchema,
    cloneVariantsSchema,
};
