'use strict';

const WishlistService = require('./wishlist.service');
const { success } = require('../../utils/response');

const getSessionId = (req) => {
  return req.headers['x-session-id'] || req.cookies?.sessionId || null;
};

const getWishlist = async (req, res, next) => {
  try {
    const result = await WishlistService.getWishlist(req.user ? req.user.id : null, getSessionId(req));
    return success(res, result.items, 'Success', 200, {
      unavailableRemovedCount: result.unavailableRemovedCount,
    });
  } catch (err) {
    next(err);
  }
};

const addItem = async (req, res, next) => {
  try {
    const item = await WishlistService.addItem(req.user ? req.user.id : null, getSessionId(req), req.body.productId, req.body.variantId || null);
    return success(res, item, 'Item added to wishlist', 201);
  } catch (err) {
    next(err);
  }
};

const removeItem = async (req, res, next) => {
  try {
    await WishlistService.removeItem(req.user ? req.user.id : null, getSessionId(req), req.params.productId, req.query.variantId || null);
    return success(res, null, 'Item removed from wishlist');
  } catch (err) {
    next(err);
  }
};

const moveToCart = async (req, res, next) => {
  try {
    const cartItem = await WishlistService.moveToCart(req.user ? req.user.id : null, getSessionId(req), req.params.productId, req.query.variantId || null);
    return success(res, cartItem, 'Item moved to cart', 201);
  } catch (err) {
    next(err);
  }
};

const moveAllToCart = async (req, res, next) => {
  try {
    const result = await WishlistService.moveAllToCart(req.user ? req.user.id : null, getSessionId(req));
    return success(res, result, 'Wishlist items moved to cart');
  } catch (err) {
    next(err);
  }
};

const clearWishlist = async (req, res, next) => {
  try {
    const result = await WishlistService.clearWishlist(req.user ? req.user.id : null, getSessionId(req));
    return success(res, result, 'Wishlist cleared');
  } catch (err) {
    next(err);
  }
};

const mergeGuestWishlist = async (req, res, next) => {
  try {
    const result = await WishlistService.mergeGuestWishlist(req.validated.sessionId, req.user.id);
    return success(res, result, 'Wishlists merged');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWishlist,
  addItem,
  removeItem,
  moveToCart,
  moveAllToCart,
  clearWishlist,
  mergeGuestWishlist,
};
