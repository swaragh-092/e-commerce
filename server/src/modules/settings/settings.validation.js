'use strict';

const Joi = require('joi');
const { DESIGN_SETTINGS_GROUPS } = require('./designSettings');

const updateSettingsGroupSchema = Joi.object({
  group: Joi.string().valid('theme', 'componentStyles', 'sectionPresets', 'features', 'payments', 'sales', 'seo', 'general', 'shipping', 'tax', 'sku', 'logo', 'hero', 'auth', 'footer', 'announcement', 'nav', 'catalog', 'homepage', 'productPage', 'categoryPage', 'brandsPage', 'cartPage', 'accountPage', 'blogPage', 'checkoutPage', 'wishlistPage', 'searchPage', 'notFoundPage', 'ordersPage', 'admin', 'invoice', 'gateway_credentials', 'messaging', 'messaging_credentials', 'ai', 'ai_credentials', 'advanced').required(),
  settings: Joi.object().pattern(Joi.string(), Joi.any()).required()
});

const updateSingleSettingSchema = Joi.object({
  value: Joi.any().required()
});

const bulkUpdateSchema = Joi.alternatives().try(
  Joi.object().pattern(Joi.string(), Joi.any()),
  Joi.array().items(Joi.object({
    key: Joi.string().required(),
    value: Joi.any().required(),
    group: Joi.string().optional()
  }))
);

const resetDesignSettingSchema = Joi.object({
  group: Joi.string().valid(...DESIGN_SETTINGS_GROUPS, 'advanced').required(),
  key: Joi.string().max(255).allow('', null).optional(),
});

const designDraftSettingSchema = Joi.object({
  group: Joi.string().max(50).required(),
  key: Joi.string().max(255).required(),
  operation: Joi.string().valid('upsert', 'delete').optional(),
  value: Joi.any().optional(),
}).unknown(false);

const saveDesignDraftSchema = Joi.object({
  expectedRevision: Joi.number().integer().min(1).optional(),
  settings: Joi.array().items(designDraftSettingSchema).max(1000).required(),
}).unknown(false);

const publishDesignDraftSchema = Joi.object({
  expectedRevision: Joi.number().integer().min(1).optional(),
}).unknown(false);

const restoreDesignVersionSchema = Joi.object({
  expectedRevision: Joi.number().integer().min(1).optional(),
}).unknown(false);

module.exports = {
  updateSettingsGroupSchema,
  updateSingleSettingSchema,
  bulkUpdateSchema,
  resetDesignSettingSchema,
  saveDesignDraftSchema,
  publishDesignDraftSchema,
  restoreDesignVersionSchema,
};
