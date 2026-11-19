'use strict';

const Joi = require('joi');

const contactSchema = Joi.object({
  name: Joi.string().trim().min(2).max(120).pattern(/^[^\r\n\u0000]+$/).required()
    .messages({ 'string.min': 'Please enter your name (at least 2 characters).' }),
  email: Joi.string().trim().lowercase().max(254).email({ tlds: { allow: false } }).required()
    .messages({ 'string.email': 'Please enter a valid email address.' }),
  phone: Joi.string().trim().max(32).pattern(/^\+?[0-9][0-9(). -]*$/)
    .custom((value, helpers) => {
      const digits = value.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15 ? value : helpers.error('string.pattern.base');
    }).required().messages({ 'string.pattern.base': 'Please enter a valid phone number with 7 to 15 digits.' }),
  message: Joi.string().trim().min(1).max(5000).pattern(/\u0000/, { invert: true }).required()
    .messages({ 'string.empty': 'Please enter your message.', 'string.max': 'Your message must be 5000 characters or fewer.' }),
});

module.exports = { contactSchema };
