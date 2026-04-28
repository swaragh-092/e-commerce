'use strict';
const Joi = require('joi');

const createPromotionSchema = Joi.object({
  name: Joi.string().max(255).required(),
  label: Joi.string().max(100).required(),
  type: Joi.string().valid('sale', 'flash', 'seasonal', 'clearance', 'bundle').default('sale'),
  badgeColor: Joi.string().max(30).allow(null, ''),
  badgeIcon: Joi.string().max(50).allow(null, ''),
  description: Joi.string().allow(null, ''),
  startDate: Joi.date().iso().allow(null),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).allow(null),
  isActive: Joi.boolean().default(true),
  priority: Joi.number().integer().default(0),
});

const updatePromotionSchema = Joi.object({
  name: Joi.string().max(255),
  label: Joi.string().max(100),
  type: Joi.string().valid('sale', 'flash', 'seasonal', 'clearance', 'bundle'),
  badgeColor: Joi.string().max(30).allow(null, ''),
  badgeIcon: Joi.string().max(50).allow(null, ''),
  description: Joi.string().allow(null, ''),
  startDate: Joi.date().iso().allow(null),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).allow(null),
  isActive: Joi.boolean(),
  priority: Joi.number().integer(),
}).min(1);

const productAssignmentSchema = Joi.object({
  productIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

module.exports = {
  createPromotionSchema,
  updatePromotionSchema,
  productAssignmentSchema,
};
