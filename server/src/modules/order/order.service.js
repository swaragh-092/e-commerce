'use strict';
const { Op } = require('sequelize');
const {
    sequelize,
    Order,
    OrderItem,
    Cart,
    CartItem,
    Product,
    ProductVariant,
    Address,
    Coupon,
    CouponUsage,
    Setting,
    Category,
    Brand,
    User,
    Payment,
} = require('../index');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const CouponService = require('../coupon/coupon.service');
const PaymentService = require('../payment/payment.service');
const { getPagination } = require('../../utils/pagination');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const { getVariantUnitPrice } = require('../product/product.pricing');
const {
    ORDER_DEFAULT_STATUS,
    getAllowedNextStatuses,
    isCustomerCancelableOrderStatus,
    isRefundableOrderStatus,
} = require('../../utils/orderWorkflow');

const ADMIN_ORDER_LIST_USER_ATTRIBUTES = ['id', 'firstName', 'lastName', 'email'];
const ADMIN_ORDER_PAYMENT_ATTRIBUTES = ['id', 'provider', 'status', 'amount', 'currency', 'transactionId', 'createdAt', 'updatedAt'];

const ensureValidStatusTransition = (currentStatus, nextStatus) => {
    if (currentStatus === nextStatus) {
        return;
    }

    const allowedStatuses = getAllowedNextStatuses(currentStatus);
    if (!allowedStatuses.includes(nextStatus)) {
        throw new AppError(
            'VALIDATION_ERROR',
            400,
            `Cannot change order status from ${currentStatus} to ${nextStatus}`
        );
    }
};

// Utility to fetch settings
const getSetting = async (key, defaultVal) => {
    const setting = await Setting.findOne({ where: { key } });
    if (setting) return setting.value;
    return defaultVal;
};

