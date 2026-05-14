'use strict';

const Joi = require('joi');

const resources = [
  'categories',
  'products',
  'brands',
  'pages',
  'menus',
  'menuItems',
  'settings',
  'productImages',
  'productVariants',
  'productAttributes',
  'variantOptions',
  'attributeTemplates',
  'attributeValues',
  'tags',
  'media',
];
const operators = ['equals', 'contains', 'in', 'gte', 'lte', 'between'];

const filterSchema = Joi.object({
  field: Joi.string().trim().max(80).required(),
  operator: Joi.string().valid(...operators).default('equals'),
  source: Joi.string().valid('query', 'static').default('query'),
  param: Joi.string().trim().max(80).allow('', null),
  defaultValue: Joi.any().allow(null, ''),
  value: Joi.any().allow(null, ''),
});

const previewQuerySchema = Joi.object().pattern(
  Joi.string().trim().max(120),
  Joi.alternatives().try(
    Joi.string().allow(''),
    Joi.number(),
    Joi.boolean(),
    Joi.array().items(Joi.string().allow(''))
  )
).default({});

const nodeSchema = Joi.object({
  id: Joi.string().trim().max(80).allow('', null),
  key: Joi.string().trim().max(80).allow('', null),
  resource: Joi.string().valid(...resources),
  relation: Joi.string().trim().max(80).allow('', null),
  enabled: Joi.boolean().default(true),
  mode: Joi.string().valid('selected', 'all', 'filtered').default('all'),
  selectedIds: Joi.array().items(Joi.string().trim().max(140)).max(200).default([]),
  limit: Joi.number().integer().min(1).max(200).default(10),
  pagination: Joi.object({
    enabled: Joi.boolean().default(false),
    pageParam: Joi.string().trim().max(80).allow('', null).default('page'),
    pageSizeParam: Joi.string().trim().max(80).allow('', null).default('pageSize'),
    defaultPage: Joi.number().integer().min(1).max(100000).default(1),
    defaultPageSize: Joi.number().integer().min(1).max(200).default(10),
  }).default({ enabled: false }),
  depth: Joi.number().integer().min(1).max(10).default(10),
  fields: Joi.array().items(Joi.string().trim().max(80)).max(60).default([]),
  filters: Joi.array().items(filterSchema).max(20).default([]),
  relations: Joi.array().items(Joi.link('#apiNode')).max(40).default([]),
  sortBy: Joi.string().trim().max(80).allow('', null),
  sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('ASC'),
  group: Joi.string().trim().max(80).allow('', null),
}).id('apiNode');

const blockSchema = nodeSchema.fork(['resource'], (schema) => schema.required());

const configSchema = Joi.object({
  responseMode: Joi.string().valid('object', 'array').default('object'),
  includeMeta: Joi.boolean().default(true),
  blocks: Joi.array().items(blockSchema).min(1).max(20).required(),
}).required();

const createApiDefinitionSchema = Joi.object({
  name: Joi.string().trim().max(140).required(),
  slug: Joi.string().trim().max(140).pattern(/^[a-z0-9-]+$/).allow('', null),
  description: Joi.string().trim().allow('', null).max(1000),
  isActive: Joi.boolean().default(true),
  config: configSchema,
});

const previewApiDefinitionSchema = Joi.object({
  config: configSchema,
  query: previewQuerySchema,
});

const updateApiDefinitionSchema = createApiDefinitionSchema.fork(['name', 'config'], (schema) => schema.optional()).min(1);

const idParamSchema = Joi.object({
  id: Joi.string().trim().uuid().required(),
});

const slugParamSchema = Joi.object({
  slug: Joi.string().trim().max(140).pattern(/^[a-z0-9-]+$/).required(),
});

const querySchema = Joi.object({
  includeInactive: Joi.boolean(),
});

module.exports = {
  createApiDefinitionSchema,
  previewApiDefinitionSchema,
  updateApiDefinitionSchema,
  idParamSchema,
  slugParamSchema,
  querySchema,
};
