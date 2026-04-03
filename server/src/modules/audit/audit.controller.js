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
    return paginated(res, rows, count, parseInt(page, 10), parseInt(limit, 10));
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll };
