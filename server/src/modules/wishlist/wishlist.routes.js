'use strict';

const router = require('express').Router();
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { featureGate } = require('../../middleware/featureGate.middleware');
const wishlistController = require('./wishlist.controller');
const { addItemSchema, moveToCartSchema, mergeWishlistSchema } = require('./wishlist.validation');
const { productIdParamSchema } = require('../../utils/common.validation');
const { PERMISSIONS } = require('../../config/permissions');


router.use(featureGate('wishlist'));

router.get('/', optionalAuth, wishlistController.getWishlist);
router.post('/items', optionalAuth, validate(addItemSchema), wishlistController.addItem);
router.post('/items/move-all-to-cart', optionalAuth, featureGate('cart'), wishlistController.moveAllToCart);
router.delete('/items', optionalAuth, wishlistController.clearWishlist);
router.delete('/items/:productId', optionalAuth, validate(productIdParamSchema, 'params'), wishlistController.removeItem);
router.post('/items/:productId/to-cart', optionalAuth, featureGate('cart'), validate(productIdParamSchema, 'params'), validate(moveToCartSchema), wishlistController.moveToCart);
router.post('/merge', authenticate, authorizePermissions(PERMISSIONS.WISHLIST_SELF), validate(mergeWishlistSchema), wishlistController.mergeGuestWishlist);


module.exports = router;
