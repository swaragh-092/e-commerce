'use strict';
const Joi = require('joi');

exports.updateMediaSchema = Joi.object({
    alt: Joi.string().max(255).allow(null, '').optional(),
    description: Joi.string().allow(null, '').optional(),
    caption: Joi.string().max(255).allow(null, '').optional(),
    originalName: Joi.string().max(255).optional(),
});

exports.listMediaSchema = Joi.object({
    page: Joi.number().integer().min(1).optional().default(1),
    limit: Joi.number().integer().min(1).max(1000).optional().default(20),
    sortBy: Joi.string().valid('createdAt', 'size', 'originalName', 'filename', 'date', 'name').optional().default('createdAt'),
    sortDir: Joi.string().valid('asc', 'desc').optional().default('desc'),
});
