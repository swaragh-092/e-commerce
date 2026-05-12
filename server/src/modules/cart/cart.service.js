'use strict';
const { Transaction } = require('sequelize');
const {
    sequelize,
    Cart,
    CartItem,
    Product,
    ProductImage,
    ProductVariant,
    VariantOption,
    AttributeTemplate,
    AttributeValue,
} = require('../index');
const AppError = require('../../utils/AppError');
const { serializeProductPricing, serializeVariantPricing } = require('../product/product.pricing');

const ATTRIBUTE_TEMPLATE_FIELDS = ['id', 'name', 'slug', 'sortOrder', 'displayType', 'valueType', 'unit'];
const ATTRIBUTE_VALUE_FIELDS = ['id', 'value', 'slug', 'sortOrder', 'displayLabel', 'swatchColor', 'imageUrl', 'unitLabel', 'metadata'];

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

const fetchCartWithItems = async (cartId, transaction) => {
    const cartWithItems = await Cart.findByPk(cartId, {
        include: [{
            model: CartItem,
            as: 'items',
            separate: true,
            order: [['createdAt', 'ASC'], ['id', 'ASC']],
            include: [
                {
                    model: Product,
                    as: 'product',
                    required: false,
                    include: [{ model: ProductImage, as: 'images' }]
                },
                variantInclude,
            ]
        }],
        transaction
    });

    const items = cartWithItems.items
        ? cartWithItems.items.filter(item => item.product !== null && item.product.isEnabled !== false)
            .map((item) => {
                const plainItem = item.toJSON();
                const serializedProduct = serializeProductPricing(item.product);

                return {
                    ...plainItem,
                    product: serializedProduct,
                    variant: plainItem.variant
                        ? serializeVariantPricing(serializedProduct, plainItem.variant)
                        : null,
                };
            })
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
        // Lock the cart to prevent concurrent item additions from bypassing stock limits
        await Cart.findByPk(cart.id, { transaction: t, lock: Transaction.LOCK.UPDATE });
        const { productId, variantId, quantity = 1 } = payload;

        const product = await Product.findByPk(productId, { transaction: t, lock: Transaction.LOCK.UPDATE });
        if (!product || !product.isEnabled) {
            throw new AppError('NOT_FOUND', 404, 'Product not found or unavailable');
        }

        let availableStock;
        if (variantId) {
            const variant = await ProductVariant.findOne({
                where: { id: variantId, productId },
                transaction: t,
                lock: Transaction.LOCK.UPDATE,
            });
            if (!variant) {
                throw new AppError('NOT_FOUND', 404, 'Variant not found');
            }
            availableStock = Number(variant.stockQty || 0) - Number(variant.reservedQty || 0);
        } else {
            availableStock = Number(product.quantity || 0) - Number(product.reservedQty || 0);
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
        // Lock the cart to prevent concurrent updates
        await Cart.findByPk(cart.id, { transaction: t, lock: Transaction.LOCK.UPDATE });
        
        const item = await CartItem.findOne({
            where: { id: itemId, cartId: cart.id },
            transaction: t,
            lock: Transaction.LOCK.UPDATE // Lock the cart item itself
        });

        if (!item) throw new AppError('NOT_FOUND', 404, 'Cart item not found');

        // Fetch associations separately: Postgres can reject FOR UPDATE on nullable outer joins.
        const product = await Product.findByPk(item.productId, {
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });

        let variant = null;
        if (item.variantId) {
            variant = await ProductVariant.findOne({
                where: { id: item.variantId, productId: item.productId },
                transaction: t,
                lock: Transaction.LOCK.UPDATE,
            });
        }

        if (!product || product.deletedAt !== null || !product.isEnabled) {
            await item.destroy({ transaction: t });
            throw new AppError('NOT_FOUND', 404, 'Product no longer available and removed from cart');
        }

        if (item.variantId && (!variant || variant.deletedAt !== null || variant.isActive === false)) {
            await item.destroy({ transaction: t });
            throw new AppError('NOT_FOUND', 404, 'Variant no longer available and removed from cart');
        }

        const availableStock = item.variantId
            ? Number(variant.stockQty || 0) - Number(variant.reservedQty || 0)
            : Number(product.quantity || 0) - Number(product.reservedQty || 0);
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
