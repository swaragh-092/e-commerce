'use strict';

const {
  sequelize,
  Wishlist,
  WishlistItem,
  Product,
  ProductImage,
  ProductVariant,
  Cart,
  CartItem,
  VariantOption,
  AttributeTemplate,
  AttributeValue,
} = require('../index');
const AppError = require('../../utils/AppError');
const { getVariantUnitPrice, serializeProductPricing, serializeVariantPricing } = require('../product/product.pricing');

const variantInclude = {
  model: ProductVariant,
  as: 'variant',
  required: false,
  include: [{
    model: VariantOption,
    as: 'options',
    include: [
      { model: AttributeTemplate, as: 'attribute', attributes: ['id', 'name', 'slug'] },
      { model: AttributeValue, as: 'value', attributes: ['id', 'value', 'slug'] },
    ],
  }],
};

const getWishlistItemWhere = (wishlistId, productId, variantId = null) => ({
  wishlistId,
  productId,
  variantId: variantId || null,
});

const addWishlistItemToCart = async (userId, item, transaction) => {
  const product = await Product.findByPk(item.productId, { transaction });
  if (!product || product.status !== 'published' || !product.isEnabled) {
    throw new AppError('NOT_FOUND', 404, 'Product not found or unavailable');
  }

  let variant = null;
  let availableStock = Math.max(0, Number(product.quantity || 0) - Number(product.reservedQty || 0));

  if (item.variantId) {
    variant = await ProductVariant.findOne({ where: { id: item.variantId, productId: item.productId }, transaction });
    if (!variant) {
      throw new AppError('NOT_FOUND', 404, 'Selected variant not found');
    }
    availableStock = Number(variant.stockQty || 0);
  }

  if (availableStock <= 0) {
    throw new AppError('INSUFFICIENT_STOCK', 409, 'Product is out of stock');
  }

  let cart = await Cart.findOne({ where: { userId, status: 'active' }, transaction });
  if (!cart) {
    cart = await Cart.create({ userId, status: 'active' }, { transaction });
  }

  const [cartItem, created] = await CartItem.findOrCreate({
    where: { cartId: cart.id, productId: item.productId, variantId: item.variantId || null },
    defaults: { cartId: cart.id, productId: item.productId, variantId: item.variantId || null, quantity: 1 },
    transaction,
  });

  if (!created) {
    const nextQuantity = cartItem.quantity + 1;
    if (nextQuantity > availableStock) {
      throw new AppError('CONFLICT', 409, 'Insufficient stock');
    }
    await cartItem.increment('quantity', { by: 1, transaction });
  }

  return cartItem;
};

const getWishlist = async (userId) => {
  return sequelize.transaction(async (t) => {
    let wishlist = await Wishlist.findOne({ where: { userId }, transaction: t });
    if (!wishlist) {
      wishlist = await Wishlist.create({ userId }, { transaction: t });
    }

    const items = await WishlistItem.findAll({
      where: { wishlistId: wishlist.id },
      include: [{
        model: Product,
        include: [{
          model: ProductImage,
          as: 'images',
          where: { isPrimary: true },
          required: false,
        }],
        required: false,
      }, variantInclude],
      order: [['createdAt', 'DESC']],
      transaction: t,
    });

    const invalidItems = items.filter((item) => !item.Product || item.Product.status !== 'published' || item.Product.isEnabled === false || (item.variantId && !item.variant));
    if (invalidItems.length > 0) {
      await WishlistItem.destroy({ where: { id: invalidItems.map((item) => item.id) }, transaction: t });
    }

    const activeItems = items
      .filter((item) => !invalidItems.some((invalidItem) => invalidItem.id === item.id))
      .map((item) => {
        const plainItem = item.toJSON();
        const serializedProduct = serializeProductPricing(plainItem.Product);
        const serializedVariant = plainItem.variant
          ? serializeVariantPricing(serializedProduct, plainItem.variant)
          : null;
        const availableStock = serializedVariant
          ? Number(serializedVariant.stockQty || 0)
          : Math.max(0, Number(serializedProduct.quantity || 0) - Number(serializedProduct.reservedQty || 0));

        return {
          ...plainItem,
          Product: serializedProduct,
          variant: serializedVariant,
          availability: {
            inStock: availableStock > 0,
            availableStock,
          },
        };
      });

    return {
      items: activeItems,
      unavailableRemovedCount: invalidItems.length,
    };
  });
};

