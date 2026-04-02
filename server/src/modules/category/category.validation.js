'use strict';

const Joi = require('joi');

const createCategorySchema = Joi.object({
    name: Joi.string().max(255).required(),
    description: Joi.string().allow('', null),
    parentId: Joi.string().uuid().allow(null),
    image: Joi.string().uri().allow('', null),
    sortOrder: Joi.number().integer().default(0)
});

const updateCategorySchema = Joi.object({
    name: Joi.string().max(255),
    description: Joi.string().allow('', null),
    parentId: Joi.string().uuid().allow(null),
    image: Joi.string().uri().allow('', null),
    sortOrder: Joi.number().integer()
}).min(1);

module.exports = {
    createCategorySchema,
    updateCategorySchema
};
