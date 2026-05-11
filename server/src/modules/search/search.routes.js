'use strict';

/**
 * Search Routes — wires middleware and controller.
 * Zero inline logic.
 *
 * WHY searchLimiter:
 * - Search is publicly accessible (no auth required).
 * - Without rate limiting, bots could enumerate the entire product catalog
 *   by sending thousands of search queries per minute.
 * - 30 req/min is generous for real users but blocks scrapers.
 *
 * WHY validate on 'query':
 * - Search params come via GET query string, not POST body.
 * - The validate middleware sanitizes and strips unknown params.
 */

const router = require('express').Router();
const SearchController = require('./search.controller');
const { validate } = require('../../middleware/validate.middleware');
const { searchQuerySchema } = require('./search.validation');
const { searchLimiter } = require('../../middleware/rateLimiter.middleware');

// GET /api/search?q=iphone&page=1&limit=20
// Public endpoint — no auth required
router.get(
  '/',
  searchLimiter,
  validate(searchQuerySchema, 'query'),
  SearchController.search
);

module.exports = router;
