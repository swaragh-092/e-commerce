'use strict';

const Joi = require('joi');

// Schema for a single tab in upsert operations
const tabSchema = Joi.object({
    id: Joi.string().uuid().allow(null), // present on update, absent on create
    title: Joi.string().max(255).required(),
    content: Joi.string().allow('', null),
    type: Joi.string().valid('html').default('html'),
    sortOrder: Joi.number().integer().min(0).default(0),
    isActive: Joi.boolean().default(true),
});

// POST /products/:id/tabs  — create a single tab
const createTabSchema = tabSchema.fork(['id'], (s) => s.forbidden());

// PUT /products/:id/tabs/:tabId  — update a single tab
const updateTabSchema = tabSchema
    .fork(['id'], (s) => s.forbidden())
    .fork(['title'], (s) => s.optional())
    .min(1);

// PUT /products/:id/tabs/reorder  — reorder all tabs
const reorderTabsSchema = Joi.object({
    // Ordered array of { id, sortOrder }
    order: Joi.array()
        .items(
            Joi.object({
                id: Joi.string().uuid().required(),
                sortOrder: Joi.number().integer().min(0).required(),
            })
        )
        .min(1)
        .required(),
});

// PUT /products/:id/tabs  — full sync (replace all tabs)
const syncTabsSchema = Joi.object({
    tabs: Joi.array().items(tabSchema).required(),
});

module.exports = {
    createTabSchema,
    updateTabSchema,
    reorderTabsSchema,
    syncTabsSchema,
};
