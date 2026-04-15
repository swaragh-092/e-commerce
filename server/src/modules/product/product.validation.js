'use strict';
const Joi = require('joi');

const createProductSchema = Joi.object({
  name: Joi.string().max(255).required(),
  description: Joi.string().allow('', null),
  shortDescription: Joi.string().max(500).allow('', null),
  sku: Joi.string().max(100).allow('', null),
  price: Joi.number().precision(2).positive().required(),
  salePrice: Joi.number().precision(2).positive().allow(null).less(Joi.ref('price')),
  saleStartAt: Joi.date().iso().allow(null),
  saleEndAt: Joi.date().iso().allow(null).greater(Joi.ref('saleStartAt')),
  saleLabel: Joi.string().max(100).allow('', null),
  quantity: Joi.number().integer().min(0),
  weight: Joi.number().precision(2).min(0).allow(null),
  taxRate: Joi.number().precision(4).min(0).allow(null),
  status: Joi.string().valid('draft', 'published'),
  isFeatured: Joi.boolean(),
  categoryIds: Joi.array().items(Joi.string().uuid()),
  brandId: Joi.string().uuid().allow(null),
  tags: Joi.array().items(Joi.string()),
  variants: Joi.array().items(
    Joi.object({
      sku: Joi.string().max(100).allow('', null),
      price: Joi.number().precision(2).min(0).required(),
      stockQty: Joi.number().integer().min(0).default(0),
      isActive: Joi.boolean().default(true),
      sortOrder: Joi.number().integer().min(0).default(0),
      options: Joi.array().items(
        Joi.object({
          attributeId: Joi.string().uuid().required(),
          valueId: Joi.string().uuid().required(),
        })
      ).min(1).required(),
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

const bulkSaleSchema = Joi.object({
  action: Joi.string().valid('apply', 'clear').required(),
  productIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  saleType: Joi.when('action', {
    is: 'apply',
    then: Joi.string().valid('fixed', 'percentage').required(),
    otherwise: Joi.forbidden(),
  }),
  value: Joi.when('action', {
    is: 'apply',
    then: Joi.number().positive().required(),
    otherwise: Joi.forbidden(),
  }),
  saleStartAt: Joi.when('action', {
    is: 'apply',
    then: Joi.date().iso().allow(null),
    otherwise: Joi.forbidden(),
  }),
  saleEndAt: Joi.when('action', {
    is: 'apply',
    then: Joi.date().iso().allow(null).greater(Joi.ref('saleStartAt')),
    otherwise: Joi.forbidden(),
  }),
  saleLabel: Joi.when('action', {
    is: 'apply',
    then: Joi.string().max(100).allow('', null),
    otherwise: Joi.forbidden(),
  }),
});

module.exports = { createProductSchema, updateProductSchema, bulkSaleSchema };
