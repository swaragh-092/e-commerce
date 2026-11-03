'use strict';
const Joi = require('joi');

// Keep the existing complexity rule; reject input bcrypt would silently truncate.
module.exports = Joi.string().min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/)
  .message('Password must be at least 8 characters long and include uppercase, lowercase, number, and special character')
  .custom((value, helpers) => Buffer.byteLength(value, 'utf8') > 72 ? helpers.error('password.bytes') : value)
  .messages({ 'password.bytes': 'Password must not exceed 72 UTF-8 bytes' });
