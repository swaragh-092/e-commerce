'use strict';

const { sequelize } = require('../../config/database');
const { Wishlist, WishlistItem, Product, ProductImage, Cart, CartItem } = require('../../models');
const AppError = require('../../utils/AppError');

const getWishlist = async (userId) => {
  let wishlist = await Wishlist.findOne({ where: { userId } });
  if (!wishlist) {
    wishlist = await Wishlist.create({ userId });
  }

  // Fetch items with Product and ProductImage info
  const items = await WishlistItem.findAll({
    where: { wishlistId: wishlist.id },
    include: [{
      model: Product,
      where: { deletedAt: null }, // only show active products
      include: [{
        model: ProductImage,
        where: { isPrimary: true },
        required: false
      }],
      required: false
    }],
    order: [['createdAt', 'DESC']]
  });

  // Filter out items where product is soft-deleted
  const activeItems = items.filter(item => item.Product);

  return activeItems;
};

const addItem = async (userId, productId) => {
  return sequelize.transaction(async (t) => {
    let wishlist = await Wishlist.findOne({ where: { userId }, transaction: t });
    if (!wishlist) {
      wishlist = await Wishlist.create({ userId }, { transaction: t });
    }

    const product = await Product.findByPk(productId, { transaction: t });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');

    const [item, created] = await WishlistItem.findOrCreate({
      where: { wishlistId: wishlist.id, productId },
      defaults: { wishlistId: wishlist.id, productId },
      transaction: t
    });

    // If duplicate (not created), just return item quietly
    return item;
  });
};

const removeItem = async (userId, productId) => {
  return sequelize.transaction(async (t) => {
    const wishlist = await Wishlist.findOne({ where: { userId }, transaction: t });
    if (!wishlist) throw new AppError('NOT_FOUND', 404, 'Wishlist not found');

    const item = await WishlistItem.findOne({ where: { wishlistId: wishlist.id, productId }, transaction: t });
    if (!item) throw new AppError('NOT_FOUND', 404, 'Item not found in wishlist');

    await item.destroy({ transaction: t });
  });
};

const moveToCart = async (userId, productId) => {
  return sequelize.transaction(async (t) => {
    const wishlist = await Wishlist.findOne({ where: { userId }, transaction: t });
    if (!wishlist) throw new AppError('NOT_FOUND', 404, 'Wishlist not found');

    const item = await WishlistItem.findOne({ where: { wishlistId: wishlist.id, productId }, transaction: t });
    if (!item) throw new AppError('NOT_FOUND', 404, 'Item not found in wishlist');

    const product = await Product.findByPk(productId, { transaction: t });
    if (!product || product.quantity <= 0) {
      throw new AppError('INSUFFICIENT_STOCK', 409, 'Product is out of stock');
    }

    // Now, add to cart
    let cart = await Cart.findOne({ where: { userId, status: 'active' }, transaction: t });
    if (!cart) {
      cart = await Cart.create({ userId, status: 'active' }, { transaction: t });
    }

    const [cartItem, created] = await CartItem.findOrCreate({
      where: { cartId: cart.id, productId, variantId: null },
      defaults: { cartId: cart.id, productId, variantId: null, quantity: 1 },
      transaction: t
    });

    if (!created) {
      await cartItem.increment('quantity', { by: 1, transaction: t });
    }

    // Finally, remove from wishlist
    await item.destroy({ transaction: t });

    return cartItem;
  });
};

module.exports = {
  getWishlist,
  addItem,
  removeItem,
  moveToCart
};
