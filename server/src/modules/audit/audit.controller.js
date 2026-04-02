'use strict';

const AuditService = require('./audit.service');
const { paginated } = require('../../utils/response');

const getAll = async (req, res, next) => {
  try {
    const { entity, action, userId, from, to, page = 1, limit = 20 } = req.query;
    const { rows, count } = await AuditService.list({
      entity,
      action,
      userId,
      from,
      to,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
    return paginated(res, rows, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: count,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll };
