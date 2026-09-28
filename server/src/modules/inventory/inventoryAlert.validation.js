'use strict';

const Joi = require('joi');

const inventoryAlertConfigSchema = Joi.object({
  recipientUserIds: Joi.array().items(Joi.string().uuid()).max(100).unique().required(),
  timezone: Joi.string().min(1).max(80).required(),
  digestHour: Joi.number().integer().min(0).max(23).required(),
  reminderIntervalDays: Joi.number().integer().min(1).max(30).required(),
  immediateOutOfStock: Joi.boolean().required(),
  includeEnvironmentRecipients: Joi.boolean().required(),
});

const updateInventoryAlertSchema = Joi.object({
  status: Joi.string().valid('open', 'acknowledged').optional(),
  assignedTo: Joi.string().uuid().allow(null).optional(),
  note: Joi.string().max(1000).allow('').optional(),
  expectedRestockAt: Joi.date().iso().allow(null).optional(),
}).min(1);

module.exports = { inventoryAlertConfigSchema, updateInventoryAlertSchema };
