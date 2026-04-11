'use strict';

const Joi = require('joi');

const addItemSchema = Joi.object({
  productId: Joi.string().uuid().required(),
  variantId: Joi.string().uuid().allow(null).optional(),
});

module.exports = {
  addItemSchema
};
