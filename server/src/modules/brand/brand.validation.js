'use strict';

const Joi = require('joi');

const createBrandSchema = Joi.object({
    name: Joi.string().max(255).required(),
    slug: Joi.string().max(255).lowercase().allow('').optional(),
    description: Joi.string().max(2000).allow('', null).optional(),
    image: Joi.string().max(500).allow('', null).optional(),
    isActive: Joi.boolean().optional(),
    isPromoted: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
});

const updateBrandSchema = Joi.object({
    name: Joi.string().max(255).optional(),
    slug: Joi.string().max(255).lowercase().allow('').optional(),
    description: Joi.string().max(2000).allow('', null).optional(),
    image: Joi.string().max(500).allow('', null).optional(),
    isActive: Joi.boolean().optional(),
    isPromoted: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
});

const queryBrandSchema = Joi.object({
    search: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
    isPromoted: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
    withPublishedProducts: Joi.boolean().optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(1000).optional(),
    sortBy: Joi.string().valid('name', 'createdAt', 'updatedAt').optional(),
    sortOrder: Joi.string().valid('ASC', 'DESC').optional(),
});

const getBrandBySlugSchema = Joi.object({
    productLimit: Joi.number().integer().min(1).max(100).optional(),
});

module.exports = {
    createBrandSchema,
    updateBrandSchema,
    queryBrandSchema,
    getBrandBySlugSchema,
};
