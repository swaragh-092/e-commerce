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

module.exports = {
    createCategorySchema,
    updateCategorySchema
};
