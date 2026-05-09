'use strict';

const Joi = require('joi');

const createEnquirySchema = Joi.object({
  name: Joi.string().max(255).required(),
  email: Joi.string().email().required().lowercase(),
  phone: Joi.string()
    .pattern(/^\d{10,12}$/)
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Phone number must be between 10 and 12 digits and contain only numbers'
    }),
  message: Joi.string().max(2000).required(),
  productId: Joi.string().uuid().optional().allow(null),
  variantId: Joi.string().uuid().optional().allow(null),
  quantity: Joi.number().integer().min(1).optional().default(1),
  cartItems: Joi.array().items(Joi.object()).optional().allow(null)
});

const updateEnquiryStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'responded', 'closed').required()
});

const replyEnquirySchema = Joi.object({
  replyMessage: Joi.string().max(5000).required()
});

module.exports = {
  createEnquirySchema,
  updateEnquiryStatusSchema,
  replyEnquirySchema
};
