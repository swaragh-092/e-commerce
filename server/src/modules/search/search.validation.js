'use strict';

const Joi = require('joi');

/**
 * Search query validation.
 *
 * WHY min(2): Single-character searches return too many irrelevant results
 * and create unnecessary DB load.
 *
 * WHY max(100): Prevents oversized query strings that could slow down
 * to_tsvector parsing or be used for DoS.
 *
 * WHY limit max(50): Caps the maximum page size to prevent clients from
 * requesting the entire catalog in one request.
 */
const searchQuerySchema = Joi.object({
  q: Joi.string().trim().min(2).max(100).required()
    .messages({
      'string.min': 'Search query must be at least 2 characters',
      'string.max': 'Search query must be at most 100 characters',
      'any.required': 'Search query is required',
    }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

module.exports = { searchQuerySchema };
