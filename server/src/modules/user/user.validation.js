'use strict';

const Joi = require('joi');

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

module.exports = {
  updateProfileSchema,
  changePasswordSchema,
  updateStatusSchema
};
