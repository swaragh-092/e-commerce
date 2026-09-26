'use strict';
const Joi = require('joi');
const { MIN_SEARCH_QUERY_LENGTH, MAX_SEARCH_QUERY_LENGTH, normalizeSearchQuery } = require('../search/search.utils');


const productListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(1000).default(20),
  search: Joi.string().allow('').custom((value, helpers) => {
    const normalized = normalizeSearchQuery(value);
    const normalizedLength = Array.from(normalized).length;
    if (normalizedLength < MIN_SEARCH_QUERY_LENGTH) return helpers.error('search.min');
    if (normalizedLength > MAX_SEARCH_QUERY_LENGTH) return helpers.error('search.max');
    return normalized;
  }).optional().messages({
    'search.min': 'Search query must be at least 2 characters',
    'search.max': 'Search query must be at most 100 characters',
  }),
}).unknown();

const createProductSchema = Joi.object({
  name: Joi.string().max(255).required(),
  slug: Joi.string().max(255).allow('', null),
  isEnabled: Joi.boolean().default(true),
  description: Joi.string().allow('', null),
  shortDescription: Joi.string().max(500).allow('', null),
  sku: Joi.string().max(100).allow('', null),
  unit: Joi.string().max(50).allow('', null),
  price: Joi.number().precision(2).positive().required(),
  salePrice: Joi.number().precision(2).positive().allow(null).less(Joi.ref('price')),
  saleStartAt: Joi.date().iso().allow(null),
  saleEndAt: Joi.date().iso().allow(null).when('saleStartAt', {
    is: Joi.date().required(),
    then: Joi.date().iso().allow(null).greater(Joi.ref('saleStartAt')),
    otherwise: Joi.date().iso().allow(null),
  }),
  saleLabel: Joi.string().max(100).allow('', null),
  quantity: Joi.number().integer().min(0).when('type', {
    is: 'simple',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
  weight: Joi.number().precision(2).min(0).allow(null), // legacy field
  requiresShipping: Joi.boolean().default(true),
  weightGrams: Joi.number().integer().min(0).allow(null),
  lengthCm: Joi.number().min(0).allow(null),
  breadthCm: Joi.number().min(0).allow(null),
  heightCm: Joi.number().min(0).allow(null),
  taxConfig: Joi.object({
    isCustom: Joi.boolean().required(),
    inclusive: Joi.boolean(),
    sgst: Joi.number().min(0).max(1),
    cgst: Joi.number().min(0).max(1),
    igst: Joi.number().min(0).max(1),
  }).allow(null),
  type: Joi.string().valid('simple', 'variable', 'combo').required(),
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
      images: Joi.array().items(
        Joi.object({
          url: Joi.string().allow('', null),
          alt: Joi.string().max(255).allow('', null),
          mediaId: Joi.string().uuid().allow(null),
          sortOrder: Joi.number().integer().default(0),
          isPrimary: Joi.boolean().default(false),
        })
      ),
      options: Joi.array().items(
        Joi.object({
          attributeId: Joi.string().uuid().required(),
          valueId: Joi.string().uuid().required(),
        })
      ).min(1).required(),
    })
  ).when('type', {
    is: 'variable',
    then: Joi.required(),
    otherwise: Joi.forbidden()
  }),
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

const updateProductSchema = Joi.object({
  name: Joi.string().max(255),
  slug: Joi.string().max(255).allow('', null),
  isEnabled: Joi.boolean(),
  description: Joi.string().allow('', null),
  shortDescription: Joi.string().max(500).allow('', null),
  sku: Joi.string().max(100).allow('', null),
  unit: Joi.string().max(50).allow('', null),
  price: Joi.number().precision(2).positive(),
  salePrice: Joi.number().precision(2).positive().allow(null).when('price', {
    is: Joi.exist(),
    then: Joi.number().precision(2).positive().allow(null).less(Joi.ref('price')),
    otherwise: Joi.number().precision(2).positive().allow(null),
  }),
  saleStartAt: Joi.date().iso().allow(null),
  saleEndAt: Joi.date().iso().allow(null).when('saleStartAt', {
    is: Joi.date().required(),
    then: Joi.date().iso().allow(null).greater(Joi.ref('saleStartAt')),
    otherwise: Joi.date().iso().allow(null),
  }),
  saleLabel: Joi.string().max(100).allow('', null),
  quantity: Joi.number().integer().min(0),
  weight: Joi.number().precision(2).min(0).allow(null),
  requiresShipping: Joi.boolean(),
  weightGrams: Joi.number().integer().min(0).allow(null),
  lengthCm: Joi.number().min(0).allow(null),
  breadthCm: Joi.number().min(0).allow(null),
  heightCm: Joi.number().min(0).allow(null),
  taxConfig: Joi.object({
    isCustom: Joi.boolean().required(),
    inclusive: Joi.boolean(),
    sgst: Joi.number().min(0).max(1),
    cgst: Joi.number().min(0).max(1),
    igst: Joi.number().min(0).max(1),
  }).allow(null),
  type: Joi.string().valid('simple', 'variable', 'combo'),
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
      images: Joi.array().items(
        Joi.object({
          url: Joi.string().allow('', null),
          alt: Joi.string().max(255).allow('', null),
          mediaId: Joi.string().uuid().allow(null),
          sortOrder: Joi.number().integer().default(0),
          isPrimary: Joi.boolean().default(false),
        })
      ),
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
}).min(1);

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
    then: Joi.date().iso().allow(null).when('saleStartAt', {
      is: Joi.date().required(),
      then: Joi.date().iso().allow(null).greater(Joi.ref('saleStartAt')),
      otherwise: Joi.date().iso().allow(null),
    }),
    otherwise: Joi.forbidden(),
  }),
  saleLabel: Joi.when('action', {
    is: 'apply',
    then: Joi.string().max(100).allow('', null),
    otherwise: Joi.forbidden(),
  }),
});

const bulkDeleteSchema = Joi.object({
  productIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
});

const bulkUpdateSchema = Joi.object({
  productIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
  data: Joi.object({
    status: Joi.string().valid('draft', 'published'),
    isEnabled: Joi.boolean(),
    saleLabel: Joi.string().max(100).allow('', null),
  }).min(1).required(),
});

module.exports = { productListQuerySchema, createProductSchema, updateProductSchema, bulkSaleSchema, bulkDeleteSchema, bulkUpdateSchema };
