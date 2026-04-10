'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { linkAttributeSchema } = require('./attribute.validation');
const { PERMISSIONS } = require('../../config/permissions');

const categoryAttributeManage = [authenticate, authorizePermissions(PERMISSIONS.CATEGORIES_MANAGE, PERMISSIONS.ATTRIBUTES_MANAGE)];

// --- Category-Attribute linking ---
router.get('/:id/attributes', controller.getCategoryAttributes);
router.post('/:id/attributes', ...categoryAttributeManage, validate(linkAttributeSchema), controller.linkAttributeToCategory);
router.delete('/:id/attributes/:attrId', ...categoryAttributeManage, controller.unlinkAttributeFromCategory);

module.exports = router;
