'use strict';
const { Op, Transaction } = require('sequelize');
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
    Fulfillment,
    FulfillmentItem,
    Shipment,
    ShipmentItem,
    ShippingProvider,
} = require('../index');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const CouponService = require('../coupon/coupon.service');
const PaymentService = require('../payment/payment.service');
const TaxService = require('../tax/tax.service');
const ShippingService = require('../shipping/shipping.service');
const { resolveProvider } = require('../shipping/providers');

const defaultSettings = require('../../../../config/default.json');

const NotificationService = require('../notification/notification.service');

const { getPagination } = require('../../utils/pagination');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const { getVariantUnitPrice } = require('../product/product.pricing');
const {
    ORDER_DEFAULT_STATUS,
    getAllowedNextStatuses,
    isCustomerCancelableOrderStatus,
    isRefundableOrderStatus,
    isFulfillableOrderStatus,
    ensureValidStatusTransition,
} = require('../../utils/orderWorkflow');

const ADMIN_ORDER_LIST_USER_ATTRIBUTES = ['id', 'firstName', 'lastName', 'email'];
const ADMIN_ORDER_PAYMENT_ATTRIBUTES = ['id', 'provider', 'status', 'amount', 'currency', 'transactionId', 'createdAt', 'updatedAt'];

const FULFILLMENT_STATUS_TRANSITIONS = Object.freeze({
    pending: ['shipped', 'delivered'],
    shipped: ['delivered', 'returned'],
    delivered: ['returned'],
    returned: [],
});

const PAYMENT_METHODS = ['razorpay', 'stripe', 'payu', 'cashfree', 'cod'];
const PAYMENT_METHOD_NAMES = {
    razorpay: 'Razorpay',
    stripe: 'Stripe',
    payu: 'PayU',
    cashfree: 'Cashfree',
    cod: 'Cash on Delivery',
};
const DEFAULT_PAYMENT_SETTINGS = {
    razorpayEnabled: true,
    stripeEnabled: false,
    payuEnabled: false,
    cashfreeEnabled: false,
    codEnabled: true,
    defaultMethod: 'razorpay',
};


const HEAVY_ORDER_INCLUDE = [
    {
        model: OrderItem,
        as: 'items',
        include: [
            { model: Product, as: 'product', attributes: ['id', 'name', 'slug'], required: false },
            { model: ProductVariant, as: 'variant', attributes: ['id', 'sku', 'price', 'stockQty', 'isActive'], required: false },
            { model: FulfillmentItem, as: 'fulfillmentItems', attributes: ['quantity'], required: false },
        ],
    },
    { model: User, attributes: ADMIN_ORDER_LIST_USER_ATTRIBUTES, required: false },
    { model: Payment, attributes: ADMIN_ORDER_PAYMENT_ATTRIBUTES, required: false },
    { model: Coupon, attributes: ['id', 'code', 'name'], required: false },
    {
        model: Fulfillment,
        as: 'fulfillments',
        include: [
            {
                model: FulfillmentItem,
                as: 'items',
                include: [
                    { model: OrderItem, as: 'orderItem', attributes: ['id', 'snapshotName', 'snapshotSku', 'snapshotImage', 'variantInfo'] },
                ],
            },
            {
                model: Shipment,
                as: 'shipments',
                required: false,
                include: [
                    { model: ShipmentItem, as: 'items', required: false },
                    { model: ShippingProvider, as: 'provider', attributes: ['id', 'code', 'name', 'type'], required: false },
                ],
            },
        ],
    },
];

// Utility to fetch settings
const getSetting = async (key, defaultVal) => {
    const setting = await Setting.findOne({ where: { key } });
    if (setting) return setting.value;
    return defaultVal;
};


const buildSettingsSnapshot = async (groups = ['tax', 'shipping']) => {
    const rows = await Setting.findAll({ where: { group: { [Op.in]: groups } } });
    const snapshot = {};

    for (const group of groups) {
        const defaults = defaultSettings[group] || {};
        Object.entries(defaults).forEach(([key, value]) => {
            snapshot[`${group}.${key}`] = value;
        });
    }

    rows.forEach((setting) => {
        snapshot[`${setting.group}.${setting.key}`] = setting.value;
    });

    return snapshot;
};

const ensureValidFulfillmentTransition = (currentStatus, nextStatus) => {
    if (currentStatus === nextStatus) return;
    const allowedStatuses = FULFILLMENT_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedStatuses.includes(nextStatus)) {
        throw new AppError(
            'VALIDATION_ERROR',
            400,
            `Cannot change shipment status from ${currentStatus} to ${nextStatus}`
        );
    }
};

