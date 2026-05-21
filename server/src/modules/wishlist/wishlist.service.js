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

const ATTRIBUTE_TEMPLATE_FIELDS = ['id', 'name', 'slug', 'sortOrder', 'displayType', 'valueType', 'unit'];
const ATTRIBUTE_VALUE_FIELDS = ['id', 'value', 'slug', 'sortOrder', 'displayLabel', 'swatchColor', 'imageUrl', 'unitLabel', 'metadata'];

const isWishlistEnabled = async () => {
  const SettingsService = require('../settings/settings.service');
  const { features } = await SettingsService.getFeatures();
  return features.wishlist === true;
};

const isCartEnabled = async () => {
  const SettingsService = require('../settings/settings.service');
  const { features } = await SettingsService.getFeatures();
  return features.cart === true;
};

const variantInclude = {
  model: ProductVariant,
  as: 'variant',
  required: false,
  include: [{
    model: VariantOption,
    as: 'options',
    include: [
      { model: AttributeTemplate, as: 'attribute', attributes: ATTRIBUTE_TEMPLATE_FIELDS },
      { model: AttributeValue, as: 'value', attributes: ATTRIBUTE_VALUE_FIELDS },
    ],
  }],
};

const getWishlistItemWhere = (wishlistId, productId, variantId = null) => ({
  wishlistId,
  productId,
  variantId: variantId || null,
});

const getOwnerWhere = (userId, sessionId) => {
  if (userId) {
    return { userId };
  }
  if (sessionId) {
    return { sessionId };
  }
  throw new AppError('VALIDATION_ERROR', 400, 'Must provide userId or sessionId');
};

const getWishlistByOwner = async (userId, sessionId, transaction) => {
  const whereClause = getOwnerWhere(userId, sessionId);
  let wishlist = await Wishlist.findOne({ where: whereClause, transaction });
  if (!wishlist) {
    wishlist = await Wishlist.create({
      userId: userId || null,
      sessionId: userId ? null : sessionId,
    }, { transaction });
  }
  return wishlist;
};

