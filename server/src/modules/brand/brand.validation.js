'use strict';

const Joi = require('joi');

const createBrandSchema = Joi.object({
    name: Joi.string().max(255).required(),
    slug: Joi.string().max(255).lowercase().allow('').optional(),
    description: Joi.string().allow('', null).optional(),
    image: Joi.string().max(500).allow('', null).optional(),
    isActive: Joi.boolean().optional(),
});

const updateBrandSchema = Joi.object({
    name: Joi.string().max(255).optional(),
    slug: Joi.string().max(255).lowercase().allow('').optional(),
    description: Joi.string().allow('', null).optional(),
    image: Joi.string().max(500).allow('', null).optional(),
    isActive: Joi.boolean().optional(),
});

const queryBrandSchema = Joi.object({
    search: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sortBy: Joi.string().valid('name', 'created_at', 'updated_at').optional(),
    sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
});

module.exports = {
    createBrandSchema,
    updateBrandSchema,
    queryBrandSchema,
};
