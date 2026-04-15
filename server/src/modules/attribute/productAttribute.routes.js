'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./productAttribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const {
    addProductAttributeSchema,
    updateProductAttributeSchema,
} = require('./productAttribute.validation');
const { PERMISSIONS } = require('../../config/permissions');

const attrRead   = [authenticate, authorizePermissions(PERMISSIONS.ATTRIBUTES_READ)];
const attrManage = [authenticate, authorizePermissions(PERMISSIONS.ATTRIBUTES_MANAGE)];

// GET    /api/products/:id/attributes
router.get('/:id/attributes', ...attrRead, controller.getProductAttributes);

// POST   /api/products/:id/attributes
router.post('/:id/attributes', ...attrManage, validate(addProductAttributeSchema), controller.addProductAttribute);

// PUT    /api/products/:id/attributes/:attrId
router.put('/:id/attributes/:attrId', ...attrManage, validate(updateProductAttributeSchema), controller.updateProductAttribute);

// DELETE /api/products/:id/attributes/:attrId
router.delete('/:id/attributes/:attrId', ...attrManage, controller.deleteProductAttribute);

module.exports = router;
