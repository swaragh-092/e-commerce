'use strict';

const Joi = require('joi');

const createCategorySchema = Joi.object({
    name: Joi.string().max(255).required(),
    description: Joi.string().allow('', null),
    parentId: Joi.string().uuid().allow(null),
    image: Joi.string().max(500).allow('', null),
    icon: Joi.string().max(500).allow('', null),
    sortOrder: Joi.number().integer().default(0),
    bannerImage: Joi.string().max(2000).allow('', null),
    customHeading: Joi.string().max(255).allow('', null),
    metaTitle: Joi.string().max(255).allow('', null),
    metaDescription: Joi.string().max(500).allow('', null),
    metaKeywords: Joi.string().max(500).allow('', null),
    ogImage: Joi.string().max(500).allow('', null),
});

const updateCategorySchema = Joi.object({
    name: Joi.string().max(255),
    description: Joi.string().allow('', null),
    parentId: Joi.string().uuid().allow(null),
    image: Joi.string().max(500).allow('', null),
    icon: Joi.string().max(500).allow('', null),
    sortOrder: Joi.number().integer(),
    bannerImage: Joi.string().max(2000).allow('', null),
    customHeading: Joi.string().max(255).allow('', null),
    metaTitle: Joi.string().max(255).allow('', null),
    metaDescription: Joi.string().max(500).allow('', null),
    metaKeywords: Joi.string().max(500).allow('', null),
    ogImage: Joi.string().max(500).allow('', null),
}).min(1);

const getCategoryProductsQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(1000).default(20),
    sort: Joi.string().valid('newest', 'price_asc', 'price_desc', 'name_asc').default('newest'),
    minPrice: Joi.number().min(0).allow('', null),
    maxPrice: Joi.number().min(0).allow('', null),
    includeSubcategories: Joi.boolean().truthy('1', 'true', 'yes').falsy('0', 'false', 'no').default(true),
});

module.exports = {
    createCategorySchema,
    updateCategorySchema,
    getCategoryProductsQuerySchema,
};
