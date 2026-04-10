'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const {
    createAttributeSchema,
    updateAttributeSchema,
    addValueSchema,
} = require('./attribute.validation');
const { PERMISSIONS } = require('../../config/permissions');

const attributeRead = [authenticate, authorizePermissions(PERMISSIONS.ATTRIBUTES_READ)];
const attributeManage = [authenticate, authorizePermissions(PERMISSIONS.ATTRIBUTES_MANAGE)];

// --- Attribute Template CRUD ---
router.get('/', controller.getAllAttributes);
router.get('/:id', controller.getAttributeById);
router.post('/', ...attributeManage, validate(createAttributeSchema), controller.createAttribute);
router.put('/:id', ...attributeManage, validate(updateAttributeSchema), controller.updateAttribute);
router.delete('/:id', ...attributeManage, controller.deleteAttribute);

// --- Attribute Values ---
router.post('/:id/values', ...attributeManage, validate(addValueSchema), controller.addValue);
router.delete('/:attrId/values/:valueId', ...attributeManage, controller.removeValue);

module.exports = router;