const calculateFulfillmentProgress = (order) => {
    const items = order?.items || [];
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const fulfilledQuantity = items.reduce((sum, item) => (
        sum + (item.fulfillmentItems || []).reduce((itemSum, fulfillmentItem) => itemSum + Number(fulfillmentItem.quantity || 0), 0)
    ), 0);

    return {
        totalQuantity,
        fulfilledQuantity,
        remainingQuantity: Math.max(totalQuantity - fulfilledQuantity, 0),
        percent: totalQuantity > 0 ? Math.round((fulfilledQuantity / totalQuantity) * 100) : 0,
    };
};

const buildOrderTimeline = (order, progress) => {
    const payment = order.Payment || order.Payment?.toJSON?.() || null;
    const paymentStatus = payment?.status;
    const isCod = order.paymentMethod === 'cod';
    const isCancelled = order.status === 'cancelled';
    const isRefunded = order.status === 'refunded' || paymentStatus === 'refunded';
    const isPaymentSettled = ['paid', 'processing', 'partially_shipped', 'shipped', 'delivered', 'refunded'].includes(order.status)
        || ['completed', 'cod_collected', 'refunded'].includes(paymentStatus);
    const isFullyFulfilled = order.status === 'delivered' || (progress.fulfilledQuantity > 0 && progress.remainingQuantity === 0);

    const steps = [
        {
            key: 'placed',
            label: 'Order placed',
            status: 'completed',
            occurredAt: order.createdAt,
        },
        {
            key: isCod ? 'pending_cod' : 'pending_payment',
            label: isCod ? 'Pending COD' : 'Pending payment',
            status: isPaymentSettled || ['pending_cod', 'processing'].includes(order.status) ? 'completed' : 'active',
        },
        {
            key: 'paid',
            label: isCod ? 'COD collected' : 'Payment captured',
            status: isPaymentSettled ? 'completed' : 'pending',
        },
        {
            key: 'processing',
            label: 'Processing',
            status: ['processing', 'partially_shipped', 'shipped', 'delivered'].includes(order.status) ? 'completed' : 'pending',
        },
        {
            key: 'shipped',
            label: progress.remainingQuantity > 0 && progress.fulfilledQuantity > 0 ? 'Partially shipped' : 'Shipped',
            status: progress.fulfilledQuantity > 0 ? (isFullyFulfilled ? 'completed' : 'active') : 'pending',
        },
        {
            key: 'delivered',
            label: 'Delivered',
            status: order.status === 'delivered' ? 'completed' : 'pending',
        },
    ];

    if (isCancelled || isRefunded) {
        const terminalSteps = steps.filter((step) => {
            if (['placed', isCod ? 'pending_cod' : 'pending_payment'].includes(step.key)) return true;
            if (step.key === 'paid') return isPaymentSettled;
            return false;
        });

        return [
            ...terminalSteps,
            {
                key: order.status,
                label: isRefunded ? 'Refunded' : 'Cancelled',
                status: 'terminal',
                occurredAt: order.updatedAt,
            },
        ];
    }

    return steps;
};

const releaseOrderReservationsAndCoupons = async (order, transaction) => {
    const orderItems = order.items || await OrderItem.findAll({
        where: { orderId: order.id },
        transaction,
    });

    for (const item of orderItems) {
        if (item.productId) {
            await Product.update(
                { reservedQty: sequelize.literal(`GREATEST(reserved_qty - ${item.quantity}, 0)`) },
                {
                    where: {
                        id: item.productId,
                        reservedQty: { [Op.gt]: 0 },
                    },
                    transaction,
                }
            );
        }
    }

    const appliedCouponIds = Array.from(new Set([
        ...(Array.isArray(order.appliedDiscounts) ? order.appliedDiscounts.map((item) => item.couponId).filter(Boolean) : []),
        order.couponId,
    ].filter(Boolean)));

    if (appliedCouponIds.length > 0) {
        const usages = await CouponUsage.findAll({
            where: { orderId: order.id, couponId: { [Op.in]: appliedCouponIds } },
            transaction,
        });

        for (const usage of usages) {
            await usage.destroy({ transaction });
        }

        if (usages.length > 0) {
            await Coupon.update(
                { usedCount: sequelize.literal(`GREATEST(used_count - 1, 0)`) },
                { where: { id: { [Op.in]: appliedCouponIds } }, transaction }
            );
        }
    }
};

const getPaymentSettings = async () => {
    const rows = await Setting.findAll({ where: { group: 'payments' } });
    return rows.reduce(
        (settings, row) => {
            let parsedValue = row.value;
            if (parsedValue === 'true') parsedValue = true;
            else if (parsedValue === 'false') parsedValue = false;
            return { ...settings, [row.key]: parsedValue };
        },
        { ...DEFAULT_PAYMENT_SETTINGS }
    );
};

