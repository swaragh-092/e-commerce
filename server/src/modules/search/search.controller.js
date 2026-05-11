'use strict';

/**
 * Search Controller — HTTP adapter only.
 *
 * Zero business logic, zero DB calls.
 * Delegates everything to the service layer.
 */

const SearchService = require('./search.service');
const { success } = require('../../utils/response');

const search = async (req, res, next) => {
  try {
    const { q, page, limit } = req.query;
    const results = await SearchService.search(q, page, limit);

    // Expose cache status as a header for observability / debugging
    res.set('X-Cache', results.fromCache ? 'HIT' : 'MISS');

    // Strip internal flag from the response body
    const { fromCache, ...body } = results;

    return success(res, body, 'Search results');
  } catch (err) {
    next(err);
  }
};

module.exports = { search };
