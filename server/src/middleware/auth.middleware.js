'use strict';

const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { User } = require('../models'); 

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
      attributes: ['id', 'email', 'role', 'status']
    });

    if (!user) {
      throw new AppError('UNAUTHORIZED', 401, 'User belonging to this token no longer exists');
    }

    if (user.status !== 'active') {
      throw new AppError('FORBIDDEN', 403, 'Your account is inactive or banned');
    }

    req.user = user.toJSON();
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
      attributes: ['id', 'email', 'role', 'status']
    });

    if (user && user.status === 'active') {
      req.user = user.toJSON();
    }
    next();
  } catch (error) {
    next();
  }
};

module.exports = { authenticate, optionalAuth };
