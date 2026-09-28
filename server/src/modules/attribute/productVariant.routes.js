'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions, authorizeAnyPermission } = require('../../middleware/role.middleware');
const { bulkOperationLimiter } = require('../../middleware/rateLimiter.middleware');

const { cloneVariantsSchema } = require('./attribute.validation');
const {
    generateVariantsSchema,
    addVariantSchema,
    updateVariantSchema,
} = require('./productAttribute.validation');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema, idAndVariantIdParamSchema } = require('../../utils/common.validation');


const variantRead = [authenticate, authorizeAnyPermission(PERMISSIONS.ATTRIBUTES_READ, PERMISSIONS.PRODUCTS_READ)];
const variantManage = [authenticate, authorizeAnyPermission(PERMISSIONS.ATTRIBUTES_MANAGE, PERMISSIONS.PRODUCTS_UPDATE)];

// --- Bulk Variant Generator ---
router.post('/:id/variants/generate', ...variantManage, bulkOperationLimiter, validate(idParamSchema, 'params'), validate(generateVariantsSchema), controller.bulkGenerateVariants);
router.post('/:id/variants/bulk-generate', ...variantManage, bulkOperationLimiter, validate(idParamSchema, 'params'), validate(generateVariantsSchema), controller.bulkGenerateVariants);


// --- Clone Variants ---
router.post('/:id/variants/clone', ...variantManage, validate(idParamSchema, 'params'), validate(cloneVariantsSchema), controller.cloneVariants);

// --- Per-product variant CRUD ---
router.get('/:id/variants', ...variantRead, validate(idParamSchema, 'params'), controller.getProductVariants);
router.post('/:id/variants', ...variantManage, validate(idParamSchema, 'params'), validate(addVariantSchema), controller.addProductVariant);
router.put('/:id/variants/:variantId', ...variantManage, validate(idAndVariantIdParamSchema, 'params'), validate(updateVariantSchema), controller.updateProductVariant);
router.delete('/:id/variants/:variantId', ...variantManage, validate(idAndVariantIdParamSchema, 'params'), controller.deleteProductVariant);


module.exports = router;
