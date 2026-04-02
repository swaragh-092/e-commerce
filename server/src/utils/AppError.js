'use strict';

/**
 * Custom application error that extends Error.
 * Maps standard application errors to HTTP status codes.
 */
class AppError extends Error {
  /**
   * @param {string} code - Application specific string code e.g. "NOT_FOUND" 
   * @param {number} statusCode - HTTP status code e.g. 404
   * @param {string} message - Human readable error message
   * @param {any} [details=null] - Additional error context
   */
  constructor(code, statusCode, message, details = null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    // Capture stack trace, excluding the constructor call from it
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
