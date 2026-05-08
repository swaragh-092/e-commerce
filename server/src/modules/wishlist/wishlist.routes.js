'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { featureGate } = require('../../middleware/featureGate.middleware');
const wishlistController = require('./wishlist.controller');
const { addItemSchema, moveToCartSchema } = require('./wishlist.validation');
const { productIdParamSchema } = require('../../utils/common.validation');


router.use(authenticate);
router.use(featureGate('wishlist'));

router.get('/', wishlistController.getWishlist);
router.post('/items', validate(addItemSchema), wishlistController.addItem);
router.post('/items/move-all-to-cart', featureGate('cart'), wishlistController.moveAllToCart);
router.delete('/items', wishlistController.clearWishlist);
router.delete('/items/:productId', validate(productIdParamSchema, 'params'), wishlistController.removeItem);
router.post('/items/:productId/to-cart', featureGate('cart'), validate(productIdParamSchema, 'params'), validate(moveToCartSchema), wishlistController.moveToCart);


module.exports = router;
