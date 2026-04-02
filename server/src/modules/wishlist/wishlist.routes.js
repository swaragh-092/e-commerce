'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validate.middleware');
const featureGate = require('../../middleware/featureGate.middleware');
const wishlistController = require('./wishlist.controller');
const { addItemSchema } = require('./wishlist.validation');

router.use(authenticate);
router.use(featureGate('wishlist'));

router.get('/', wishlistController.getWishlist);
router.post('/items', validate(addItemSchema), wishlistController.addItem);
router.delete('/items/:productId', wishlistController.removeItem);
router.post('/items/:productId/to-cart', wishlistController.moveToCart);

module.exports = router;