const ensurePaymentMethodEnabled = async (paymentMethod) => {
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid payment method');
    }

    const paymentSettings = await getPaymentSettings();
    const enabledKey = `${paymentMethod}Enabled`;
    if (paymentSettings[enabledKey] !== true) {
        throw new AppError('VALIDATION_ERROR', 400, 'Selected payment method is not available');
    }

    if (paymentMethod !== 'cod') {
        const statuses = await PaymentService.getGatewayStatuses();
        const gateway = statuses.find(s => s.id === paymentMethod);
        if (gateway && !gateway.connected) {
            throw new AppError(
                'PAYMENT_UNAVAILABLE',
                503,
                `${PAYMENT_METHOD_NAMES[paymentMethod]} is enabled for display but its gateway integration is not connected yet`

            );
        }
    }
};

const placeOrder = async (userId, payload) => {
    const { shippingAddressId, couponCode, couponCodes = [], notes, buyNowItem = null, paymentMethod = 'razorpay' } = payload;
    let cart = null;
    let checkoutItems = [];

    await ensurePaymentMethodEnabled(paymentMethod);

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

    const settingsMap = await buildSettingsSnapshot(['tax', 'shipping']);
    const getLocalSetting = (key, defaultVal) => settingsMap[key] !== undefined ? settingsMap[key] : defaultVal;

    const order = await sequelize.transaction(async (t) => {
        let subtotal = 0;

        for (const item of checkoutItems) {
            const product = item.product;
            if (!product) {
                throw new AppError('VALIDATION_ERROR', 400, 'One or more products in your cart are no longer available. Please clear your cart and try again.');
            }
            if (product.status !== 'published' || product.isEnabled === false) {
                throw new AppError('VALIDATION_ERROR', 400, `"${product.name}" is not available for purchase. Please remove it from your cart.`);
            }

            const currentProduct = await Product.findByPk(product.id, { transaction: t, lock: Transaction.LOCK.UPDATE });
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

        const originState = getLocalSetting('tax.originState', '');
        const destinationState = shippingAddressSnapshot.state || '';

        let totalTax = 0;
        const itemTaxBreakdowns = [];
        for (const item of checkoutItems) {
            const effectiveTax = TaxService.getEffectiveTax(item.currentProduct, settingsMap);
            const itemSubtotal = item.currentPrice * item.quantity;
            const itemTaxBreakdown = TaxService.computeItemTax(
                effectiveTax, 
                itemSubtotal, 
                destinationState, 
                originState
            );
            
            if (!itemTaxBreakdown || typeof itemTaxBreakdown.totalTax !== 'number' || !Number.isFinite(itemTaxBreakdown.totalTax)) {
                throw new AppError('VALIDATION_ERROR', 500, `Tax calculation failed for "${item.currentProduct.name}"`);
            }
            
            item.taxBreakdown = itemTaxBreakdown;
            itemTaxBreakdowns.push({
                productId: item.productId,
                variantId: item.variantId || null,
                subtotal: Number(itemSubtotal.toFixed(2)),
                ...itemTaxBreakdown,
            });
            totalTax += itemTaxBreakdown.totalTax;
        }
        totalTax = Number(totalTax.toFixed(2));
        const orderTaxBreakdown = TaxService.summarizeTaxBreakdown(itemTaxBreakdowns, {
            originState,
            destinationState,
        });

        const shippingQuote = await ShippingService.validateQuoteForOrder(userId, {
            ...payload,
            shippingAddressId,
            paymentMethod,
            couponCode,
            couponCodes,
            buyNowItem,
        });
        let shippingCost = Number(shippingQuote.shippingCost || 0);
        const shippingTaxAmount = Number(shippingQuote.taxAmount || 0);

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
                transaction: t,
            });
        } else {
            couponBenefits = await CouponService.resolveCoupons([], userId, {
                cartSubtotal: subtotal,
                cartItems: checkoutItems,
                shippingCost,
                transaction: t,
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

        const total = Number(Math.max(0, subtotal + totalTax + shippingCost - discountAmount).toFixed(2));

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

        const crypto = require('crypto');
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
        const randStr = crypto.randomBytes(3).toString('hex').toUpperCase();
        const orderNumber = `ORD-${dateStr}-${randStr}`;

        // Determine initial order status based on payment method
        const initialStatus = paymentMethod === 'cod' ? 'pending_cod' : ORDER_DEFAULT_STATUS;

        const order = await Order.create({
            orderNumber,
            userId,
            status: initialStatus,
            paymentMethod,
            subtotal,
            tax: totalTax,
            taxBreakdown: orderTaxBreakdown,
            shippingCost,
            shippingQuoteId: shippingQuote.quoteId || null,
            shippingSnapshot: {
                quoteId: shippingQuote.quoteId || null,
                provider: shippingQuote.providerCode || shippingQuote.provider || 'manual',
                providerName: shippingQuote.providerName || 'Manual Shipping',
                shippingCost,
                currency: shippingQuote.currency || 'INR',
                taxIncluded: shippingQuote.taxIncluded === true,
                taxAmount: shippingTaxAmount,
                taxBreakdown: shippingQuote.taxBreakdown || null,
                codAvailable: shippingQuote.codAvailable === true,
                estimatedDeliveryDays: shippingQuote.estimatedDeliveryDays || null,
                serviceable: shippingQuote.serviceable === true,
            },
            shipmentStatus: 'pending',
            checkoutSessionId: shippingQuote.checkoutSessionId || payload.checkoutSessionId || null,
            shippingCurrency: shippingQuote.currency || 'INR',
            shippingTaxIncluded: shippingQuote.taxIncluded === true,
            shippingTaxAmount,
            shippingTaxBreakdown: shippingQuote.taxBreakdown || null,
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

        // For COD orders, create the Payment record immediately inside the transaction.
        // This mirrors how Razorpay creates a pending Payment; it is updated to 'completed'
        // by the admin "Mark COD as Collected" endpoint later.
        if (paymentMethod === 'cod') {
            const currencySetting = await Setting.findOne({ where: { group: 'general', key: 'currency' }, transaction: t });
            const currency = (currencySetting?.value || 'INR').toUpperCase();
            await Payment.create({
                orderId: order.id,
                provider: 'cod',
                transactionId: null,
                amount: total,
                currency,
                status: 'pending',
            }, { transaction: t });
        }

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
                total: item.currentPrice * item.quantity,
                taxBreakdown: item.taxBreakdown || null
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

    // For COD orders skip the payment gateway entirely — order is already confirmed.
    // For Razorpay orders, createIntent runs OUTSIDE the transaction so a gateway failure
    // doesn't roll back the order — the order exists, payment can be retried.
    let clientSecret = null;
    if (paymentMethod !== 'cod') {
        try {
            const intent = await PaymentService.createIntent(order.userId, order.id);
            clientSecret = intent.clientSecret;
        } catch (err) {
            // Log but don't fail — the order is saved; frontend can retry payment
            clientSecret = null;
        }
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
                    paymentMethod,
                },
            });
        }
    } catch (err) {}

    // Send multi-channel notification for order placement
    try {
        if (NotificationService && NotificationService.sendToUser) {
            const user = await User.findByPk(userId);
            if (user) {
                // Send to all enabled channels configured in settings
                // Dispatcher will handle checking if channels are actually enabled
                await NotificationService.sendToUser(
                    'order_placed',
                    ['email', 'sms', 'whatsapp'],
                    user,
                    {
                        orderNumber: order.orderNumber,
                        total: order.total,
                        firstName: user.firstName || 'Customer',
                    },
                    order.id
                );
            }
        }
    } catch (err) {
        logger.error('Failed to send order placement notifications', { orderId: order.id, error: err.message });
    }

    return { order, clientSecret };
};

const getOrders = async (userId, isAdmin, page = 1, limit = 20, filters = {}) => {
    const { limit: lmt, offset } = getPagination(page, limit);
    const where = isAdmin ? {} : { userId };

    const normalizedStatus = typeof filters.status === 'string' ? filters.status.trim() : '';
    const normalizedSearch = typeof filters.search === 'string' ? filters.search.trim() : '';

    // if (normalizedStatus) {
    //     where.status = normalizedStatus;
    // }

    if (normalizedStatus) {
        const statuses = normalizedStatus.split(',').map(s => s.trim()).filter(Boolean);
        where.status = statuses.length === 1 ? statuses[0] : { [Op.in]: statuses };
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

    } 

    // Always include OrderItem → Product for the user's order list
    include.push({
        model: OrderItem,
        as: 'items',
        required: false,
        include: [
            {
                model: Product,
                as: 'product',          // adjust if your association alias differs
                attributes: ['id', 'name'],
                required: false,
            },
        ],
    });

    if (normalizedSearch) {
        const searchPattern = `%${normalizedSearch}%`;
        const searchClauses = [
            { orderNumber: { [Op.iLike]: searchPattern } },
            { status: { [Op.iLike]: searchPattern } },
            { '$items.product.name$': { [Op.iLike]: searchPattern } },
        ];
        if (isAdmin) {
            searchClauses.push(
                { '$User.first_name$': { [Op.iLike]: searchPattern } },
                { '$User.last_name$': { [Op.iLike]: searchPattern } },
                { '$User.email$': { [Op.iLike]: searchPattern } }
            );
        }
        where[Op.or] = searchClauses;
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
        include: HEAVY_ORDER_INCLUDE,
    });

    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
    return order;
};

