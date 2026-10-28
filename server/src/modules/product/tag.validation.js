'use strict';
const Joi = require('joi');
const { MAX_TAGS, MAX_TAG_LENGTH, normalizeTagName } = require('./tag.utils');

const tagNameSchema = Joi.string().custom((value, helpers) => {
  if (/[\p{Cc}\p{Cf},]/u.test(value)) return helpers.error('any.invalid');
  const name = normalizeTagName(value);
  if (!name || name.length > MAX_TAG_LENGTH || name.includes(',')) return helpers.error('any.invalid');
  return name;
}).messages({ 'any.invalid': 'Tag names must contain 1–100 characters without commas or control characters' });
const productTagsSchema = Joi.array().items(tagNameSchema).max(MAX_TAGS);
const tagWriteSchema = Joi.object({
  name: tagNameSchema.required(),
  description: Joi.string().trim().max(2000).allow('', null),
});
const tagSlugSchema = Joi.object({ slug: Joi.string().max(100).pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).required() });
const bulkProductTagsSchema = Joi.object({
  productIds: Joi.array().items(Joi.string().uuid().lowercase()).min(1).max(100).unique().required(),
  action: Joi.string().valid('add', 'remove').required(),
  tags: productTagsSchema.min(1).required(),
});
const tagListSchema = Joi.object({
  search: Joi.string().trim().max(100).allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});
const tagFilterSchema = Joi.alternatives().try(
  Joi.string().max(5100).allow('').custom((value, helpers) => {
    const tags = value.split(',').map((tag) => tag.trim()).filter(Boolean);
    if (tags.length > MAX_TAGS || tags.some((tag) => tag.length > MAX_TAG_LENGTH)) return helpers.error('any.invalid');
    return value;
  }),
  Joi.array().items(Joi.string().trim().min(1).max(100)).max(MAX_TAGS)
);
module.exports = { tagNameSchema, productTagsSchema, tagWriteSchema, tagListSchema, tagFilterSchema, bulkProductTagsSchema, tagSlugSchema };
