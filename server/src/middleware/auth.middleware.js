'use strict';

const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { User, Role, Permission } = require('../modules');
const { enrichUserAuthorization } = require('../config/permissions');

const authUserInclude = [
  {
    model: Role,
    as: 'roles',
    through: { attributes: [] },
    include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
  },
];

/**
 * Middleware to authenticate user via JWT
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 401, 'Please log in to access this resource');
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      throw new AppError('UNAUTHORIZED', 401, 'Invalid or expired token');
    }

    // Check if user still exists (could be deleted)
    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'role', 'status'],
      include: authUserInclude,
    });

    if (!user) {
      throw new AppError('UNAUTHORIZED', 401, 'User belonging to this token no longer exists');
    }

    if (user.status !== 'active') {
      throw new AppError('FORBIDDEN', 403, 'Your account is inactive');
    }

    req.user = enrichUserAuthorization(user);
    next();
  } catch (error) {
    next(error);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      return next();
    }

    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'email', 'role', 'status'],
      include: authUserInclude,
    });

    if (user && user.status === 'active') {
      req.user = enrichUserAuthorization(user);
    }
    next();
  } catch (error) {
    next();
  }
};

module.exports = { authenticate, optionalAuth };
