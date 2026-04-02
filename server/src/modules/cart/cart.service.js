'use strict';
const { sequelize } = require('../../config/database');
const { Cart, CartItem, Product, ProductVariant } = require('../../models');
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

const getCart = async (userId, sessionId) => {
    return sequelize.transaction(async (t) => {
        const cart = await getActiveCartByOwner(userId, sessionId, t);
        
        const cartWithItems = await Cart.findByPk(cart.id, {
            include: [{
                model: CartItem,
                as: 'items',
                include: [
                    { 
                        model: Product, 
                        as: 'product',
                        where: { deletedAt: null }, 
                        required: false 
                    },
                    {
                        model: ProductVariant,
                        as: 'variant',
                        required: false
                    }
                ]
            }],
            transaction: t
        });

        const items = cartWithItems.items ? cartWithItems.items.filter(item => item.product !== null) : [];
        
        return {
            id: cartWithItems.id,
            status: cartWithItems.status,
            userId: cartWithItems.userId,
            sessionId: cartWithItems.sessionId,
            items: items
        };
    });
};

const addItem = async (userId, sessionId, payload) => {
    return sequelize.transaction(async (t) => {
        const cart = await getActiveCartByOwner(userId, sessionId, t);
        const { productId, variantId, quantity = 1 } = payload;

        const product = await Product.findByPk(productId, { transaction: t });
        if (!product || product.deletedAt !== null) {
            throw new AppError('NOT_FOUND', 404, 'Product not found');
        }

        const availableStock = product.quantity - product.reservedQty;
        
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

        return await getCart(userId, sessionId);
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

        const availableStock = product.quantity - product.reservedQty;
        if (quantity > availableStock) {
             throw new AppError('CONFLICT', 409, 'Insufficient stock');
        }

        await item.update({ quantity }, { transaction: t });
        return await getCart(userId, sessionId);
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
        return await getCart(userId, sessionId);
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

        if (!guestCart || !guestCart.items || guestCart.items.length === 0) return await getCart(userId, null);

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
        return await getCart(userId, null);
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
