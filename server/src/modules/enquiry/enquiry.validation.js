'use strict';

const Joi = require('joi');

const uuidSchema = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });
const cartProductSchema = Joi.alternatives().try(
  Joi.object({
    id: uuidSchema.required(),
    name: Joi.string().trim().max(255).optional().allow(null, ''),
    sku: Joi.string().trim().max(100).optional().allow(null, ''),
  }).unknown(true),
  uuidSchema
);

const createEnquirySchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required(),
  email: Joi.string().trim().email().required().lowercase(),
  phone: Joi.string()
    .trim()
    .pattern(/^\d{10,12}$/)
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Phone number must be between 10 and 12 digits and contain only numbers'
    }),
  message: Joi.string().trim().min(5).max(2000).required(),
  productId: uuidSchema.optional().allow(null),
  variantId: uuidSchema.optional().allow(null),
  quantity: Joi.number().integer().min(1).optional().default(1),
  cartItems: Joi.array()
    .items(
      Joi.object({
        product: cartProductSchema.optional(),
        productId: uuidSchema.optional(),
        variant: Joi.object({
          id: uuidSchema.optional().allow(null),
          sku: Joi.string().trim().max(100).optional().allow(null, '')
        }).optional().allow(null),
        variantId: uuidSchema.optional().allow(null),
        quantity: Joi.number().integer().min(1).required()
      }).unknown(true)
    )
    .max(100)
    .optional()
    .allow(null)
}).custom((value, helpers) => {
  if (!value.productId && !value.cartItems) {
    return helpers.error('any.custom', { message: 'Either productId or cartItems is required' });
  }
  if (value.productId && value.cartItems) {
    return helpers.error('any.custom', { message: 'Provide either productId or cartItems, not both' });
  }
  return value;
}, 'enquiry payload rules').messages({
  'any.custom': '{{#message}}'
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
