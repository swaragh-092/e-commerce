'use strict';

const Joi = require('joi');

// ─── Reusable item schema ────────────────────────────────────────────────────
const comboItemSchema = Joi.object({
    itemProductId: Joi.string().uuid().required(),
    variantId:     Joi.string().uuid().allow(null).default(null),
    quantity:      Joi.number().integer().min(1).required(),
});

// PUT /api/products/:id/combo-items  — full sync
const syncComboItemsSchema = Joi.object({
    items: Joi.array().items(comboItemSchema).max(20).required(),
});

module.exports = { syncComboItemsSchema };