const addItem = async (userId, productId, variantId = null) => {
  return sequelize.transaction(async (t) => {
    let wishlist = await Wishlist.findOne({ where: { userId }, transaction: t });
    if (!wishlist) {
      wishlist = await Wishlist.create({ userId }, { transaction: t });
    }

    const product = await Product.findByPk(productId, { transaction: t });
    if (!product || product.status !== 'published' || !product.isEnabled) throw new AppError('NOT_FOUND', 404, 'Product not found');

    if (variantId) {
      const variant = await ProductVariant.findOne({ where: { id: variantId, productId }, transaction: t });
      if (!variant) throw new AppError('NOT_FOUND', 404, 'Selected variant not found');
    }

    const [item] = await WishlistItem.findOrCreate({
      where: getWishlistItemWhere(wishlist.id, productId, variantId),
      defaults: getWishlistItemWhere(wishlist.id, productId, variantId),
      transaction: t
    });

    return item;
  });
};

const removeItem = async (userId, productId, variantId = null) => {
  return sequelize.transaction(async (t) => {
    const wishlist = await Wishlist.findOne({ where: { userId }, transaction: t });
    if (!wishlist) throw new AppError('NOT_FOUND', 404, 'Wishlist not found');

    const item = await WishlistItem.findOne({ where: getWishlistItemWhere(wishlist.id, productId, variantId), transaction: t });
    if (!item) throw new AppError('NOT_FOUND', 404, 'Item not found in wishlist');

    await item.destroy({ transaction: t });
  });
};

const moveToCart = async (userId, productId, variantId = null) => {
  return sequelize.transaction(async (t) => {
    const wishlist = await Wishlist.findOne({ where: { userId }, transaction: t });
    if (!wishlist) throw new AppError('NOT_FOUND', 404, 'Wishlist not found');

    const item = await WishlistItem.findOne({ where: getWishlistItemWhere(wishlist.id, productId, variantId), transaction: t });
    if (!item) throw new AppError('NOT_FOUND', 404, 'Item not found in wishlist');

    const cartItem = await addWishlistItemToCart(userId, item, t);

    await item.destroy({ transaction: t });

    return cartItem;
  });
};

const moveAllToCart = async (userId) => {
  return sequelize.transaction(async (t) => {
    const wishlist = await Wishlist.findOne({ where: { userId }, transaction: t });
    if (!wishlist) throw new AppError('NOT_FOUND', 404, 'Wishlist not found');

    const items = await WishlistItem.findAll({ where: { wishlistId: wishlist.id }, transaction: t, order: [['createdAt', 'ASC']] });
    if (items.length === 0) {
      return { movedCount: 0, failedItems: [] };
    }

    const movedIds = [];
    const failedItems = [];

    for (const item of items) {
      try {
        await addWishlistItemToCart(userId, item, t);
        movedIds.push(item.id);
      } catch (error) {
        failedItems.push({
          id: item.id,
          productId: item.productId,
          variantId: item.variantId || null,
          reason: error.message || 'Failed to move item to cart',
        });
      }
    }

    if (movedIds.length > 0) {
      await WishlistItem.destroy({ where: { id: movedIds }, transaction: t });
    }

    return { movedCount: movedIds.length, failedItems };
  });
};

const clearWishlist = async (userId) => {
  return sequelize.transaction(async (t) => {
    const wishlist = await Wishlist.findOne({ where: { userId }, transaction: t });
    if (!wishlist) {
      return { removedCount: 0 };
    }

    const removedCount = await WishlistItem.destroy({ where: { wishlistId: wishlist.id }, transaction: t });
    return { removedCount };
  });
};

module.exports = {
  getWishlist,
  addItem,
  removeItem,
  moveToCart,
  moveAllToCart,
  clearWishlist,
};
