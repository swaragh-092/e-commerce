'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const {
    bulkGenerateSchema,
    cloneVariantsSchema,
    singleVariantSchema,
    updateVariantSchema,
} = require('./attribute.validation');

const adminOnly = [authenticate, authorize('admin', 'super_admin')];

// --- Bulk Variant Generator ---
router.post('/:id/variants/bulk-generate', ...adminOnly, validate(bulkGenerateSchema), controller.bulkGenerateVariants);

// --- Clone Variants ---
router.post('/:id/variants/clone', ...adminOnly, validate(cloneVariantsSchema), controller.cloneVariants);

// --- Per-product variant CRUD ---
router.get('/:id/variants', ...adminOnly, controller.getProductVariants);
router.post('/:id/variants', ...adminOnly, validate(singleVariantSchema), controller.addProductVariant);
router.put('/:id/variants/:variantId', ...adminOnly, validate(updateVariantSchema), controller.updateProductVariant);
router.delete('/:id/variants/:variantId', ...adminOnly, controller.deleteProductVariant);

module.exports = router;
