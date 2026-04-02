'use strict';
const Joi = require('joi');

const addItemSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  variantId: Joi.string().uuid().optional().allow(null, ''),
  quantity: Joi.number().integer().min(1).default(1),
});

const updateItemSchema = Joi.object({
  quantity: Joi.number().integer().min(1).required(),
});

const mergeCartSchema = Joi.object({
  sessionId: Joi.string().required(),
});

module.exports = {
  addItemSchema,
  updateItemSchema,
  mergeCartSchema
};
