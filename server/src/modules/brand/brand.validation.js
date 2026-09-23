'use strict';

const Joi = require('joi');

const createBrandSchema = Joi.object({
    name: Joi.string().max(255).required(),
    slug: Joi.string().max(255).lowercase().allow('').optional(),
    description: Joi.string().max(2000).allow('', null).optional(),
    image: Joi.string().uri({ allowRelative: true }).max(500).allow('', null).optional(),
    isActive: Joi.boolean().optional(),
    isPromoted: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
});

const updateBrandSchema = Joi.object({
    name: Joi.string().max(255).optional(),
    slug: Joi.string().max(255).lowercase().allow('').optional(),
    description: Joi.string().max(2000).allow('', null).optional(),
    image: Joi.string().uri({ allowRelative: true }).max(500).allow('', null).optional(),
    isActive: Joi.boolean().optional(),
    isPromoted: Joi.boolean().optional(),
    isFeatured: Joi.boolean().optional(),
}).min(1).messages({
    'object.min': 'At least one field is required to update',
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
    productOffset: Joi.number().integer().min(0).optional(),
    productSortBy: Joi.string().valid('name', 'price', 'createdAt', 'updatedAt').optional(),
    productSortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').optional(),
});

const slugParamSchema = Joi.object({
    slug: Joi.string().max(255).pattern(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/).required(),
});

module.exports = {
    createBrandSchema,
    updateBrandSchema,
    queryBrandSchema,
    getBrandBySlugSchema,
    slugParamSchema,
};
