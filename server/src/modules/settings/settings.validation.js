'use strict';

const Joi = require('joi');

const updateSettingsGroupSchema = Joi.object({
  group: Joi.string().valid('theme', 'features', 'seo', 'general', 'shipping', 'tax').required(),
  settings: Joi.object().pattern(Joi.string(), Joi.any()).required()
});

const updateSingleSettingSchema = Joi.object({
  value: Joi.any().required()
});

const bulkUpdateSchema = Joi.object().pattern(Joi.string(), Joi.any()); // Used in Phase 5 but good to have

module.exports = {
  updateSettingsGroupSchema,
  updateSingleSettingSchema,
  bulkUpdateSchema
};