const createFulfillment = async (orderId, payload, actingUserId) => {
    // payload: { trackingNumber, courier, notes, status, items: [{ orderItemId, quantity }], providerId }
    const { trackingNumber, courier, notes, status, items, providerId } = payload;

    if (!items || items.length === 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'At least one item is required for a shipment');
    }

    return sequelize.transaction(async (t) => {
        // Lock the order row to prevent concurrent fulfillment races
        // We split this from item fetching because FOR UPDATE cannot be applied to outer joins in some DBs (e.g. Postgres)
        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });

        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

        // Fetch items associated with the locked order
        const orderItems = await OrderItem.findAll({
            where: { orderId: order.id },
            include: [{ model: FulfillmentItem, as: 'fulfillmentItems', required: false }],
            transaction: t,
        });
        
        // Manually attach items to the order object for compatibility with downstream logic
        order.items = orderItems;

        // Hard block: check if order is in a fulfillable state
        if (!isFulfillableOrderStatus(order.status)) {
            throw new AppError(
                'VALIDATION_ERROR',
                400,
                `Cannot create a shipment for a ${order.status} order`
            );
        }

        // Build map: orderItemId → { totalQty, alreadyShipped, remaining, productId, snapshotName }
        const orderItemMap = {};
        for (const oi of order.items) {
            const alreadyShipped = (oi.fulfillmentItems || []).reduce(
                (sum, fi) => sum + fi.quantity, 0
            );
            orderItemMap[oi.id] = {
                totalQty:      oi.quantity,
                alreadyShipped,
                remaining:     oi.quantity - alreadyShipped,
                productId:     oi.productId,
                snapshotName:  oi.snapshotName,
                snapshotSku:   oi.snapshotSku,
                snapshotPrice: oi.snapshotPrice,
            };
        }

        // Validate every item in the request — Number() coercion on all quantities
        for (const item of items) {
            const qty = Number(item.quantity);
            const info = orderItemMap[item.orderItemId];

            if (!info) {
                throw new AppError(
                    'VALIDATION_ERROR',
                    400,
                    `Order item ${item.orderItemId} does not belong to this order`
                );
            }
            if (Number.isNaN(qty)) {
                throw new AppError('VALIDATION_ERROR', 400, 'Shipment item quantity must be a valid number greater than 0');
            }
            if (qty <= 0) {
                throw new AppError('VALIDATION_ERROR', 400, 'Shipment item quantity must be greater than 0');
            }
            if (qty > info.remaining) {
                throw new AppError(
                    'CONFLICT',
                    409,
                    `Cannot ship ${qty} of "${info.snapshotName}": only ${info.remaining} remaining`
                );
            }
            // Track consumption within this request to catch duplicate orderItemId entries
            info.remaining      -= qty;
            info.alreadyShipped += qty;
        }

        // Group total deduction by productId
        const productDeductions = new Map(); // productId → total qty to deduct
        for (const item of items) {
            const qty  = Number(item.quantity);
            const info = orderItemMap[item.orderItemId];
            if (!info?.productId) continue; // skip soft-deleted products
            productDeductions.set(
                info.productId,
                (productDeductions.get(info.productId) || 0) + qty
            );
        }

        // Row-lock each product then perform strict atomic stock deduction
        for (const [productId, qty] of productDeductions) {
            // Acquire row-level lock — prevents concurrent deductions on the same product
            const product = await Product.findByPk(productId, {
                transaction: t,
                lock:        Transaction.LOCK.UPDATE,
            });

            if (!product) {
                throw new AppError('NOT_FOUND', 404, `Product ${productId} not found during stock deduction`);
            }

            // Strict update — no GREATEST, no soft floor
            // WHERE guards ensure we never go negative on quantity or reserved_qty
            const [affectedRows] = await Product.update(
                {
                    quantity:    sequelize.literal(`quantity - ${qty}`),
                    reservedQty: sequelize.literal(`reserved_qty - ${qty}`),
                },
                {
                    where: {
                        id:          productId,
                        quantity:    { [Op.gte]: qty },   // actual stock must cover this shipment
                        reservedQty: { [Op.gte]: qty },   // reserved must match (no phantom reserves)
                    },
                    transaction: t,
                }
            );

            // 0 affected rows means stock or reserved_qty is insufficient — hard fail, full rollback
            if (affectedRows === 0) {
                throw new AppError(
                    'CONFLICT',
                    409,
                    `Stock deduction failed for "${product.name}": ` +
                    `available quantity or reserved stock is insufficient. Shipment aborted.`
                );
            }
        }

        // Determine Provider
        let provider = null;
        let adapter = null;
        if (providerId) {
            provider = await ShippingProvider.findByPk(providerId, { transaction: t });
        }
        if (!provider) {
            provider = await ShippingProvider.findOne({ where: { code: 'manual' }, transaction: t });
        }
        if (provider) {
            adapter = resolveProvider(provider);
        }

        let providerShipmentId = null;
        let awbCode = trackingNumber || null;
        let trackingUrl = null;
        let labelUrl = null;
        let finalStatus = status || 'pending';
        let courierName = courier || (provider ? provider.name : 'Manual Shipping');
        let rawResponse = null;

        // Create the fulfillment record
        ensureValidFulfillmentTransition('pending', finalStatus);
        const fulfillment = await Fulfillment.create({
            orderId,
            trackingNumber: awbCode,
            courier:        courierName,
            notes:          notes || null,
            status:         finalStatus,
        }, { transaction: t });

        // Hit Provider API if not manual
        if (adapter && provider.code !== 'manual') {
            const user = await User.findByPk(order.userId, { transaction: t });
            order.user = user;

            const address = order.shippingAddressSnapshot || {};
            
            // Calculate total weight and dimensions of the fulfillment items
            const productIds = items.map(reqItem => orderItemMap[reqItem.orderItemId]?.productId).filter(Boolean);
            const products = await Product.findAll({
                where: { id: productIds },
                attributes: ['id', 'weightGrams', 'lengthCm', 'breadthCm', 'heightCm', 'requiresShipping'],
                transaction: t
            });
            const productMap = products.reduce((map, p) => {
                map[p.id] = p;
                return map;
            }, {});

            const fulfillmentItemsForDims = items.map(reqItem => ({
                product: productMap[orderItemMap[reqItem.orderItemId]?.productId],
                quantity: reqItem.quantity
            })).filter(i => i.product);

            const dims = ShippingService.computePackageDimensions(fulfillmentItemsForDims);
            const totalWeightGrams = dims.totalWeightGrams;

            // 1. Mandatory Pre-Shipment Serviceability Revalidation
            if (typeof adapter.getServiceability === 'function') {
                const serviceability = await adapter.getServiceability({
                    pincode: address.pincode,
                    pickupPincode: provider.settings?.pickupPincode || null,
                    weightGrams: totalWeightGrams,
                    paymentMode: order.paymentMethod === 'cod' ? 'cod' : 'prepaid'
                });

                if (!serviceability.serviceable || (order.paymentMethod === 'cod' && !serviceability.codAvailable)) {
                    throw new AppError('SHIPPING_UNAVAILABLE', 400, `Shipping provider ${provider.name} cannot fulfill this order at this time. Reason: ${serviceability.reason || 'Unserviceable location'}`);
                }
            }

            const providerItems = items.map(reqItem => {
                const info = orderItemMap[reqItem.orderItemId];
                return {
                    quantity: Number(reqItem.quantity),
                    snapshotName: info.snapshotName,
                    sku: info.snapshotSku || 'SKU',
                    unitPrice: info.snapshotPrice || 0
                };
            });

            try {
                const providerResult = await adapter.createShipment({
                    order,
                    shipment: { 
                        actualWeightGrams: totalWeightGrams,
                        lengthCm: dims.maxL,
                        breadthCm: dims.maxB,
                        heightCm: dims.totalH,
                        volumetricWeightGrams: Math.ceil((dims.volumeCm3 / 5000) * 1000)
                    },
                    address: order.shippingAddressSnapshot || {},
                    items: providerItems
                });

                awbCode = providerResult.awbCode || awbCode;
                providerShipmentId = providerResult.providerOrderId || null;
                trackingUrl = providerResult.trackingUrl || null;
                labelUrl = providerResult.label || null;
                rawResponse = providerResult.rawResponse || null;

                await fulfillment.update({ trackingNumber: awbCode, courier: provider.name }, { transaction: t });
                courierName = provider.name;
            } catch (err) {
                // If API fails, rollback by throwing
                throw new AppError('SHIPPING_API_ERROR', 500, `Shipping provider error: ${err.message}`);
            }
        }

        const shipment = await Shipment.create({
            orderId,
            fulfillmentId: fulfillment.id,
            providerId: provider?.id || null,
            providerOrderId: providerShipmentId,
            awb: awbCode,
            courierName: courierName,
            trackingNumber: awbCode,
            trackingUrl: trackingUrl,
            labelUrl: labelUrl,
            status: finalStatus,
            statusHistory: [{
                status: finalStatus,
                at: new Date().toISOString(),
                source: 'admin',
            }],
            actualWeightGrams: totalWeightGrams,
            volumetricWeightGrams: Math.ceil((dims.volumeCm3 / 5000) * 1000),
            lengthCm: dims.maxL,
            breadthCm: dims.maxB,
            heightCm: dims.totalH,
            rawResponse: rawResponse,
        }, { transaction: t });

        // Create all fulfillment items
        for (const item of items) {
            const qty = Number(item.quantity);
            await FulfillmentItem.create({
                fulfillmentId: fulfillment.id,
                orderItemId:   item.orderItemId,
                quantity:      qty,
            }, { transaction: t });
            await ShipmentItem.create({
                shipmentId: shipment.id,
                orderItemId: item.orderItemId,
                quantity: qty,
            }, { transaction: t });
        }

        // Recalculate overall order fulfillment status
        const totalOrderQty   = order.items.reduce((sum, oi) => sum + oi.quantity, 0);
        const totalShippedQty = Object.values(orderItemMap).reduce((sum, m) => sum + m.alreadyShipped, 0);

        const newStatus = totalShippedQty >= totalOrderQty ? 'shipped' : 'partially_shipped';

        // Only transition forward — never regress a delivered/cancelled/refunded order
        if (!['delivered', 'cancelled', 'refunded'].includes(order.status)) {
            await order.update({ status: newStatus, shipmentStatus: newStatus }, { transaction: t });
        }

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId:   actingUserId,
                    action:   ACTIONS.CREATE,
                    entity:   'Fulfillment',
                    entityId: fulfillment.id,
                    changes:  {
                        orderId,
                        trackingNumber,
                        shipmentId: shipment.id,
                        fulfillmentStatus: status || 'pending',
                        newOrderStatus:    newStatus,
                    },
                }, t);
            }
        } catch (err) {}

        fulfillment.setDataValue('shipments', [shipment]);
        return fulfillment;
    });
};


