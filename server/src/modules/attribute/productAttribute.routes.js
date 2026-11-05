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
    updateProductAttributeGroupSchema,
    assignProductAttributeSchema,
    reorderProductAttributesSchema,
} = require('./productAttribute.validation');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema, idAndAttrIdParamSchema } = require('../../utils/common.validation');


const attrRead   = [authenticate, authorizePermissions(PERMISSIONS.ATTRIBUTES_READ)];
const attrManage = [authenticate, authorizePermissions(PERMISSIONS.ATTRIBUTES_MANAGE)];

router.post('/:id/attributes/assign', ...attrManage, validate(idParamSchema, 'params'), validate(assignProductAttributeSchema), controller.assignProductAttribute);
router.put('/:id/attributes/reorder', ...attrManage, validate(idParamSchema, 'params'), validate(reorderProductAttributesSchema), controller.reorderProductAttributes);

// GET    /api/products/:id/attributes
router.get('/:id/attributes', ...attrRead, validate(idParamSchema, 'params'), controller.getProductAttributes);


// POST   /api/products/:id/attributes
router.post('/:id/attributes', ...attrManage, validate(idParamSchema, 'params'), validate(addProductAttributeSchema), controller.addProductAttribute);

// PUT    /api/products/:id/attributes/:attrId
router.put('/:id/attributes/:attrId', ...attrManage, validate(idAndAttrIdParamSchema, 'params'), validate(updateProductAttributeSchema), controller.updateProductAttribute);

// DELETE /api/products/:id/attributes/:attrId
router.delete('/:id/attributes/:attrId', ...attrManage, validate(idAndAttrIdParamSchema, 'params'), controller.deleteProductAttribute);
// Remove all values of the attribute represented by this product assignment.
router.delete('/:id/attributes/:attrId/group', ...attrManage, validate(idAndAttrIdParamSchema, 'params'), controller.deleteProductAttributeGroup);
router.put('/:id/attributes/:attrId/group', ...attrManage, validate(idAndAttrIdParamSchema, 'params'), validate(updateProductAttributeGroupSchema), controller.updateProductAttributeGroup);


module.exports = router;
