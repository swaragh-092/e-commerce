'use strict';

/**
 * Validation middleware using Joi.
 * Validates req.body against the provided Joi schema.
 *
 * @param {object} schema - Joi validation schema
 * @returns {Function} Express middleware
 */
const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });

        if (error) {
            const details = error.details.map((d) => ({
                field: d.path.join('.'),
                message: d.message,
            }));

            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details,
                },
            });
        }

        req.body = value; // use sanitized/stripped value
        next();
    };
};

module.exports = { validate };
