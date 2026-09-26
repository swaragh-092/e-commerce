'use strict';

const Joi = require('joi');
const { MIN_SEARCH_QUERY_LENGTH, MAX_SEARCH_QUERY_LENGTH, normalizeSearchQuery } = require('./search.utils');

/**
 * Search query validation.
 *
 * WHY min(2): Single-character searches return too many irrelevant results
 * and create unnecessary DB load.
 *
 * WHY max(100): Caps the normalized query length to bound search work.
 *
 * WHY limit max(50): Caps the maximum page size to prevent clients from
 * requesting the entire catalog in one request.
 */
const searchQuerySchema = Joi.object({
  q: Joi.string().custom((value, helpers) => {
    const normalized = normalizeSearchQuery(value);
    const normalizedLength = Array.from(normalized).length;
    if (normalizedLength < MIN_SEARCH_QUERY_LENGTH) return helpers.error('search.min');
    if (normalizedLength > MAX_SEARCH_QUERY_LENGTH) return helpers.error('search.max');
    return normalized;
  }).required()
    .messages({
      'search.min': 'Search query must be at least 2 characters',
      'search.max': 'Search query must be at most 100 characters',
      'any.required': 'Search query is required',
    }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
});

module.exports = { searchQuerySchema };
