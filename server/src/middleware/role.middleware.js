'use strict';

const AppError = require('../utils/AppError');
const { getPermissionsForUser, getRolesForUser } = require('../config/permissions');

/**
 * Middleware to restrict access to specific roles
 * @param {...string} roles - Permitted roles (e.g. 'admin', 'super_admin')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('UNAUTHORIZED', 401, 'Authentication required'));
    }

    const userRoles = getRolesForUser(req.user);

    if (!roles.some((role) => userRoles.includes(role))) {
      return next(new AppError('FORBIDDEN', 403, 'You do not have permission to perform this action'));
    }

    next();
  };
};

const authorizePermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('UNAUTHORIZED', 401, 'Authentication required'));
    }

    const userPermissions = getPermissionsForUser(req.user);
    const hasAllRequired = permissions.every((permission) => userPermissions.includes(permission));

    if (!hasAllRequired) {
      return next(new AppError('FORBIDDEN', 403, 'You do not have permission to perform this action'));
    }

    next();
  };
};

const authorizeAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('UNAUTHORIZED', 401, 'Authentication required'));
    }

    const userPermissions = getPermissionsForUser(req.user);
    const hasAnyRequired = permissions.some((permission) => userPermissions.includes(permission));

    if (!hasAnyRequired) {
      return next(new AppError('FORBIDDEN', 403, 'You do not have permission to perform this action'));
    }

    next();
  };
};

module.exports = { authorize, authorizePermissions, authorizeAnyPermission };