const addWishlistItemToCart = async (userId, sessionId, item, transaction) => {
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
    availableStock = Math.max(0, Number(variant.stockQty || 0) - Number(variant.reservedQty || 0));
  }

  if (availableStock <= 0) {
    throw new AppError('INSUFFICIENT_STOCK', 409, 'Product is out of stock');
  }

  let cartWhere = {};
  if (userId) {
    cartWhere = { userId, status: 'active' };
  } else if (sessionId) {
    cartWhere = { sessionId, status: 'active' };
  } else {
    throw new AppError('VALIDATION_ERROR', 400, 'Must provide userId or sessionId');
  }

  let cart = await Cart.findOne({ where: cartWhere, transaction });
  if (!cart) {
    cart = await Cart.create({
      userId: userId || null,
      sessionId: userId ? null : sessionId,
      status: 'active',
    }, { transaction });
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

const getWishlist = async (userId, sessionId) => {
  if (!(await isWishlistEnabled())) {
    throw new AppError('FORBIDDEN', 403, 'Wishlist feature is currently disabled');
  }
  return sequelize.transaction(async (t) => {
    const wishlist = await getWishlistByOwner(userId, sessionId, t);

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
          ? Math.max(
            0,
            Number(serializedVariant.stockQty || 0) - Number(serializedVariant.reservedQty || 0)
          )
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

const addItem = async (userId, sessionId, productId, variantId = null) => {
  if (!(await isWishlistEnabled())) {
    throw new AppError('FORBIDDEN', 403, 'Wishlist feature is currently disabled');
  }
  return sequelize.transaction(async (t) => {
    const wishlist = await getWishlistByOwner(userId, sessionId, t);

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

const removeItem = async (userId, sessionId, productId, variantId = null) => {
  return sequelize.transaction(async (t) => {
    const wishlist = await Wishlist.findOne({ where: getOwnerWhere(userId, sessionId), transaction: t });
    if (!wishlist) throw new AppError('NOT_FOUND', 404, 'Wishlist not found');

    const item = await WishlistItem.findOne({ where: getWishlistItemWhere(wishlist.id, productId, variantId), transaction: t });
    if (!item) throw new AppError('NOT_FOUND', 404, 'Item not found in wishlist');

    await item.destroy({ transaction: t });
  });
};

const moveToCart = async (userId, sessionId, productId, variantId = null) => {
  if (!(await isWishlistEnabled())) {
    throw new AppError('FORBIDDEN', 403, 'Wishlist feature is currently disabled');
  }
  if (!(await isCartEnabled())) {
    throw new AppError('FORBIDDEN', 403, 'Cart feature is currently disabled');
  }
  return sequelize.transaction(async (t) => {
    const wishlist = await Wishlist.findOne({ where: getOwnerWhere(userId, sessionId), transaction: t });
    if (!wishlist) throw new AppError('NOT_FOUND', 404, 'Wishlist not found');

    const item = await WishlistItem.findOne({ where: getWishlistItemWhere(wishlist.id, productId, variantId), transaction: t });
    if (!item) throw new AppError('NOT_FOUND', 404, 'Item not found in wishlist');

    const cartItem = await addWishlistItemToCart(userId, sessionId, item, t);

    await item.destroy({ transaction: t });

    return cartItem;
  });
};

const moveAllToCart = async (userId, sessionId) => {
  if (!(await isWishlistEnabled())) {
    throw new AppError('FORBIDDEN', 403, 'Wishlist feature is currently disabled');
  }
  if (!(await isCartEnabled())) {
    throw new AppError('FORBIDDEN', 403, 'Cart feature is currently disabled');
  }
  return sequelize.transaction(async (t) => {
    const wishlist = await Wishlist.findOne({ where: getOwnerWhere(userId, sessionId), transaction: t });
    if (!wishlist) throw new AppError('NOT_FOUND', 404, 'Wishlist not found');

    const items = await WishlistItem.findAll({ where: { wishlistId: wishlist.id }, transaction: t, order: [['createdAt', 'ASC']] });
    if (items.length === 0) {
      return { movedCount: 0, failedItems: [] };
    }

    const movedIds = [];
    const failedItems = [];

    for (const item of items) {
      try {
        await addWishlistItemToCart(userId, sessionId, item, t);
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

const clearWishlist = async (userId, sessionId) => {
  return sequelize.transaction(async (t) => {
    const wishlist = await Wishlist.findOne({ where: getOwnerWhere(userId, sessionId), transaction: t });
    if (!wishlist) {
      return { removedCount: 0 };
    }

    const removedCount = await WishlistItem.destroy({ where: { wishlistId: wishlist.id }, transaction: t });
    return { removedCount };
  });
};

const mergeGuestWishlist = async (guestSessionId, userId) => {
  if (!guestSessionId || !userId) return { mergedCount: 0 };

  return sequelize.transaction(async (t) => {
    const guestWishlist = await Wishlist.findOne({
      where: { sessionId: guestSessionId },
      include: [{ model: WishlistItem }],
      transaction: t,
    });

    const userWishlist = await getWishlistByOwner(userId, null, t);

    if (!guestWishlist || !guestWishlist.WishlistItems || guestWishlist.WishlistItems.length === 0) {
      return { mergedCount: 0, wishlistId: userWishlist.id };
    }

    for (const guestItem of guestWishlist.WishlistItems) {
      await WishlistItem.findOrCreate({
        where: getWishlistItemWhere(userWishlist.id, guestItem.productId, guestItem.variantId),
        defaults: getWishlistItemWhere(userWishlist.id, guestItem.productId, guestItem.variantId),
        transaction: t,
      });
    }

    const mergedCount = guestWishlist.WishlistItems.length;
    await guestWishlist.destroy({ transaction: t });

    return { mergedCount, wishlistId: userWishlist.id };
  });
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
