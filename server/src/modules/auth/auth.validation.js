'use strict';

const Joi = require('joi');

const passwordPolicy = Joi.string()
  .min(8)
  .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
  .message('Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number')
  .required();

const registerSchema = Joi.object({
  firstName: Joi.string().required().max(50),
  lastName: Joi.string().required().max(50),
  email: Joi.string().email().required().lowercase(),
  password: passwordPolicy,
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
  password: Joi.string().required(), // No policy check on login, just need it to exist
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().lowercase(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: passwordPolicy,
});

const resendVerificationSchema = Joi.object({
  email: Joi.string().email().required().lowercase()
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  resendVerificationSchema
};

