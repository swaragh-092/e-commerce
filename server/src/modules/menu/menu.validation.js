'use strict';

const Joi = require('joi');

const menuLocations = ['header', 'footer', 'mobile', 'sidebar'];
const targetTypes = ['none', 'custom_url', 'page', 'category', 'product', 'collection', 'system_route'];
const placements = ['left', 'center', 'right', 'quick_links', 'footer_column', 'mobile', 'sidebar'];

const safeUrlSchema = Joi.string().trim().max(1000).custom((value, helpers) => {
    if (!value) return value;
    if (value.startsWith('/') || value.startsWith('#')) return value;

    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return helpers.error('any.invalid');
        }

        // Block local/internal hostnames and common internal IP ranges
        const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
        if (blockedHosts.includes(url.hostname)) {
            return helpers.error('any.invalid');
        }

        // Block private IP ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x
        if (
            url.hostname.startsWith('10.') ||
            url.hostname.startsWith('192.168.') ||
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(url.hostname)
        ) {
            return helpers.error('any.invalid');
        }
    } catch (e) {
        // If not a valid absolute URL and doesn't start with / or #, we treat it as potentially invalid for custom_url
        // but it might be a system route name. We'll allow it if it doesn't look like a URL.
    }
    return value;
}, 'SSRF Protection');


const menuAlignments = ['left', 'center', 'right'];

const createMenuSchema = Joi.object({
    name: Joi.string().max(120).required(),
    slug: Joi.string().trim().max(120).pattern(/^[a-z0-9-]+$/).empty('').allow(null),
    location: Joi.string().valid(...menuLocations).default('header'),
    alignment: Joi.string().valid(...menuAlignments).default('left'),
    isActive: Joi.boolean().default(true),
    sortOrder: Joi.number().integer().default(0),
});

const updateMenuSchema = Joi.object({
    name: Joi.string().max(120),
    slug: Joi.string().trim().max(120).pattern(/^[a-z0-9-]+$/).empty('').allow(null),
    location: Joi.string().valid(...menuLocations),
    alignment: Joi.string().valid(...menuAlignments),
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
    url: safeUrlSchema.when('targetType', {
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
    url: safeUrlSchema.when('targetType', {
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

const getPublicMenuSchema = Joi.object({
    location: Joi.string().valid(...menuLocations).required(),
});

const reorderMenusSchema = Joi.object({
    menus: Joi.array().items(Joi.object({
        id: Joi.string().trim().uuid().required(),
        sortOrder: Joi.number().integer().required(),
    })).min(1).required(),
});

const moveItemsSchema = Joi.object({
    itemIds: Joi.array().items(Joi.string().uuid().required()).min(1).required(),
    targetMenuId: Joi.string().uuid().required(),
});

const bulkDeleteItemsSchema = Joi.object({
    itemIds: Joi.array().items(Joi.string().uuid().required()).min(1).required(),
});


const idParamSchema = Joi.object({
    id: Joi.string().trim().uuid().required(),
});

const menuIdParamSchema = Joi.object({
    menuId: Joi.string().trim().uuid().required(),
});

const menuItemIdParamSchema = Joi.object({
    menuId: Joi.string().trim().uuid().required(),
    itemId: Joi.string().trim().uuid().required(),
});


module.exports = {
    createMenuSchema,
    updateMenuSchema,
    createMenuItemSchema,
    updateMenuItemSchema,
    reorderItemsSchema,
    reorderMenusSchema,
    moveItemsSchema,
    bulkDeleteItemsSchema,
    queryMenusSchema,

    getPublicMenuSchema,
    idParamSchema,
    menuIdParamSchema,
    menuItemIdParamSchema,
};




