'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { bulkGenerateSchema, cloneVariantsSchema } = require('./attribute.validation');

// NOTE: When auth middleware is ready, add authenticate + authorize('admin', 'super_admin')

// --- Bulk Variant Generator ---
router.post('/:id/variants/bulk-generate', validate(bulkGenerateSchema), controller.bulkGenerateVariants);

// --- Clone Variants ---
router.post('/:id/variants/clone', validate(cloneVariantsSchema), controller.cloneVariants);

module.exports = router;