const placeOrder = async (userId, payload) => {
    const { shippingAddressId, couponCode, couponCodes = [], notes, buyNowItem = null } = payload;
    let cart = null;
    let checkoutItems = [];

    if (buyNowItem?.productId) {
        const product = await Product.findByPk(buyNowItem.productId, {
            include: [
                { model: Category, as: 'categories' },
                { model: Brand, as: 'brand' },
            ],
        });

        if (!product) {
            throw new AppError('NOT_FOUND', 404, 'Buy Now product not found');
        }

        let variant = null;
        if (buyNowItem.variantId) {
            variant = await ProductVariant.findOne({
                where: { id: buyNowItem.variantId, productId: buyNowItem.productId },
            });

            if (!variant) {
                throw new AppError('NOT_FOUND', 404, 'Selected product variant not found');
            }
        }

        const quantity = Number(buyNowItem.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new AppError('VALIDATION_ERROR', 400, 'Invalid quantity for Buy Now item');
        }

        checkoutItems = [{
            productId: product.id,
            variantId: variant?.id || null,
            quantity,
            product,
            variant,
        }];
    } else {
        cart = await Cart.findOne({
            where: { userId, status: 'active' },
            include: [{
                model: CartItem,
                as: 'items',
                include: [
                    {
                        model: Product,
                        as: 'product',
                        include: [
                            { model: Category, as: 'categories' },
                            { model: Brand, as: 'brand' },
                        ],
                    },
                    { model: ProductVariant, as: 'variant' }
                ]
            }]
        });

        if (!cart || !cart.items || cart.items.length === 0) {
            throw new AppError('VALIDATION_ERROR', 400, 'Cart is empty');
        }

        checkoutItems = cart.items;
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

        for (const item of checkoutItems) {
            const product = item.product;
            if (!product) {
                throw new AppError('VALIDATION_ERROR', 400, 'One or more products in your cart are no longer available. Please clear your cart and try again.');
            }
            if (product.status !== 'published') {
                throw new AppError('VALIDATION_ERROR', 400, `"${product.name}" is not available for purchase. Please remove it from your cart.`);
            }

            const currentProduct = await Product.findByPk(product.id, { transaction: t, lock: t.LOCK.UPDATE });
            if (!currentProduct) {
                throw new AppError(
                    'VALIDATION_ERROR',
                    400,
                    `"${product.name}" is no longer available. Please remove it from your cart before checkout.`
                );
            }
            
            let currentPrice = getVariantUnitPrice(currentProduct, null);

            if (item.variantId) {
                const currentVariant = await ProductVariant.findByPk(item.variantId, { transaction: t });
                if (!currentVariant) {
                    throw new AppError('VALIDATION_ERROR', 400, `The selected variant for "${product.name}" is no longer available.`);
                }

                currentPrice = getVariantUnitPrice(currentProduct, currentVariant);
                item.variant = currentVariant;
            }

            subtotal += currentPrice * item.quantity;
            item.currentPrice = currentPrice;
            item.currentProduct = {
                ...(typeof currentProduct.toJSON === 'function' ? currentProduct.toJSON() : currentProduct),
                categories: product.categories || [],
                brand: product.brand || null,
            };
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
            for (const item of checkoutItems) {
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

        const requestedCouponCodes = [...new Set([
            ...couponCodes,
            couponCode,
        ].filter(Boolean).map((code) => String(code).trim().toUpperCase()))];

        let orderDiscountAmount = 0;
        let appliedCoupon = null;
        let couponBenefits = null;
        if (requestedCouponCodes.length > 0) {
            couponBenefits = await CouponService.resolveCoupons(requestedCouponCodes, userId, {
                cartSubtotal: subtotal,
                cartItems: checkoutItems,
                shippingCost,
            });
        } else {
            couponBenefits = await CouponService.resolveCoupons([], userId, {
                cartSubtotal: subtotal,
                cartItems: checkoutItems,
                shippingCost,
            });
        }

        orderDiscountAmount = Number(couponBenefits?.orderDiscount || 0);
        appliedCoupon = couponBenefits?.primaryCoupon || couponBenefits?.coupon || null;

        let shippingDiscount = 0;
        if (couponBenefits?.freeShipping) {
            shippingDiscount = Number(couponBenefits.shippingDiscount || shippingCost || 0);
            shippingCost = 0;
        }

        const discountAmount = Number((orderDiscountAmount + shippingDiscount).toFixed(2));

        const total = subtotal + totalTax + shippingCost - discountAmount;

        for (const item of checkoutItems) {
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
            status: ORDER_DEFAULT_STATUS,
            subtotal,
            tax: totalTax,
            shippingCost,
            discountAmount,
            total,
            couponId: appliedCoupon ? appliedCoupon.id : null,
            appliedDiscounts: (couponBenefits?.appliedCoupons || []).map((coupon) => ({
                couponId: coupon.id,
                code: coupon.code,
                name: coupon.name,
                type: coupon.type,
                applicationMode: coupon.applicationMode,
                orderDiscount: Number(coupon.orderDiscount || 0),
                shippingDiscount: Number(coupon.shippingDiscount || 0),
                totalDiscount: Number(coupon.totalDiscount || 0),
            })),
            shippingAddressSnapshot,
            notes
        }, { transaction: t });

        for (const item of checkoutItems) {
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

        const appliedCouponIds = (couponBenefits?.appliedCoupons || []).map((coupon) => coupon.id);
        for (const appliedItem of couponBenefits?.appliedCoupons || []) {
            await CouponUsage.create({
                couponId: appliedItem.id,
                userId,
                orderId: order.id
            }, { transaction: t });
        }
        if (appliedCouponIds.length > 0) {
            await Coupon.update(
                { usedCount: sequelize.literal('used_count + 1') },
                { where: { id: { [Op.in]: appliedCouponIds } }, transaction: t }
            );
        }

        if (cart) {
            await cart.update({ status: 'converted' }, { transaction: t });
        }

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

    try {
        if (AuditService && AuditService.log) {
            await AuditService.log({
                userId,
                action: ACTIONS.CREATE,
                entity: ENTITIES.ORDER,
                entityId: order.id,
                changes: {
                    status: order.status,
                    total: order.total,
                },
            });
        }
    } catch (err) {}

    return { order, clientSecret };
};

const getOrders = async (userId, isAdmin, page = 1, limit = 20, filters = {}) => {
    const { limit: lmt, offset } = getPagination(page, limit);
    const where = isAdmin ? {} : { userId };

    const normalizedStatus = typeof filters.status === 'string' ? filters.status.trim() : '';
    const normalizedSearch = typeof filters.search === 'string' ? filters.search.trim() : '';

    if (normalizedStatus) {
        where.status = normalizedStatus;
    }

    const include = [];

    if (isAdmin) {
        include.push({
            model: User,
            attributes: ADMIN_ORDER_LIST_USER_ATTRIBUTES,
            required: false,
        });
        include.push({
            model: Payment,
            attributes: ADMIN_ORDER_PAYMENT_ATTRIBUTES,
            required: false,
        });

        if (normalizedSearch) {
            const searchPattern = `%${normalizedSearch}%`;
            where[Op.or] = [
                { orderNumber: { [Op.iLike]: searchPattern } },
                { '$User.firstName$': { [Op.iLike]: searchPattern } },
                { '$User.lastName$': { [Op.iLike]: searchPattern } },
                { '$User.email$': { [Op.iLike]: searchPattern } },
            ];
        }
    }

    return Order.findAndCountAll({
        where,
        include,
        limit: lmt,
        offset,
        order: [['createdAt', 'DESC']],
        distinct: true,
        subQuery: false,
    });
};

const getOrderById = async (id, userId, isAdmin) => {
    const where = isAdmin ? { id } : { id, userId };
    const order = await Order.findOne({
        where,
        include: [
            {
                model: OrderItem,
                as: 'items',
                include: [
                    { model: Product, as: 'product', attributes: ['id', 'name', 'slug'], required: false },
                    { model: ProductVariant, as: 'variant', attributes: ['id', 'name', 'sku'], required: false },
                ],
            },
            { model: User, attributes: ADMIN_ORDER_LIST_USER_ATTRIBUTES, required: false },
            { model: Payment, attributes: ADMIN_ORDER_PAYMENT_ATTRIBUTES, required: false },
            { model: Coupon, attributes: ['id', 'code', 'name'], required: false },
        ],
    });

    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
    return order;
};

const updateStatus = async (id, status, actingUserId) => {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(id, { transaction: t });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

        const before = order.toJSON();
        ensureValidStatusTransition(order.status, status);
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

const refundOrder = async (id, actingUserId) => {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(id, {
            include: [{ model: Payment, attributes: ADMIN_ORDER_PAYMENT_ATTRIBUTES, required: false }],
            transaction: t,
            lock: t.LOCK.UPDATE,
        });

        if (!order) {
            throw new AppError('NOT_FOUND', 404, 'Order not found');
        }

        if (!isRefundableOrderStatus(order.status)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Only paid, processing, shipped, or delivered orders can be refunded');
        }

        const previousStatus = order.status;
        await order.update({ status: 'refunded' }, { transaction: t });

        if (order.Payment && order.Payment.status !== 'refunded') {
            const currentMetadata = order.Payment.metadata && typeof order.Payment.metadata === 'object'
                ? order.Payment.metadata
                : {};

            await order.Payment.update({
                status: 'refunded',
                metadata: {
                    ...currentMetadata,
                    manualRefund: {
                        refundedAt: new Date().toISOString(),
                        refundedBy: actingUserId,
                    },
                },
            }, { transaction: t });
        }

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: ACTIONS.STATUS_CHANGE,
                    entity: ENTITIES.ORDER,
                    entityId: id,
                    changes: { before: previousStatus, after: 'refunded' },
                }, t);
            }
        } catch (err) {}

        return Order.findByPk(id, {
            include: [
                { model: OrderItem, as: 'items' },
                { model: User, attributes: ADMIN_ORDER_LIST_USER_ATTRIBUTES, required: false },
                { model: Payment, attributes: ADMIN_ORDER_PAYMENT_ATTRIBUTES, required: false },
                { model: Coupon, attributes: ['id', 'code', 'name'], required: false },
            ],
            transaction: t,
        });
    });
};

