'use strict';
const Joi = require('joi');
const { idParamSchema } = require('../../utils/common.validation');

module.exports = {
  listQuerySchema: Joi.object({ page: Joi.number().integer().min(1).default(1), limit: Joi.number().integer().min(1).max(100).default(20) }),
  createGallerySchema: Joi.object({ title: Joi.string().max(255).required(), slug: Joi.string().max(255).required(), description: Joi.string().allow('', null).optional(), isActive: Joi.boolean().optional().default(true) }),
  updateGallerySchema: Joi.object({ title: Joi.string().max(255).optional(), slug: Joi.string().max(255).optional(), description: Joi.string().allow('', null).optional(), isActive: Joi.boolean().optional() }),
  addItemsSchema: Joi.object({ mediaIds: Joi.array().items(Joi.string().uuid()).min(1).required() }),
  reorderItemsSchema: Joi.object({ itemIds: Joi.array().items(Joi.string().uuid()).min(1).required() }),
  publicGalleryQuerySchema: Joi.object({ page: Joi.number().integer().min(1).default(1), limit: Joi.number().integer().min(1).max(100).default(20) }),
  idAndItemIdParamSchema: idParamSchema.keys({ itemId: Joi.string().uuid().required() }),
};
