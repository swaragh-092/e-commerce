'use strict';

/**
 * Standardized API response helpers.
 * Always use these instead of raw res.json().
 */

/**
 * Send a success response.
 * @param {object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default 200)
 * @param {object} meta - Optional pagination meta
 */
const success = (res, data, message = 'Success', statusCode = 200, meta = null) => {
    const response = { success: true, data, message };
    if (meta) response.meta = meta;
    return res.status(statusCode).json(response);
};

/**
 * Send an error response.
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default 400)
 * @param {string} code - Error code (e.g. 'VALIDATION_ERROR')
 * @param {*} details - Optional error details
 */
const error = (res, message = 'Error', statusCode = 400, code = 'BAD_REQUEST', details = null) => {
    const response = { success: false, error: { code, message } };
    if (details) response.error.details = details;
    return res.status(statusCode).json(response);
};

module.exports = { success, error };