const updateStatus = async (id, status, actingUserId) => {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(id, {
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

        const before = order.toJSON();
        if (status === 'refunded') {
            throw new AppError('VALIDATION_ERROR', 400, 'Use the refund action so payment state and audit metadata stay consistent');
        }
        ensureValidStatusTransition(order.status, status);
        if (status === 'cancelled') {
            await releaseOrderReservationsAndCoupons(order, t);
        }
        await order.update({ status }, { transaction: t });
        
        // Sync payment status if order is marked as paid
        if (status === 'paid') {
            const payment = await Payment.findOne({ 
                where: { orderId: id }, 
                transaction: t,
                lock: t.LOCK.UPDATE 
            });
            if (payment && payment.status === 'pending') {
                const nextPaymentStatus = payment.provider === 'cod' ? 'cod_collected' : 'completed';
                await payment.update({ 
                    status: nextPaymentStatus,
                    metadata: {
                        ...(payment.metadata || {}),
                        manuallyMarkedPaidBy: actingUserId,
                        manuallyMarkedPaidAt: new Date().toISOString()
                    }
                }, { transaction: t });
            }
        } else if (status === 'cancelled') {
            const payment = await Payment.findOne({ 
                where: { orderId: id }, 
                transaction: t,
                lock: t.LOCK.UPDATE 
            });
            if (payment && payment.status === 'pending') {
                await payment.update({ 
                    status: 'failed',
                    metadata: {
                        ...(payment.metadata || {}),
                        cancelledAt: new Date().toISOString()
                    }
                }, { transaction: t });
            }
        }

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
        
        return Order.findByPk(id, {
            include: HEAVY_ORDER_INCLUDE,
            transaction: t,
        });
    });
};

