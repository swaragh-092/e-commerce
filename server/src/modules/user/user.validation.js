'use strict';

const Joi = require('joi');

const updateAvatarSchema = Joi.object({
  mediaId: Joi.string().required()
});

const updateProfileSchema = Joi.object({
  firstName: Joi.string().max(50),
  lastName: Joi.string().max(50),
  phone: Joi.string()
    .regex(/^\d{10,15}$/)
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Phone number must be between 10 and 15 digits and contain only numbers'
    }),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').allow(null),
  dateOfBirth: Joi.date().iso().allow(null)
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])'))
    .message('Password must be at least 8 characters long and include uppercase, lowercase, number, and special character (!@#$%^&*)')
    .required(),
  confirmPassword: Joi.string()
    .valid(Joi.ref('newPassword'))
    .required()
    .messages({
      'any.only': 'Confirm password must match new password'
    })
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'banned').required()
});

const createAddressSchema = Joi.object({
  label: Joi.string().max(50).optional().allow(null, ''),
  fullName: Joi.string().max(255).required(),
  phone: Joi.string()
    .regex(/^\d{10,12}$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Phone number must be between 10 and 12 digits and contain only numbers'
    }),
  addressLine1: Joi.string().max(255).required(),
  addressLine2: Joi.string().max(255).optional().allow(null, ''),
  city: Joi.string().max(100).required(),
  state: Joi.string().max(100).optional().allow(null, ''),
  postalCode: Joi.string().max(20).required(),
  gstin: Joi.string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Please enter a valid GSTIN (e.g., 22AAAAA0000A1Z5)'
    }),
  country: Joi.string().max(100).required(),
  isDefault: Joi.boolean().default(false)
});

const updateAddressSchema = Joi.object({
  label: Joi.string().max(50).optional().allow(null, ''),
  fullName: Joi.string().max(255).optional(),
  phone: Joi.string()
    .regex(/^\d{10,12}$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Phone number must be between 10 and 12 digits and contain only numbers'
    }),
  addressLine1: Joi.string().max(255).optional(),
  addressLine2: Joi.string().max(255).optional().allow(null, ''),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional().allow(null, ''),
  postalCode: Joi.string().max(20).optional(),
  country: Joi.string().max(100).optional(),
  gstin: Joi.string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .optional()
    .allow(null, '')
    .messages({
      'string.pattern.base': 'Please enter a valid GSTIN (e.g., 22AAAAA0000A1Z5)'
    }),
  isDefault: Joi.boolean().optional()
});

const deleteAccountSchema = Joi.object({
  password: Joi.string().optional(),
  oauthProvider: Joi.string().valid('google').optional(),
}).or('password', 'oauthProvider');

const phoneChangeRequestSchema = Joi.object({
  phone: Joi.string().pattern(/^\d{10,15}$/).required(),
});

const phoneChangeConfirmSchema = Joi.object({
  phone: Joi.string().pattern(/^\d{10,15}$/).required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required(),
});

const emailChangeRequestSchema = Joi.object({
  newEmail: Joi.string().email().required().lowercase(),
  password: Joi.string().required(),
});

const emailChangeConfirmSchema = Joi.object({
  token: Joi.string().required(),
});

module.exports = {
  updateProfileSchema,
  changePasswordSchema,
  updateAvatarSchema,
  updateStatusSchema,
  createAddressSchema,
  updateAddressSchema,
  deleteAccountSchema,
  phoneChangeRequestSchema,
  phoneChangeConfirmSchema,
  emailChangeRequestSchema,
  emailChangeConfirmSchema,
};
