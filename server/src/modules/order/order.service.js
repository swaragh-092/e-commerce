'use strict';
const { sequelize, Order, OrderItem, Cart, CartItem, Product, ProductVariant, Address, Coupon, CouponUsage, Setting } = require('../index');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const CouponService = require('../coupon/coupon.service');
const { getPagination } = require('../../utils/pagination');

// Utility to fetch settings
const getSetting = async (key, defaultVal) => {
    const setting = await Setting.findOne({ where: { key } });
    if (setting) return setting.value;
    return defaultVal;
};

const placeOrder = async (userId, payload) => {
    const { shippingAddressId, couponCode, notes } = payload;
    
    const cart = await Cart.findOne({
        where: { userId, status: 'active' },
        include: [{
            model: CartItem,
            as: 'items',
            include: [
                { model: Product, as: 'product' },
                { model: ProductVariant, as: 'variant' }
            ]
        }]
    });

    if (!cart || !cart.items || cart.items.length === 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Cart is empty');
    }

    const address = await Address.findOne({ where: { id: shippingAddressId, userId } });
    if (!address) {
        throw new AppError('NOT_FOUND', 404, 'Shipping address not found');
    }
    const shippingAddressSnapshot = address.toJSON();

    return sequelize.transaction(async (t) => {
        let subtotal = 0;

        for (const item of cart.items) {
            const product = item.product;
            if (!product || product.deletedAt !== null) {
                throw new AppError('VALIDATION_ERROR', 400, `Product no longer available`);
            }

            const currentProduct = await Product.findByPk(product.id, { transaction: t, lock: t.LOCK.UPDATE });
            
            let currentPrice = Number(currentProduct.salePrice || currentProduct.price);

            if (item.variantId && item.variant) {
                const currentVariant = await ProductVariant.findByPk(item.variantId, { transaction: t });
                if (currentVariant) {
                    currentPrice += Number(currentVariant.priceModifier);
                }
            }

            subtotal += currentPrice * item.quantity;
            item.currentPrice = currentPrice;
            item.currentProduct = currentProduct;
        }

        let discountAmount = 0;
        let appliedCoupon = null;
        if (couponCode) {
            try {
                const validateResult = await CouponService.validateCoupon(couponCode, userId, subtotal);
                discountAmount = validateResult.discount;
                appliedCoupon = validateResult.coupon;
            } catch (err) {
                 throw err;
            }
        }

        const globalTaxRate = await getSetting('tax.rate', 0);
        let totalTax = 0;
        for (const item of cart.items) {
             const taxRate = item.currentProduct.taxRate !== null ? Number(item.currentProduct.taxRate) : Number(globalTaxRate);
             totalTax += (item.currentPrice * item.quantity) * taxRate;
        }

        const shippingMethod = await getSetting('shipping.method', 'flat_rate');
        let shippingCost = 0;
        if (shippingMethod === 'flat_rate') {
             shippingCost = Number(await getSetting('shipping.flatRate', 5));
        } else if (shippingMethod === 'free_above_threshold') {
             const threshold = Number(await getSetting('shipping.freeThreshold', 50));
             if (subtotal < threshold) {
                 shippingCost = Number(await getSetting('shipping.flatRate', 5));
             }
        }

        const total = subtotal + totalTax + shippingCost - discountAmount;

        for (const item of cart.items) {
            const product = item.currentProduct;
            const updatedRows = await Product.update(
                { reservedQty: sequelize.literal(`reserved_qty + ${item.quantity}`) },
                { 
                  where: { 
                    id: product.id, 
                    [sequelize.Op.and]: sequelize.literal(`(quantity - reserved_qty) >= ${item.quantity}`)
                  }, 
                  transaction: t 
                }
            );
            if (updatedRows[0] === 0) {
                 throw new AppError('CONFLICT', 409, `Insufficient stock for product ${product.name}`);
            }
        }

        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
        const randStr = Math.floor(1000 + Math.random() * 9000);
        const orderNumber = `ORD-${dateStr}-${randStr}`;

        const order = await Order.create({
            orderNumber,
            userId,
            status: 'pending_payment',
            subtotal,
            tax: totalTax,
            shippingCost,
            discountAmount,
            total,
            couponId: appliedCoupon ? appliedCoupon.id : null,
            shippingAddressSnapshot,
            notes
        }, { transaction: t });

        for (const item of cart.items) {
            await OrderItem.create({
                orderId: order.id,
                productId: item.productId,
                snapshotName: item.currentProduct.name,
                snapshotPrice: item.currentPrice,
                snapshotImage: null,
                snapshotSku: item.currentProduct.sku,
                variantInfo: item.variant ? item.variant.toJSON() : null,
                quantity: item.quantity,
                total: item.currentPrice * item.quantity
            }, { transaction: t });
        }

        if (appliedCoupon) {
            await CouponUsage.create({
                couponId: appliedCoupon.id,
                userId,
                orderId: order.id
            }, { transaction: t });
            await Coupon.update({ usedCount: sequelize.literal('used_count + 1') }, { where: { id: appliedCoupon.id }, transaction: t });
        }

        await cart.update({ status: 'converted' }, { transaction: t });

        return {
             order,
             clientSecret: `pi_mock_${orderNumber}_secret_test`
        };
    });
};

const getOrders = async (userId, isAdmin, page = 1, limit = 20) => {
    const { limit: lmt, offset } = getPagination(page, limit);
    const where = isAdmin ? {} : { userId };

    return Order.findAndCountAll({
        where,
        limit: lmt,
        offset,
        order: [['createdAt', 'DESC']],
    });
};

const getOrderById = async (id, userId, isAdmin) => {
    const where = isAdmin ? { id } : { id, userId };
    const order = await Order.findOne({
        where,
        include: [{ model: OrderItem, as: 'items' }]
    });

    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
    return order;
};

const updateStatus = async (id, status, actingUserId) => {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(id, { transaction: t });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

        const before = order.toJSON();
        await order.update({ status }, { transaction: t });

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: 'STATUS_CHANGE',
                    entity: 'Order',
                    entityId: id,
                    changes: { before: before.status, after: status }
                }, t);
            }
        } catch(err) {}
        return order;
    });
};

const cancelOrder = async (id, userId) => {
    return sequelize.transaction(async (t) => {
        const order = await Order.findOne({ where: { id, userId }, include: [{ model: OrderItem, as: 'items' }], transaction: t });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

        if (order.status !== 'pending_payment') {
            throw new AppError('VALIDATION_ERROR', 400, 'Only pending orders can be cancelled');
        }

        await order.update({ status: 'cancelled' }, { transaction: t });

        for (const item of order.items) {
             if (item.productId) {
                 await Product.update(
                     { reservedQty: sequelize.literal(`reserved_qty - ${item.quantity}`) },
                     { where: { id: item.productId }, transaction: t }
                 );
             }
        }

        if (order.couponId) {
             const usage = await CouponUsage.findOne({ where: { orderId: order.id, couponId: order.couponId }, transaction: t });
             if (usage) {
                 await usage.destroy({ transaction: t });
                 await Coupon.update({ usedCount: sequelize.literal('used_count - 1') }, { where: { id: order.couponId }, transaction: t });
             }
        }
        return order;
    });
};

module.exports = {
    placeOrder,
    getOrders,
    getOrderById,
    updateStatus,
    cancelOrder
};
