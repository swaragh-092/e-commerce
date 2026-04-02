'use strict';

const Joi = require('joi');

const addItemSchema = Joi.object({
  productId: Joi.string().uuid().required()
});

module.exports = {
  addItemSchema
};
