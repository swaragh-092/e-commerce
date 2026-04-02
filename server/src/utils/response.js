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

/**
 * Send a paginated list response.
 * @param {object} res - Express response object
 * @param {Array}  rows - Array of records
 * @param {number} count - Total record count (before pagination)
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Page size
 * @param {string} message - Optional message
 */
const paginated = (res, rows, count, page, limit, message = 'Success') => {
    const totalPages = Math.ceil(count / limit);
    return res.status(200).json({
        success: true,
        data: rows,
        message,
        meta: {
            total: count,
            page: Number(page),
            totalPages,
            limit: Number(limit),
        },
    });
};

module.exports = { success, error, paginated };
