'use strict';
const { sequelize, Cart, CartItem, Product, ProductImage, ProductVariant } = require('../index');
const AppError = require('../../utils/AppError');

const getActiveCartByOwner = async (userId, sessionId, transaction) => {
    let whereClause = {};
    if (userId) {
        whereClause = { userId, status: 'active' };
    } else if (sessionId) {
        whereClause = { sessionId, status: 'active' };
    } else {
        throw new AppError('VALIDATION_ERROR', 400, 'Must provide userId or sessionId');
    }

    let cart = await Cart.findOne({ where: whereClause, transaction });
    if (!cart) {
        cart = await Cart.create({
            userId: userId || null,
            sessionId: !userId ? sessionId : null,
            status: 'active'
        }, { transaction });
    }
    return cart;
};

// Shared helper — reads cart+items within an existing transaction
const fetchCartWithItems = async (cartId, transaction) => {
    const cartWithItems = await Cart.findByPk(cartId, {
        include: [{
            model: CartItem,
            as: 'items',
            include: [
                {
                    model: Product,
                    as: 'product',
                    required: false,
                    include: [{ model: ProductImage, as: 'images' }]
                },
                { model: ProductVariant, as: 'variant', required: false }
            ]
        }],
        transaction
    });

    const items = cartWithItems.items
        ? cartWithItems.items.filter(item => item.product !== null)
        : [];

    return {
        id: cartWithItems.id,
        status: cartWithItems.status,
        userId: cartWithItems.userId,
        sessionId: cartWithItems.sessionId,
        items
    };
};

const getCart = async (userId, sessionId) => {
    return sequelize.transaction(async (t) => {
        const cart = await getActiveCartByOwner(userId, sessionId, t);
        return fetchCartWithItems(cart.id, t);
    });
};

const addItem = async (userId, sessionId, payload) => {
    return sequelize.transaction(async (t) => {
        const cart = await getActiveCartByOwner(userId, sessionId, t);
        const { productId, variantId, quantity = 1 } = payload;

        const product = await Product.findByPk(productId, { transaction: t });
        if (!product) {
            throw new AppError('NOT_FOUND', 404, 'Product not found or unavailable');
        }

        let availableStock;
        if (variantId) {
            const variant = await ProductVariant.findOne({
                where: { id: variantId, productId },
                transaction: t,
            });
            if (!variant) {
                throw new AppError('NOT_FOUND', 404, 'Variant not found');
            }
            availableStock = variant.quantity;
        } else {
            availableStock = product.quantity - (product.reservedQty || 0);
        }

        let item = await CartItem.findOne({
            where: { cartId: cart.id, productId, variantId: variantId || null },
            transaction: t
        });

        if (item) {
            const newQty = item.quantity + quantity;
            if (newQty > availableStock) {
                throw new AppError('CONFLICT', 409, 'Insufficient stock');
            }
            await item.update({ quantity: newQty }, { transaction: t });
        } else {
            if (quantity > availableStock) {
                throw new AppError('CONFLICT', 409, 'Insufficient stock');
            }
            item = await CartItem.create({
                cartId: cart.id,
                productId,
                variantId: variantId || null,
                quantity
            }, { transaction: t });
        }

        return fetchCartWithItems(cart.id, t);
    });
};

const updateItem = async (userId, sessionId, itemId, quantity) => {
    return sequelize.transaction(async (t) => {
        const cart = await getActiveCartByOwner(userId, sessionId, t);
        
        const item = await CartItem.findOne({
            where: { id: itemId, cartId: cart.id },
            include: [{ model: Product, as: 'product' }],
            transaction: t
        });

        if (!item) throw new AppError('NOT_FOUND', 404, 'Cart item not found');

        const product = item.product;
        // Verify product logic
        if (!product || product.deletedAt !== null) {
            await item.destroy({ transaction: t });
            throw new AppError('NOT_FOUND', 404, 'Product no longer available and removed from cart');
        }

        const availableStock = product.quantity - (product.reservedQty || 0);
        if (quantity > availableStock) {
             throw new AppError('CONFLICT', 409, 'Insufficient stock');
        }

        await item.update({ quantity }, { transaction: t });
        return fetchCartWithItems(cart.id, t);
    });
};

const removeItem = async (userId, sessionId, itemId) => {
    return sequelize.transaction(async (t) => {
        const cart = await getActiveCartByOwner(userId, sessionId, t);
        const item = await CartItem.findOne({
            where: { id: itemId, cartId: cart.id },
            transaction: t
        });
        if (!item) throw new AppError('NOT_FOUND', 404, 'Cart item not found');
        
        await item.destroy({ transaction: t });
        return fetchCartWithItems(cart.id, t);
    });
};

const clearCart = async (userId, sessionId) => {
    return sequelize.transaction(async (t) => {
        const cart = await getActiveCartByOwner(userId, sessionId, t);
        await CartItem.destroy({ where: { cartId: cart.id }, transaction: t });
        return { success: true };
    });
};

const mergeGuestCart = async (guestSessionId, userId) => {
    if (!guestSessionId || !userId) return;

    return sequelize.transaction(async (t) => {
        const guestCart = await Cart.findOne({ 
            where: { sessionId: guestSessionId, status: 'active' },
            include: [{ model: CartItem, as: 'items' }],
            transaction: t 
        });

        if (!guestCart || !guestCart.items || guestCart.items.length === 0) {
            const userCart = await getActiveCartByOwner(userId, null, t);
            return fetchCartWithItems(userCart.id, t);
        }

        const userCart = await getActiveCartByOwner(userId, null, t);

        for (const guestItem of guestCart.items) {
            const existingItem = await CartItem.findOne({
                where: { 
                    cartId: userCart.id, 
                    productId: guestItem.productId, 
                    variantId: guestItem.variantId 
                },
                transaction: t
            });

            if (existingItem) {
                await existingItem.update({
                    quantity: existingItem.quantity + guestItem.quantity
                }, { transaction: t });
            } else {
                await CartItem.create({
                    cartId: userCart.id,
                    productId: guestItem.productId,
                    variantId: guestItem.variantId,
                    quantity: guestItem.quantity
                }, { transaction: t });
            }
        }

        await guestCart.update({ status: 'merged' }, { transaction: t });
        return fetchCartWithItems(userCart.id, t);
    });
};

module.exports = {
    getCart,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    mergeGuestCart
};
