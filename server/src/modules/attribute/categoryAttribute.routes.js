'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { linkAttributeSchema } = require('./attribute.validation');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema, idAndAttrIdParamSchema } = require('../../utils/common.validation');


const categoryAttributeManage = [authenticate, authorizePermissions(PERMISSIONS.CATEGORIES_MANAGE, PERMISSIONS.ATTRIBUTES_MANAGE)];

// --- Category-Attribute linking ---
router.get('/:id/attributes', validate(idParamSchema, 'params'), controller.getCategoryAttributes);
router.post('/:id/attributes', ...categoryAttributeManage, validate(idParamSchema, 'params'), validate(linkAttributeSchema), controller.linkAttributeToCategory);
router.delete('/:id/attributes/:attrId', ...categoryAttributeManage, validate(idAndAttrIdParamSchema, 'params'), controller.unlinkAttributeFromCategory);


module.exports = router;
