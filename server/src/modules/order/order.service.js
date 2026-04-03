'use strict';
const { Op } = require('sequelize');
const { sequelize, Order, OrderItem, Cart, CartItem, Product, ProductVariant, Address, Coupon, CouponUsage, Setting } = require('../index');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const CouponService = require('../coupon/coupon.service');
const PaymentService = require('../payment/payment.service');
const { getPagination } = require('../../utils/pagination');
const { ACTIONS, ENTITIES } = require('../../config/constants');

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

    const orderSettingsKeys = ['tax.rate', 'tax.inclusive', 'tax.enableCGST', 'tax.cgstRate', 'tax.enableSGST', 'tax.sgstRate', 'tax.enableIGST', 'tax.igstRate', 'shipping.method', 'shipping.flatRate', 'shipping.freeThreshold'];
    const settingsRows = await Setting.findAll({ where: { key: { [Op.in]: orderSettingsKeys } } });
    const settingsMap = settingsRows.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {});
    const getLocalSetting = (key, defaultVal) => settingsMap[key] !== undefined ? settingsMap[key] : defaultVal;

    const order = await sequelize.transaction(async (t) => {
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

        const globalTaxRate = Number(getLocalSetting('tax.rate', 0));
        const enableCGST = getLocalSetting('tax.enableCGST', false) === true || getLocalSetting('tax.enableCGST', false) === 'true';
        const enableSGST = getLocalSetting('tax.enableSGST', false) === true || getLocalSetting('tax.enableSGST', false) === 'true';
        const enableIGST = getLocalSetting('tax.enableIGST', false) === true || getLocalSetting('tax.enableIGST', false) === 'true';
        const useGST = enableCGST || enableSGST || enableIGST;
        // GST overrides inclusive; inclusive only applies when no GST component is active
        const taxInclusive = !useGST && (getLocalSetting('tax.inclusive', false) === true || getLocalSetting('tax.inclusive', false) === 'true');
        const cgstRate = enableCGST ? Number(getLocalSetting('tax.cgstRate', 0.09)) : 0;
        const sgstRate = enableSGST ? Number(getLocalSetting('tax.sgstRate', 0.09)) : 0;
        const igstRate = enableIGST ? Number(getLocalSetting('tax.igstRate', 0.18)) : 0;

        let totalTax = 0;
        if (!taxInclusive) {
            for (const item of cart.items) {
                const itemSubtotal = item.currentPrice * item.quantity;
                if (useGST) {
                    totalTax += itemSubtotal * (cgstRate + sgstRate + igstRate);
                } else {
                    const taxRate = item.currentProduct.taxRate !== null ? Number(item.currentProduct.taxRate) : globalTaxRate;
                    totalTax += itemSubtotal * taxRate;
                }
            }
        }

        const shippingMethod = getLocalSetting('shipping.method', 'flat_rate');
        let shippingCost = 0;
        if (shippingMethod === 'flat_rate') {
             shippingCost = Number(getLocalSetting('shipping.flatRate', 5));
        } else if (shippingMethod === 'free_above_threshold') {
             const threshold = Number(getLocalSetting('shipping.freeThreshold', 50));
             if (subtotal < threshold) {
                 shippingCost = Number(getLocalSetting('shipping.flatRate', 5));
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
                    [Op.and]: sequelize.literal(`(quantity - reserved_qty) >= ${item.quantity}`)
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
                variantId: item.variantId || null,
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

        return order;
    });

    // createIntent runs OUTSIDE the transaction so a Stripe failure
    // doesn't roll back the order — the order exists, payment can be retried
    let clientSecret = null;
    try {
        const intent = await PaymentService.createIntent(order.userId, order.id);
        clientSecret = intent.clientSecret;
    } catch (err) {
        // Log but don't fail — the order is saved; frontend can retry payment
        clientSecret = null;
    }

    return { order, clientSecret };
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

        if (!['pending_payment', 'processing'].includes(order.status)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Only pending or processing orders can be cancelled');
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