const refundOrder = async (id, actingUserId, isAdmin) => {
    if (!isAdmin) {
        throw new AppError('FORBIDDEN', 403, 'You do not have permission to refund orders');
    }
    const refundedOrderId = await sequelize.transaction(async (t) => {
        const order = await Order.findByPk(id, {
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });

        if (!order) {
            throw new AppError('NOT_FOUND', 404, 'Order not found');
        }

        if (!isRefundableOrderStatus(order.status)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Only paid, processing, shipped, or delivered orders can be refunded');
        }

        const payment = await Payment.findOne({
            where: { orderId: order.id },
            attributes: [...ADMIN_ORDER_PAYMENT_ATTRIBUTES, 'metadata'],
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });

        if (!payment || !['completed', 'cod_collected'].includes(payment.status)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Cannot refund an order before payment has been captured or COD has been collected');
        }

        const previousStatus = order.status;
        ensureValidStatusTransition(previousStatus, 'refunded');
        await order.update({ status: 'refunded' }, { transaction: t });

        if (payment && payment.status !== 'refunded') {
            const currentMetadata = payment.metadata && typeof payment.metadata === 'object'
                ? payment.metadata
                : {};

            await payment.update({
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

        return order.id;
    });

    return getOrderById(refundedOrderId, actingUserId, true);
};

const cancelOrder = async (id, userId) => {
    return sequelize.transaction(async (t) => {
        const order = await Order.findOne({ where: { id, userId }, include: [{ model: OrderItem, as: 'items' }], transaction: t });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

        const previousStatus = order.status;

        if (!isCustomerCancelableOrderStatus(order.status)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Only pending or processing orders can be cancelled');
        }

        ensureValidStatusTransition(previousStatus, 'cancelled');
        await releaseOrderReservationsAndCoupons(order, t);
        await order.update({ status: 'cancelled' }, { transaction: t });

        // Sync payment status
        const payment = await Payment.findOne({
            where: { orderId: order.id },
            transaction: t,
            lock: t.LOCK.UPDATE
        });
        if (payment && payment.status === 'pending') {
            await payment.update({
                status: 'failed',
                metadata: {
                    ...(payment.metadata || {}),
                    cancelledBy: 'customer',
                    cancelledAt: new Date().toISOString()
                }
            }, { transaction: t });
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

        return Order.findByPk(id, {
            include: HEAVY_ORDER_INCLUDE,
            transaction: t,
        });
    });
};

const updateFulfillmentStatus = async (orderId, fulfillmentId, status, actingUserId) => {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });

        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

        // Fetch associations separately to avoid JOIN + FOR UPDATE issues
        const items = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
        const fulfillments = await Fulfillment.findAll({ where: { orderId: order.id }, transaction: t });
        
        order.items = items;
        order.fulfillments = fulfillments;

        const fulfillment = await Fulfillment.findOne({
            where: { id: fulfillmentId, orderId },
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });

        if (!fulfillment) throw new AppError('NOT_FOUND', 404, 'Shipment not found');

        const oldStatus = fulfillment.status;
        ensureValidFulfillmentTransition(oldStatus, status);
        await fulfillment.update({ status }, { transaction: t });
        const linkedShipments = await Shipment.findAll({
            where: { fulfillmentId: fulfillment.id },
            transaction: t,
        });
        for (const shipment of linkedShipments) {
            const history = Array.isArray(shipment.statusHistory) ? shipment.statusHistory : [];
            await shipment.update({
                status,
                statusHistory: [
                    ...history,
                    { status, at: new Date().toISOString(), source: 'admin' },
                ],
            }, { transaction: t });
        }

        // Logic: if all items are fully fulfilled AND all fulfillments are "delivered", update the main order
        let shouldDeliverOrder = false;
        if (status === 'delivered') {
            const allOtherFulfillmentsDelivered = order.fulfillments
                .filter(f => f.id !== fulfillmentId)
                .every(f => f.status === 'delivered');

            if (allOtherFulfillmentsDelivered) {
                // Check if the order is fully fulfilled (no remaining items to ship)
                const itemsWithFulfillment = await OrderItem.findAll({
                    where: { orderId },
                    include: [{ model: FulfillmentItem, as: 'fulfillmentItems' }],
                    transaction: t,
                });

                const isFullyFulfilled = itemsWithFulfillment.every(item => {
                    const shipped = (item.fulfillmentItems || []).reduce((sum, fi) => sum + fi.quantity, 0);
                    return shipped >= item.quantity;
                });

                if (isFullyFulfilled) {
                    shouldDeliverOrder = true;
                }
            }
        }

        if (shouldDeliverOrder && order.status !== 'delivered') {
            await order.update({ status: 'delivered', shipmentStatus: 'delivered' }, { transaction: t });
        }

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: 'STATUS_CHANGE',
                    entity: 'Fulfillment',
                    entityId: fulfillment.id,
                    changes: { before: oldStatus, after: status, orderStatusUpdated: shouldDeliverOrder },
                }, t);
            }
        } catch (err) {}

        return getOrderById(orderId, actingUserId, true);
    });
};

