'use strict';

const Joi = require('joi');

const addItemSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  variantId: Joi.string().uuid().allow(null).optional(),
});

const moveToCartSchema = Joi.object({
  params: Joi.object({
    productId: Joi.string().uuid().required(),
  }),
  query: Joi.object({
    variantId: Joi.string().uuid().allow(null).optional(),
  }).unknown(true),
});

module.exports = {
  addItemSchema,
  moveToCartSchema,
};
