'use strict';
const router = require('express').Router();
const cartController = require('./cart.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { addItemSchema, updateItemSchema, mergeCartSchema } = require('./cart.validation');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');
const { idParamSchema } = require('../../utils/common.validation');
const { PERMISSIONS } = require('../../config/permissions');


const { featureGate } = require('../../middleware/featureGate.middleware');

router.use(featureGate('cart'));

router.get('/', optionalAuth, cartController.getCart);
router.post('/items', optionalAuth, validate(addItemSchema), cartController.addItem);
router.put('/items/:id', optionalAuth, validate(idParamSchema, 'params'), validate(updateItemSchema), cartController.updateItem);
router.delete('/items/:id', optionalAuth, validate(idParamSchema, 'params'), cartController.removeItem);

router.delete('/', optionalAuth, cartController.clearCart);

// Merge cart requires actual authentication
router.post('/merge', authenticate, authorizePermissions(PERMISSIONS.CART_SELF), validate(mergeCartSchema), cartController.mergeGuestCart);

module.exports = router;
