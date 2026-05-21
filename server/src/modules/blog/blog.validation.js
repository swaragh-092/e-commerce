'use strict';

const Joi = require('joi');

const blogStatusSchema = Joi.string().valid('draft', 'published');
const optionalString = Joi.string().allow(null, '');

const createBlogCategorySchema = Joi.object({
  name: Joi.string().max(255).required(),
  description: optionalString,
});

const updateBlogCategorySchema = Joi.object({
  name: Joi.string().max(255),
  description: optionalString,
});

const createBlogPostSchema = Joi.object({
  title: Joi.string().max(255).required(),
  content: Joi.string().required(),
  summary: optionalString,
  featuredImageId: Joi.string().uuid().allow(null, ''),
  galleryMediaIds: Joi.array().items(Joi.string().uuid()).default([]),
  status: blogStatusSchema.default('draft'),
  publishedAt: Joi.date().iso().allow(null, ''),
  displayDate: Joi.date().iso().allow(null, ''),
  categoryIds: Joi.array().items(Joi.string().uuid()).default([]),
  metaTitle: optionalString.max(255),
  metaDescription: optionalString,
  metaKeywords: optionalString.max(500),
});

const updateBlogPostSchema = Joi.object({
  title: Joi.string().max(255),
  content: Joi.string(),
  summary: optionalString,
  featuredImageId: Joi.string().uuid().allow(null, ''),
  galleryMediaIds: Joi.array().items(Joi.string().uuid()).optional(),
  status: blogStatusSchema,
  publishedAt: Joi.date().iso().allow(null, ''),
  displayDate: Joi.date().iso().allow(null, ''),
  categoryIds: Joi.array().items(Joi.string().uuid()),
  metaTitle: optionalString.max(255),
  metaDescription: optionalString,
  metaKeywords: optionalString.max(500),
});

const queryBlogPostsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(1000).default(10),
  status: blogStatusSchema,
  categorySlug: Joi.string().allow(''),
  search: Joi.string().allow(''),
});

module.exports = {
  createBlogCategorySchema,
  updateBlogCategorySchema,
  createBlogPostSchema,
  updateBlogPostSchema,
  queryBlogPostsSchema,
};
