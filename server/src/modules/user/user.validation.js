'use strict';

const Joi = require('joi');

const updateAvatarSchema = Joi.object({
  mediaId: Joi.string().uuid().required()
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().max(50),
  lastName: Joi.string().max(50),
  phone: Joi.string().max(20).allow(null, ''),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').allow(null),
  dateOfBirth: Joi.date().iso().allow(null)
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
    .required()
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'banned').required()
});

const createAddressSchema = Joi.object({
  label: Joi.string().max(50).optional().allow(null, ''),
  fullName: Joi.string().max(255).required(),
  phone: Joi.string().max(20).optional().allow(null, ''),
  addressLine1: Joi.string().max(255).required(),
  addressLine2: Joi.string().max(255).optional().allow(null, ''),
  city: Joi.string().max(100).required(),
  state: Joi.string().max(100).optional().allow(null, ''),
  postalCode: Joi.string().max(20).required(),
  country: Joi.string().max(100).required(),
  isDefault: Joi.boolean().default(false)
});

const updateAddressSchema = Joi.object({
  label: Joi.string().max(50).optional().allow(null, ''),
  fullName: Joi.string().max(255).optional(),
  phone: Joi.string().max(20).optional().allow(null, ''),
  addressLine1: Joi.string().max(255).optional(),
  addressLine2: Joi.string().max(255).optional().allow(null, ''),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional().allow(null, ''),
  postalCode: Joi.string().max(20).optional(),
  country: Joi.string().max(100).optional(),
  isDefault: Joi.boolean().optional()
});

module.exports = {
  updateProfileSchema,
  changePasswordSchema,
  updateAvatarSchema,
  updateStatusSchema,
  createAddressSchema,
  updateAddressSchema
};
