'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const {
    createAttributeSchema,
    updateAttributeSchema,
    addValueSchema,
    linkAttributeSchema,
    bulkGenerateSchema,
    cloneVariantsSchema,
} = require('./attribute.validation');

// NOTE: When auth middleware is ready, add authenticate + authorize('admin', 'super_admin')
// to all routes below. For now, routes are open for development/testing.

// --- Attribute Template CRUD ---
router.get('/', controller.getAllAttributes);
router.get('/:id', controller.getAttributeById);
router.post('/', validate(createAttributeSchema), controller.createAttribute);
router.put('/:id', validate(updateAttributeSchema), controller.updateAttribute);
router.delete('/:id', controller.deleteAttribute);

// --- Attribute Values ---
router.post('/:id/values', validate(addValueSchema), controller.addValue);
router.delete('/:attrId/values/:valueId', controller.removeValue);

module.exports = router;
