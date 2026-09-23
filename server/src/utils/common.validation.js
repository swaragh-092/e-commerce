'use strict';

const Joi = require('joi');

/**
 * Common validation schemas for reusable parts
 */

const uuidSchema = Joi.string().uuid().required();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidCsvSchema = Joi.string().custom((value, helpers) => {
    if (!value || typeof value !== 'string') return helpers.error('any.invalid');
    const parts = value.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) return helpers.error('any.invalid');
    for (const part of parts) {
        if (!UUID_REGEX.test(part)) {
            return helpers.error('string.guid', { value: part });
        }
    }
    return value;
}, 'UUID or CSV UUIDs').required();

const uuidCsvParamSchema = Joi.object({
    id: uuidCsvSchema,
});

const idParamSchema = Joi.object({
    id: uuidSchema,
});

const stringIdParamSchema = Joi.object({
    id: Joi.string().required(),
});

const attrIdParamSchema = Joi.object({
    attrId: uuidSchema,
});

const valueIdParamSchema = Joi.object({
    valueId: uuidSchema,
});

const variantIdParamSchema = Joi.object({
    variantId: uuidSchema,
});

const attrIdValueIdParamSchema = Joi.object({
    attrId: uuidSchema,
    valueId: uuidSchema,
});

const idAndAttrIdParamSchema = Joi.object({
    id: uuidSchema,
    attrId: uuidSchema,
});

const idAndVariantIdParamSchema = Joi.object({
    id: uuidSchema,
    variantId: uuidSchema,
});

const idAndFulfillmentIdParamSchema = Joi.object({
    id: uuidSchema,
    fulfillmentId: uuidSchema,
});

const productIdParamSchema = Joi.object({
    productId: uuidSchema,
});

const orderIdParamSchema = Joi.object({
    orderId: uuidSchema,
});

const paginationQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(1000).default(20),
}).unknown();

const slugParamSchema = Joi.object({
    slug: Joi.string().required(),
});



module.exports = {
    uuidSchema,
    uuidCsvSchema,
    uuidCsvParamSchema,
    idParamSchema,
    stringIdParamSchema,
    attrIdParamSchema,
    valueIdParamSchema,
    variantIdParamSchema,
    attrIdValueIdParamSchema,
    idAndAttrIdParamSchema,
    idAndVariantIdParamSchema,
    idAndFulfillmentIdParamSchema,
    productIdParamSchema,
    orderIdParamSchema,
    paginationQuerySchema,
    slugParamSchema,
};





