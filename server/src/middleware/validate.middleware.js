'use strict';

const { error: sendError } = require('../utils/response');

/**
 * Validation middleware using Joi.
 * Validates req[property] against the provided Joi schema.
 *
 * @param {object} schema - Joi validation schema
 * @param {string} property - req property to validate (e.g. 'body', 'query', 'params'). Defaults to 'body'.
 * @returns {Function} Express middleware
 */
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const details = error.details.map((d) => ({
                field: d.path.join('.'),
                message: d.message,
            }));

            return sendError(res, 'Validation failed', 400, 'VALIDATION_ERROR', details);
        }

        req[property] = value; // use sanitized/stripped value
        if (property === 'body') {
            req.validated = value; // keep legacy behavior for body
        }
        next();
    };
};

module.exports = { validate };
