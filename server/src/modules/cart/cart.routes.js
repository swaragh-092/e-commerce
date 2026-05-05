'use strict';
const router = require('express').Router();
const cartController = require('./cart.controller');
const { validate } = require('../../middleware/validate.middleware');
const { addItemSchema, updateItemSchema, mergeCartSchema } = require('./cart.validation');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');

const { featureGate } = require('../../middleware/featureGate.middleware');

router.use(featureGate('cart'));

router.get('/', optionalAuth, cartController.getCart);
router.post('/items', optionalAuth, validate(addItemSchema), cartController.addItem);
router.put('/items/:id', optionalAuth, validate(updateItemSchema), cartController.updateItem);
router.delete('/items/:id', optionalAuth, cartController.removeItem);
router.delete('/', optionalAuth, cartController.clearCart);

// Merge cart requires actual authentication
router.post('/merge', authenticate, validate(mergeCartSchema), cartController.mergeGuestCart);

module.exports = router;
