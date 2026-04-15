'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { cloneVariantsSchema } = require('./attribute.validation');
const {
    generateVariantsSchema,
    addVariantSchema,
    updateVariantSchema,
} = require('./productAttribute.validation');
const { PERMISSIONS } = require('../../config/permissions');

const variantRead = [authenticate, authorizePermissions(PERMISSIONS.ATTRIBUTES_READ)];
const variantManage = [authenticate, authorizePermissions(PERMISSIONS.ATTRIBUTES_MANAGE)];

// --- Bulk Variant Generator ---
router.post('/:id/variants/generate', ...variantManage, validate(generateVariantsSchema), controller.bulkGenerateVariants);
router.post('/:id/variants/bulk-generate', ...variantManage, validate(generateVariantsSchema), controller.bulkGenerateVariants);

// --- Clone Variants ---
router.post('/:id/variants/clone', ...variantManage, validate(cloneVariantsSchema), controller.cloneVariants);

// --- Per-product variant CRUD ---
router.get('/:id/variants', ...variantRead, controller.getProductVariants);
router.post('/:id/variants', ...variantManage, validate(addVariantSchema), controller.addProductVariant);
router.put('/:id/variants/:variantId', ...variantManage, validate(updateVariantSchema), controller.updateProductVariant);
router.delete('/:id/variants/:variantId', ...variantManage, controller.deleteProductVariant);

module.exports = router;
