'use strict';

const Joi = require('joi');

const updateSettingsGroupSchema = Joi.object({
  group: Joi.string().valid('theme', 'features', 'payments', 'sales', 'seo', 'general', 'shipping', 'tax', 'sku', 'logo', 'hero', 'footer', 'announcement', 'nav', 'catalog', 'homepage', 'productPage', 'admin', 'invoice', 'gateway_credentials', 'messaging', 'messaging_credentials').required(),
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

module.exports = {
  updateSettingsGroupSchema,
  updateSingleSettingSchema,
  bulkUpdateSchema
};
