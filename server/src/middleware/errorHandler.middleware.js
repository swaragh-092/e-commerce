'use strict';

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { error } = require('../utils/response');

/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';
  let details = err.details || null;
  const isProduction = process.env.NODE_ENV === 'production';

  // Handle Sequelize validation errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    statusCode = err.name === 'SequelizeUniqueConstraintError' ? 409 : 400;
    errorCode = err.name === 'SequelizeUniqueConstraintError' ? 'DUPLICATE_ENTRY' : 'VALIDATION_ERROR';
    message = err.errors.map(e => e.message).join(', ');
    details = err.errors.map(e => ({ field: e.path, message: e.message }));
  }

  // Handle Sequelize connection pool exhaustion (Transient)
  const transientErrorNames = [
    'SequelizeConnectionAcquireTimeoutError',
    'SequelizeConnectionTimedOutError',
    'SequelizeHostNotFoundError',
    'SequelizeHostNotReachableError'
  ];

  if (transientErrorNames.includes(err.name)) {
    statusCode = 503;
    errorCode = 'DATABASE_TIMEOUT';
    message = 'The server is under heavy load. Please try again in a moment.';
  } else if (err.name === 'SequelizeConnectionError') {
    statusCode = 500;
    errorCode = 'DATABASE_ERROR';
    message = isProduction ? 'A database connection error occurred.' : `Database connection error: ${err.message}`;
  }

  // Log error if it's not operational (i.e. a bug) or if it's a 500
  if (!err.isOperational || statusCode >= 500) {
    logger.error('Unhandled server error', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      errorCode,
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack,
    });
  }

  if (isProduction && statusCode >= 500) {
    message = 'An unexpected error occurred';
    details = null;
  }

  // Send consistent response payload (using response util)
  return error(res, message, statusCode, errorCode, details);
};

module.exports = { errorHandler };
