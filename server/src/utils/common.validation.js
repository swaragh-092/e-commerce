'use strict';

const Joi = require('joi');

/**
 * Common validation schemas for reusable parts
 */

const uuidSchema = Joi.string().uuid().required();

const idParamSchema = Joi.object({
    id: uuidSchema,
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
    idParamSchema,
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





