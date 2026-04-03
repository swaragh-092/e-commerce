'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const {
    createAttributeSchema,
    updateAttributeSchema,
    addValueSchema,
} = require('./attribute.validation');

const adminOnly = [authenticate, authorize('admin', 'super_admin')];

// --- Attribute Template CRUD ---
router.get('/', controller.getAllAttributes);
router.get('/:id', controller.getAttributeById);
router.post('/', ...adminOnly, validate(createAttributeSchema), controller.createAttribute);
router.put('/:id', ...adminOnly, validate(updateAttributeSchema), controller.updateAttribute);
router.delete('/:id', ...adminOnly, controller.deleteAttribute);

// --- Attribute Values ---
router.post('/:id/values', ...adminOnly, validate(addValueSchema), controller.addValue);
router.delete('/:attrId/values/:valueId', ...adminOnly, controller.removeValue);

module.exports = router;
