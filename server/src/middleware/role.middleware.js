'use strict';

const AppError = require('../utils/AppError');

/**
 * Middleware to restrict access to specific roles
 * @param {...string} roles - Permitted roles (e.g. 'admin', 'super_admin')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(new AppError('UNAUTHORIZED', 401, 'Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('FORBIDDEN', 403, 'You do not have permission to perform this action'));
    }

    next();
  };
};

module.exports = { authorize };
