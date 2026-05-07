'use strict';

const Joi = require('joi');

const menuLocations = ['header', 'footer', 'mobile', 'sidebar'];
const targetTypes = ['none', 'custom_url', 'page', 'category', 'product', 'collection', 'system_route'];
const placements = ['left', 'center', 'right', 'quick_links', 'footer_column', 'mobile', 'sidebar'];

const createMenuSchema = Joi.object({
    name: Joi.string().max(120).required(),
    slug: Joi.string().trim().max(120).pattern(/^[a-z0-9-]+$/).empty('').allow(null),
    location: Joi.string().valid(...menuLocations).default('header'),
    isActive: Joi.boolean().default(true),
    sortOrder: Joi.number().integer().default(0),
});

const updateMenuSchema = Joi.object({
    name: Joi.string().max(120),
    slug: Joi.string().trim().max(120).pattern(/^[a-z0-9-]+$/).empty('').allow(null),
    location: Joi.string().valid(...menuLocations),
    isActive: Joi.boolean(),
    sortOrder: Joi.number().integer(),
}).min(1);

const createMenuItemSchema = Joi.object({
    parentId: Joi.string().trim().uuid().empty('').allow(null),
    label: Joi.string().max(120).required(),
    targetType: Joi.string().valid(...targetTypes).default('custom_url'),
    targetId: Joi.string().trim().uuid().when('targetType', {
        is: Joi.valid('page', 'category', 'product', 'collection'),
        then: Joi.required(),
        otherwise: Joi.allow(null, '')
    }),
    url: Joi.string().trim().max(1000).when('targetType', {
        is: Joi.valid('custom_url', 'system_route'),
        then: Joi.required(),
        otherwise: Joi.allow(null, '')
    }),
    placement: Joi.string().valid(...placements).default('center'),
    sortOrder: Joi.number().integer().default(0),
    isVisible: Joi.boolean().default(true),
    openInNewTab: Joi.boolean().default(false),
});

const updateMenuItemSchema = Joi.object({
    parentId: Joi.string().trim().uuid().empty('').allow(null),
    label: Joi.string().max(120),
    targetType: Joi.string().valid(...targetTypes),
    targetId: Joi.string().trim().uuid().when('targetType', {
        is: Joi.valid('page', 'category', 'product', 'collection'),
        then: Joi.required(),
        otherwise: Joi.allow(null, '')
    }),
    url: Joi.string().trim().max(1000).when('targetType', {
        is: Joi.valid('custom_url', 'system_route'),
        then: Joi.required(),
        otherwise: Joi.allow(null, '')
    }),
    placement: Joi.string().valid(...placements),
    sortOrder: Joi.number().integer(),
    isVisible: Joi.boolean(),
    openInNewTab: Joi.boolean(),
}).min(1);

const reorderItemsSchema = Joi.object({
    items: Joi.array().items(Joi.object({
        id: Joi.string().trim().uuid().required(),
        parentId: Joi.string().trim().uuid().empty('').allow(null),
        placement: Joi.string().valid(...placements),
        sortOrder: Joi.number().integer().required(),
    })).min(1).required(),
});

const queryMenusSchema = Joi.object({
    location: Joi.string().valid(...menuLocations),
    includeInactive: Joi.boolean(),
});

module.exports = {
    createMenuSchema,
    updateMenuSchema,
    createMenuItemSchema,
    updateMenuItemSchema,
    reorderItemsSchema,
    queryMenusSchema,
};
