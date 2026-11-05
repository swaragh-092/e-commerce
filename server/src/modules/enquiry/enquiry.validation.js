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
  message: Joi.string().trim().max(2000).required(),
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
      }).unknown(true).custom((item, helpers) => {
        const nestedProductId = typeof item.product === 'string' ? item.product : item.product?.id;
        if (!item.productId && !nestedProductId) return helpers.error('any.custom', { message: 'Each enquiry item requires a product' });
        if (item.productId && nestedProductId && item.productId !== nestedProductId) return helpers.error('any.custom', { message: 'Product identifiers must match' });
        if (item.variantId && item.variant?.id && item.variantId !== item.variant.id) return helpers.error('any.custom', { message: 'Variant identifiers must match' });
        return item;
      })
    )
    .min(1)
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
  if (value.cartItems && value.variantId) return helpers.error('any.custom', { message: 'Place each variantId inside its cart item' });
  return value;
}, 'enquiry payload rules').messages({
  'any.custom': '{{#message}}'
});

const updateEnquiryStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'responded', 'closed', 'closed_converted', 'closed_lost').required()
});

const replyEnquirySchema = Joi.object({
  replyMessage: Joi.string().max(5000).required()
});

const queryEnquiriesSchema = Joi.object({
  status: Joi.string().valid('pending', 'responded', 'closed', 'closed_converted', 'closed_lost').allow(''),
  search: Joi.string().trim().allow(''),
  sortBy: Joi.string().valid('createdAt', 'name', 'email', 'status', 'subject').default('createdAt'),
  sortDir: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').default('desc'),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

module.exports = {
  createEnquirySchema,
  updateEnquiryStatusSchema,
  replyEnquirySchema,
  queryEnquiriesSchema,
};
