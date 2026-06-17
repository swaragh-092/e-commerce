'use strict';

const Joi = require('joi');

const generateDraftSchema = Joi.object({
  input: Joi.string().trim().max(500).required(),
  tone: Joi.string().valid('neutral', 'premium', 'technical', 'sales').default('neutral'),
  includeHtml: Joi.boolean().default(true),
  maxFeatureBullets: Joi.number().integer().min(3).max(10).default(5),
});

module.exports = {
  generateDraftSchema,
};
