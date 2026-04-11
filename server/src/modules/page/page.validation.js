'use strict';

const Joi = require('joi');

const createPageSchema = Joi.object({
    title: Joi.string().max(255).required(),
    content: Joi.string().required(),
    linkPosition: Joi.string().valid('top', 'bottom', 'none').default('none'),
    linkPlacement: Joi.string().max(50).allow(null, ''),
    metaTitle: Joi.string().allow(null, ''),
    metaDescription: Joi.string().allow(null, ''),
    bannerUrl: Joi.string().max(1000).allow(null, ''),
    status: Joi.string().valid('draft', 'published').default('draft'),
    sortOrder: Joi.number().integer().default(0),
    isSystem: Joi.boolean().default(false)
});

const updatePageSchema = Joi.object({
    title: Joi.string().max(255),
    content: Joi.string(),
    linkPosition: Joi.string().valid('top', 'bottom', 'none'),
    linkPlacement: Joi.string().max(50).allow(null, ''),
    metaTitle: Joi.string().allow(null, ''),
    metaDescription: Joi.string().allow(null, ''),
    bannerUrl: Joi.string().max(1000).allow(null, ''),
    status: Joi.string().valid('draft', 'published'),
    sortOrder: Joi.number().integer(),
    isSystem: Joi.boolean()
});

const queryPageSchema = Joi.object({
    page: Joi.number().integer().min(1),
    limit: Joi.number().integer().min(1).max(100),
    status: Joi.string().valid('draft', 'published'),
    search: Joi.string().allow(''),
    linkPosition: Joi.string().valid('top', 'bottom', 'none')
});

module.exports = {
    createPageSchema,
    updatePageSchema,
    queryPageSchema
};