const cancelOrder = async (id, userId) => {
    return sequelize.transaction(async (t) => {
        const order = await Order.findOne({ where: { id, userId }, include: [{ model: OrderItem, as: 'items' }], transaction: t });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

        const previousStatus = order.status;

        if (!isCustomerCancelableOrderStatus(order.status)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Only pending or processing orders can be cancelled');
        }

        await order.update({ status: 'cancelled' }, { transaction: t });

        for (const item of order.items) {
             if (item.productId) {
                 await Product.update(
                     // GREATEST prevents underflow if the job already decremented
                     { reservedQty: sequelize.literal(`GREATEST(reserved_qty - ${item.quantity}, 0)`) },
                     {
                         where: {
                             id: item.productId,
                             reservedQty: { [Op.gt]: 0 },
                         },
                         transaction: t,
                     }
                 );
             }
        }

        const appliedCouponIds = Array.from(new Set([
            ...(Array.isArray(order.appliedDiscounts) ? order.appliedDiscounts.map((item) => item.couponId).filter(Boolean) : []),
            order.couponId,
        ].filter(Boolean)));
        if (appliedCouponIds.length > 0) {
             const usages = await CouponUsage.findAll({ where: { orderId: order.id, couponId: { [Op.in]: appliedCouponIds } }, transaction: t });
             for (const usage of usages) {
                 await usage.destroy({ transaction: t });
             }
             await Coupon.update(
                 { usedCount: sequelize.literal('used_count - 1') },
                 { where: { id: { [Op.in]: appliedCouponIds } }, transaction: t }
             );
        }

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId,
                    action: ACTIONS.STATUS_CHANGE,
                    entity: ENTITIES.ORDER,
                    entityId: order.id,
                    changes: { before: previousStatus, after: 'cancelled' },
                }, t);
            }
        } catch (err) {}

        return order;
    });
};

module.exports = {
    placeOrder,
    getOrders,
    getOrderById,
    updateStatus,
    cancelOrder,
    refundOrder,
    getAllowedNextStatuses,
};
