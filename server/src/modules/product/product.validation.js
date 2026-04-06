'use strict';
const Joi = require('joi');

const createProductSchema = Joi.object({
  name: Joi.string().max(255).required(),
  description: Joi.string().allow('', null),
  shortDescription: Joi.string().max(500).allow('', null),
  sku: Joi.string().max(100).allow('', null),
  price: Joi.number().precision(2).positive().required(),
  salePrice: Joi.number().precision(2).positive().allow(null).less(Joi.ref('price')),
  quantity: Joi.number().integer().min(0),
  weight: Joi.number().precision(2).min(0).allow(null),
  taxRate: Joi.number().precision(4).min(0).allow(null),
  status: Joi.string().valid('draft', 'published'),
  isFeatured: Joi.boolean(),
  categoryIds: Joi.array().items(Joi.string().uuid()),
  tags: Joi.array().items(Joi.string()),
  variants: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      value: Joi.string().required(),
      priceModifier: Joi.number().precision(2).default(0),
      quantity: Joi.number().integer().min(0).default(0),
      sku: Joi.string().allow('', null),
    })
  ),
  images: Joi.array().items(
    Joi.object({
      url: Joi.string().allow('', null),
      alt: Joi.string().max(255).allow('', null),
      mediaId: Joi.string().uuid().allow(null),
      sortOrder: Joi.number().integer().default(0),
      isPrimary: Joi.boolean().default(false),
    })
  ),
});

const updateProductSchema = createProductSchema
  .fork(['name', 'price'], (schema) => schema.optional())
  .min(1);

module.exports = { createProductSchema, updateProductSchema };
