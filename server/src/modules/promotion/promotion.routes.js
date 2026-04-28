'use strict';

const router = require('express').Router();
const promotionController = require('./promotion.controller');
const { validate } = require('../../middleware/validate.middleware');
const { createPromotionSchema, updatePromotionSchema, productAssignmentSchema } = require('./promotion.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { PERMISSIONS } = require('../../config/permissions');

// Admin routes
router.get('/', authenticate, authorizePermissions(PERMISSIONS.PROMOTIONS_READ), promotionController.list);
router.post('/', authenticate, authorizePermissions(PERMISSIONS.PROMOTIONS_MANAGE), validate(createPromotionSchema), auditLog('Promotion'), promotionController.create);
router.get('/:id', authenticate, authorizePermissions(PERMISSIONS.PROMOTIONS_READ), promotionController.getOne);
router.put('/:id', authenticate, authorizePermissions(PERMISSIONS.PROMOTIONS_MANAGE), validate(updatePromotionSchema), auditLog('Promotion'), promotionController.update);
router.delete('/:id', authenticate, authorizePermissions(PERMISSIONS.PROMOTIONS_MANAGE), auditLog('Promotion'), promotionController.remove);

// Product assignment
router.post('/:id/products', authenticate, authorizePermissions(PERMISSIONS.PROMOTIONS_MANAGE), validate(productAssignmentSchema), auditLog('Promotion products assigned'), promotionController.assignProducts);
router.delete('/:id/products', authenticate, authorizePermissions(PERMISSIONS.PROMOTIONS_MANAGE), validate(productAssignmentSchema), auditLog('Promotion products removed'), promotionController.removeProducts);

module.exports = router;