const getFulfillmentTracking = async (orderId, userId, isAdmin) => {
    const order = await getOrderById(orderId, userId, isAdmin);
    const plainOrder = typeof order.toJSON === 'function' ? order.toJSON() : order;
    const progress = calculateFulfillmentProgress(plainOrder);
    const fulfillments = (plainOrder.fulfillments || []).map((fulfillment, index) => ({
        id: fulfillment.id,
        shipmentNumber: index + 1,
        status: fulfillment.status,
        courier: fulfillment.courier,
        trackingNumber: fulfillment.trackingNumber,
        trackingUrl: fulfillment.shipments && fulfillment.shipments.length > 0 ? fulfillment.shipments[0].trackingUrl : null,
        notes: fulfillment.notes,
        createdAt: fulfillment.createdAt,
        updatedAt: fulfillment.updatedAt,
        items: fulfillment.items || [],
        shipments: fulfillment.shipments || [],
    }));

    return {
        orderId: plainOrder.id,
        orderNumber: plainOrder.orderNumber,
        orderStatus: plainOrder.status,
        progress,
        fulfillments,
        timeline: buildOrderTimeline(plainOrder, progress),
    };
};

module.exports = {
    placeOrder,
    getOrders,
    getOrderById,
    getFulfillmentTracking,
    updateStatus,
    cancelOrder,
    refundOrder,
    createFulfillment,
    updateFulfillmentStatus,
    getAllowedNextStatuses,
};
