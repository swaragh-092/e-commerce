'use strict';

const WishlistService = require('./wishlist.service');
const { success } = require('../../utils/response');

const getWishlist = async (req, res, next) => {
  try {
    const items = await WishlistService.getWishlist(req.user.id);
    return success(res, items);
  } catch (err) {
    next(err);
  }
};

const addItem = async (req, res, next) => {
  try {
    const item = await WishlistService.addItem(req.user.id, req.body.productId);
    return success(res, item, 'Item added to wishlist', 201);
  } catch (err) {
    next(err);
  }
};

const removeItem = async (req, res, next) => {
  try {
    await WishlistService.removeItem(req.user.id, req.params.productId);
    return success(res, null, 'Item removed from wishlist');
  } catch (err) {
    next(err);
  }
};

const moveToCart = async (req, res, next) => {
  try {
    const cartItem = await WishlistService.moveToCart(req.user.id, req.params.productId);
    return success(res, cartItem, 'Item moved to cart', 201);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getWishlist,
  addItem,
  removeItem,
  moveToCart
};
