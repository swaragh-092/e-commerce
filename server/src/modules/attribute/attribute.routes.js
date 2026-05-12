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
    updateValueSchema,
} = require('./attribute.validation');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema, attrIdValueIdParamSchema, paginationQuerySchema } = require('../../utils/common.validation');



const attributeRead = [authenticate, authorizePermissions(PERMISSIONS.ATTRIBUTES_READ)];
const attributeManage = [authenticate, authorizePermissions(PERMISSIONS.ATTRIBUTES_MANAGE)];

// --- Attribute Template CRUD ---
router.get('/', attributeRead, validate(paginationQuerySchema, 'query'), controller.getAllAttributes);

router.get('/:id', attributeRead, validate(idParamSchema, 'params'), controller.getAttributeById);

router.post('/', ...attributeManage, validate(createAttributeSchema), controller.createAttribute);
router.put('/:id', ...attributeManage, validate(idParamSchema, 'params'), validate(updateAttributeSchema), controller.updateAttribute);
router.delete('/:id', ...attributeManage, validate(idParamSchema, 'params'), controller.deleteAttribute);


// --- Attribute Values ---
router.post('/:id/values', ...attributeManage, validate(idParamSchema, 'params'), validate(addValueSchema), controller.addValue);
router.put('/:id/values/reorder', ...attributeManage, validate(idParamSchema, 'params'), controller.reorderValues);
router.put('/:attrId/values/:valueId', ...attributeManage, validate(attrIdValueIdParamSchema, 'params'), validate(updateValueSchema), controller.updateValue);
router.delete('/:attrId/values/:valueId', ...attributeManage, validate(attrIdValueIdParamSchema, 'params'), controller.removeValue);


module.exports = router;
