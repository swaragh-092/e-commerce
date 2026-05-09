'use strict';

const AuditService = require('./audit.service');
const { paginated } = require('../../utils/response');

const getAll = async (req, res, next) => {
  try {
    let { entity, action, userId, from, to, search, page = 1, limit = 20 } = req.query;

    // Validate and sanitize search parameter
    if (search) {
      if (typeof search !== 'string') {
        const AppError = require('../../utils/AppError');
        throw new AppError('VALIDATION_ERROR', 400, 'Search parameter must be a string');
      }
      if (search.length > 256) {
        const AppError = require('../../utils/AppError');
        throw new AppError('VALIDATION_ERROR', 400, 'Search term too long (max 256 characters)');
      }
      // Trim and strip control characters
      search = search.trim().replace(/[\x00-\x1F\x7F]/g, '');
    }

    const { rows, count } = await AuditService.list({
      entity,
      action,
      userId,
      from,
      to,
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    return paginated(res, rows, count, parseInt(page, 10), parseInt(limit, 10));
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll };
