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
    OrderReturn,
    OrderReturnItem,
    OrderRefund,
    OrderStatusHistory,
    OrderHistory,
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
const SettingsService = require('../settings/settings.service');
const { resolveProvider } = require('../shipping/providers');
const { events, PRODUCT_EVENTS, ORDER_EVENTS } = require('../../utils/events');

const defaultSettings = require('../../../../config/default.json');

const NotificationService = require('../notification/notification.service');

const { getPagination } = require('../../utils/pagination');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const { getVariantUnitPrice } = require('../product/product.pricing');
const {
    ORDER_DEFAULT_STATUS,
    SHIPMENT_DEFAULT_STATUS,
    RETURN_DEFAULT_STATUS,
    REPLACEMENT_DEFAULT_STATUS,
    REFUND_DEFAULT_STATUS,
    getAllowedNextStatuses,
    isCustomerCancelableOrderStatus,
    isRefundableOrderStatus,
    isFulfillableOrderStatus,
    normalizeOrderStatus,
    normalizePaymentStatus,
    ensureValidStatusTransition,
    deriveOrderShippingStatus,
    derivePutBackCache,
    isPaymentSettled,
    canCloseOrder,
} = require('../../utils/orderWorkflow');

const ADMIN_ORDER_LIST_USER_ATTRIBUTES = ['id', 'firstName', 'lastName', 'email'];
const ADMIN_ORDER_PAYMENT_ATTRIBUTES = ['id', 'provider', 'status', 'amount', 'currency', 'transactionId', 'createdAt', 'updatedAt'];

const logOrderHistory = async ({
    orderId,
    entityType,
    entityId = null,
    statusGroup,
    fromStatus = null,
    toStatus,
    changedBy = null,
    metadata = {},
    transaction,
}) => OrderStatusHistory.create({
    orderId,
    entityType,
    entityId,
    statusGroup,
    fromStatus,
    toStatus,
    changedBy,
    metadata,
}, { transaction });

const addOrderHistoryEvent = async ({
    orderId,
    eventType,
    description,
    actorId = null,
    actorType = 'system',
    metadata = {},
    transaction,
}) => OrderHistory.create({
    orderId,
    eventType,
    description,
    actorId,
    actorType,
    metadata,
}, { transaction });

const ensureValidOrderTransition = (currentStatus, nextStatus) => (
    ensureValidStatusTransition('order', normalizeOrderStatus(currentStatus), nextStatus)
);

const ensureValidShipmentTransition = (currentStatus, nextStatus) => (
    ensureValidStatusTransition('shipment', currentStatus, nextStatus)
);

const ensureValidPaymentTransition = (currentStatus, nextStatus) => (
    ensureValidStatusTransition('payment', currentStatus, nextStatus)
);

const appendStatusHistoryEvent = (history = [], status, source = 'admin') => {
    const entries = Array.isArray(history) ? history : [];
    const lastEntry = entries[entries.length - 1];
    if (lastEntry?.status === status) return entries;
    return [
        ...entries,
        { status, at: new Date().toISOString(), source },
    ];
};

const syncOrderShippingStatus = async (order, transaction, actingUserId = null) => {
    const shipments = await Shipment.findAll({
        where: { orderId: order.id },
        attributes: ['id', 'status'],
        transaction,
    });
    const nextStatus = deriveOrderShippingStatus(shipments);
    if (order.orderShippingStatus !== nextStatus || order.shipmentStatus !== nextStatus) {
        const previous = order.orderShippingStatus;
        await order.update({ orderShippingStatus: nextStatus, shipmentStatus: nextStatus }, { transaction });
        await logOrderHistory({
            orderId: order.id,
            entityType: 'Order',
            entityId: order.id,
            statusGroup: 'order_shipping',
            fromStatus: previous,
            toStatus: nextStatus,
            changedBy: actingUserId,
            metadata: { derived: true },
            transaction,
        });
    }
    return nextStatus;
};

const syncCodPaymentIfDelivered = async (order, transaction, actingUserId = null) => {
    if (order.paymentMethod !== 'cod') return;
    const payment = await Payment.findOne({ where: { orderId: order.id }, transaction, lock: Transaction.LOCK.UPDATE });
    if (!payment || normalizePaymentStatus(payment.status, payment.provider) !== 'pending_cod') return;
    const shippingStatus = order.orderShippingStatus || await syncOrderShippingStatus(order, transaction, actingUserId);
    if (shippingStatus !== 'delivered') return;
    const existingEligibilityEvent = await OrderHistory.findOne({
        where: {
            orderId: order.id,
            eventType: 'payment',
            description: 'COD payment is eligible to be collected because delivery is complete.',
        },
        transaction,
    });
    if (existingEligibilityEvent) return;
    await addOrderHistoryEvent({
        orderId: order.id,
        eventType: 'payment',
        description: 'COD payment is eligible to be collected because delivery is complete.',
        actorId: actingUserId,
        actorType: actingUserId ? 'admin' : 'system',
        metadata: { rule: 'cod_payment_completion', paymentStatus: payment.status },
        transaction,
    });
};

const syncOrderClosureIfComplete = async (order, transaction, actingUserId = null) => {
    if (!order || ['closed', 'cancelled'].includes(order.status)) return false;

    const payment = await Payment.findOne({
        where: { orderId: order.id },
        transaction,
        lock: Transaction.LOCK.UPDATE,
    });
    const orderShippingStatus = order.orderShippingStatus || await syncOrderShippingStatus(order, transaction, actingUserId);

    if (!canCloseOrder({ order, payment, orderShippingStatus })) return false;
    if (!getAllowedNextStatuses('order', normalizeOrderStatus(order.status)).includes('closed')) return false;

    const previousStatus = order.status;
    await order.update({ status: 'closed' }, { transaction });
    await logOrderHistory({
        orderId: order.id,
        entityType: 'Order',
        entityId: order.id,
        statusGroup: 'order',
        fromStatus: previousStatus,
        toStatus: 'closed',
        changedBy: actingUserId,
        metadata: { derived: true, reason: 'payment_settled_and_shipping_terminal' },
        transaction,
    });
    await addOrderHistoryEvent({
        orderId: order.id,
        eventType: 'status_changed',
        description: 'Order was closed automatically after payment settlement and delivery completion.',
        actorId: actingUserId,
        actorType: actingUserId ? 'admin' : 'system',
        metadata: { previousStatus, orderShippingStatus, paymentStatus: payment?.status || null },
        transaction,
    });
    return true;
};

const syncPutBackCache = async (order, transaction, actingUserId = null) => {
    const [orderItems, putBacks] = await Promise.all([
        OrderItem.findAll({ where: { orderId: order.id }, transaction }),
        OrderReturn.findAll({
            where: { orderId: order.id },
            include: [{ model: OrderReturnItem, as: 'items' }],
            transaction,
        }),
    ]);
    const cache = derivePutBackCache({ orderItems, putBacks });
    if (
        order.putBackStatus !== cache.putBackStatus ||
        Boolean(order.putBackProcessingStatus) !== cache.putBackProcessingStatus
    ) {
        await order.update(cache, { transaction });
        await logOrderHistory({
            orderId: order.id,
            entityType: 'Order',
            entityId: order.id,
            statusGroup: 'put_back',
            fromStatus: order.putBackStatus,
            toStatus: cache.putBackStatus || 'none',
            changedBy: actingUserId,
            metadata: { derived: true, processing: cache.putBackProcessingStatus },
            transaction,
        });
    }
    return cache;
};

const repairInvalidClosedOrder = async (order, transaction = null) => {
    if (!order || order.status !== 'closed') return order;

    const payment = order.Payment || await Payment.findOne({
        where: { orderId: order.id },
        transaction,
    });
    const shipments = order.shipments || await Shipment.findAll({
        where: { orderId: order.id },
        attributes: ['id', 'status'],
        transaction,
    });
    const derivedShippingStatus = deriveOrderShippingStatus(shipments);

    if (canCloseOrder({ order, payment, orderShippingStatus: derivedShippingStatus })) {
        if (order.orderShippingStatus !== derivedShippingStatus) {
            await order.update({ orderShippingStatus: derivedShippingStatus, shipmentStatus: derivedShippingStatus }, { transaction });
        }
        return order;
    }

    const nextStatus = shipments.length > 0 ? 'ready_for_shipment' : 'processing';
    await order.update({
        status: nextStatus,
        orderShippingStatus: derivedShippingStatus,
        shipmentStatus: derivedShippingStatus,
    }, { transaction });
    await logOrderHistory({
        orderId: order.id,
        entityType: 'Order',
        entityId: order.id,
        statusGroup: 'order',
        fromStatus: 'closed',
        toStatus: nextStatus,
        metadata: {
            repair: true,
            reason: 'closed_without_settled_payment_or_terminal_shipping',
            paymentStatus: payment?.status || null,
            orderShippingStatus: derivedShippingStatus,
        },
        transaction,
    });
    return order;
};

const repairCompletableOrder = async (order, transaction = null) => {
    if (!order || ['closed', 'cancelled'].includes(order.status)) return order;
    const shipments = order.shipments || await Shipment.findAll({
        where: { orderId: order.id },
        attributes: ['id', 'status'],
        transaction,
    });
    const derivedShippingStatus = deriveOrderShippingStatus(shipments);
    if (order.orderShippingStatus !== derivedShippingStatus || order.shipmentStatus !== derivedShippingStatus) {
        await order.update({ orderShippingStatus: derivedShippingStatus, shipmentStatus: derivedShippingStatus }, { transaction });
    }
    await syncOrderClosureIfComplete(order, transaction);
    return order;
};

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
            { model: ShipmentItem, as: 'shipmentItems', attributes: ['quantity'], required: false },
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
    {
        model: Shipment,
        as: 'shipments',
        include: [
            {
                model: ShipmentItem,
                as: 'items',
                include: [
                    { model: OrderItem, as: 'orderItem', attributes: ['id', 'snapshotName', 'snapshotSku', 'snapshotImage', 'variantInfo'] },
                ],
            },
            { model: ShippingProvider, as: 'provider', attributes: ['id', 'code', 'name', 'type'], required: false },
        ],
    },
    {
        model: OrderReturn,
        as: 'returns',
        required: false,
        include: [
            {
                model: OrderReturnItem,
                as: 'items',
                include: [
                    { model: OrderItem, as: 'orderItem', attributes: ['id', 'snapshotName', 'snapshotSku', 'snapshotImage', 'variantInfo'] },
                    { model: ShipmentItem, as: 'shipmentItem', required: false },
                ],
            },
        ],
    },
    { model: OrderRefund, as: 'refunds', required: false },
    { model: OrderStatusHistory, as: 'statusHistory', required: false },
    { model: OrderHistory, as: 'history', required: false },
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

const sumQuantityByOrderItem = (rows = []) => rows.reduce((map, row) => {
    const orderItemId = row.orderItemId || row.order_item_id;
    if (!orderItemId) return map;
    map[orderItemId] = (map[orderItemId] || 0) + Number(row.quantity || 0);
    return map;
}, {});

const calculateFulfillmentProgress = (order) => {
    const items = order?.items || [];
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const dispatchedQuantity = items.reduce((sum, item) => (
        sum + getDispatchedQuantityForOrderItem(item)
    ), 0);
    const deliveredShipmentItems = (order?.shipments || [])
        .filter((shipment) => shipment.status === 'delivered')
        .flatMap((shipment) => shipment.items || []);
    const deliveredFulfillmentItems = (order?.fulfillments || [])
        .filter((fulfillment) => fulfillment.status === 'delivered')
        .flatMap((fulfillment) => fulfillment.items || []);
    const deliveredShipmentMap = sumQuantityByOrderItem(deliveredShipmentItems);
    const deliveredFulfillmentMap = sumQuantityByOrderItem(deliveredFulfillmentItems);
    const fulfilledQuantity = items.reduce((sum, item) => (
        sum + Math.max(deliveredShipmentMap[item.id] || 0, deliveredFulfillmentMap[item.id] || 0)
    ), 0);

    return {
        totalQuantity,
        dispatchedQuantity,
        fulfilledQuantity,
        remainingQuantity: Math.max(totalQuantity - fulfilledQuantity, 0),
        percent: totalQuantity > 0 ? Math.round((fulfilledQuantity / totalQuantity) * 100) : 0,
    };
};

const getDispatchedQuantityForOrderItem = (orderItem) => {
    const shipmentQuantity = (orderItem.shipmentItems || [])
        .reduce((sum, shipmentItem) => sum + Number(shipmentItem.quantity || 0), 0);
    const fulfillmentQuantity = (orderItem.fulfillmentItems || [])
        .reduce((sum, fulfillmentItem) => sum + Number(fulfillmentItem.quantity || 0), 0);

    // New shipments create both fulfillment_items and shipment_items. Taking the
    // larger value keeps legacy fulfillment-only or shipment-only rows counted
    // without double-counting rows created by the current shipment flow.
    return Math.max(shipmentQuantity, fulfillmentQuantity);
};

const buildOrderTimeline = (order, progress) => {
    const payment = order.Payment?.toJSON?.() || order.Payment || null;
    const rawPaymentStatus = payment?.status;
    const paymentStatus = normalizePaymentStatus(rawPaymentStatus, payment?.provider || order.paymentMethod);
    const statusHistory = order.statusHistory || [];
    const findStatusTime = (statusGroup, statuses) => {
        const statusSet = Array.isArray(statuses) ? statuses : [statuses];
        return [...statusHistory]
            .reverse()
            .find((entry) => entry.statusGroup === statusGroup && statusSet.includes(entry.toStatus))
            ?.createdAt;
    };
    const isCod = order.paymentMethod === 'cod';
    const isPendingOnlinePayment = order.status === 'pending_payment' && !isCod;
    const isCancelled = order.status === 'cancelled';
    const isRefunded = order.status === 'refunded' || rawPaymentStatus === 'refunded';
    const paymentSettled = ['paid_online', 'paid_cod', 'completed', 'cod_collected', 'refunded'].includes(paymentStatus);
    const shippingStatus = order.orderShippingStatus || order.shipmentStatus || 'not_shipped';
    const shipped = ['partially_shipped', 'shipped', 'partially_out_for_delivery', 'out_for_delivery', 'partially_delivered', 'delivered'].includes(shippingStatus);
    const outForDelivery = ['partially_out_for_delivery', 'out_for_delivery', 'partially_delivered', 'delivered'].includes(shippingStatus);
    const delivered = shippingStatus === 'delivered';
    const partiallyDelivered = shippingStatus === 'partially_delivered';
    const processing = ['processing', 'ready_for_shipment', 'closed'].includes(order.status) || shipped || delivered;

    const steps = [
        {
            key: isPendingOnlinePayment ? 'pending_payment' : 'placed',
            label: isPendingOnlinePayment ? 'Awaiting payment' : 'Order placed',
            status: isPendingOnlinePayment ? 'active' : 'completed',
            occurredAt: order.createdAt,
        },
        ...(!isPendingOnlinePayment && !isCod ? [{
            key: 'pending_payment',
            label: paymentSettled ? 'Payment captured' : 'Pending payment',
            status: paymentSettled ? 'completed' : 'active',
            occurredAt: paymentSettled ? payment?.updatedAt : undefined,
        }] : []),
        {
            key: 'processing',
            label: 'Processing',
            status: processing ? 'completed' : 'pending',
            occurredAt: findStatusTime('order', ['processing', 'ready_for_shipment', 'closed']),
        },
        {
            key: 'shipped',
            label: shippingStatus === 'partially_shipped' ? 'Partially shipped' : 'Shipped',
            status: shipped ? 'completed' : 'pending',
            occurredAt: findStatusTime('order_shipping', ['partially_shipped', 'shipped', 'partially_out_for_delivery', 'out_for_delivery', 'partially_delivered', 'delivered']),
        },
        {
            key: 'out_for_delivery',
            label: 'Out for delivery',
            status: outForDelivery ? 'completed' : 'pending',
            occurredAt: findStatusTime('order_shipping', ['partially_out_for_delivery', 'out_for_delivery', 'partially_delivered', 'delivered']),
        },
        {
            key: 'delivered',
            label: partiallyDelivered ? 'Partially delivered' : 'Delivered',
            status: delivered ? 'completed' : partiallyDelivered ? 'active' : 'pending',
            occurredAt: findStatusTime('order_shipping', ['partially_delivered', 'delivered']),
        },
        ...(isCod ? [{
            key: 'cod_payment',
            label: paymentSettled ? 'COD collected' : delivered ? 'Collect COD payment' : 'Cash due on delivery',
            status: paymentSettled ? 'completed' : delivered ? 'active' : 'pending',
            occurredAt: paymentStatus === 'paid_cod' ? payment?.updatedAt : undefined,
        }] : []),
    ];

    if (isCancelled || isRefunded) {
        const terminalSteps = steps.filter((step) => {
            if (step.key === 'placed') return true;
            if (step.key === 'pending_payment') return !isCod;
            if (step.key === 'cod_payment') return paymentSettled;
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

    const eventBuffer = [];
    for (const item of orderItems) {
        if (item.variantId) {
            await ProductVariant.update(
                { reservedQty: sequelize.literal(`GREATEST(reserved_qty - ${item.quantity}, 0)`) },
                {
                    where: {
                        id: item.variantId,
                        reservedQty: { [Op.gt]: 0 },
                    },
                    transaction,
                }
            );
        } else if (item.productId) {
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
        
        eventBuffer.push({
            name: PRODUCT_EVENTS.STOCK_CHANGED,
            payload: {
                productId: item.productId,
                variantId: item.variantId || null,
                change: item.quantity,
                type: 'release'
            }
        });
    }
    return eventBuffer;

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

    const { features } = await SettingsService.getFeatures();
    
    if (!userId && !features.guestCheckout) {
        throw new AppError('FORBIDDEN', 403, 'Guest checkout is disabled. Please log in or register to place an order.');
    }

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

    const addressWhere = { id: shippingAddressId };
    if (userId) addressWhere.userId = userId;
    const address = await Address.findOne({ where: addressWhere });

    if (!address) {
        throw new AppError('NOT_FOUND', 404, 'Shipping address not found');
    }
    const shippingAddressSnapshot = address.toJSON();

    const settingsMap = await buildSettingsSnapshot(['tax', 'shipping']);
    const getLocalSetting = (key, defaultVal) => settingsMap[key] !== undefined ? settingsMap[key] : defaultVal;

    const { order, eventBuffer } = await sequelize.transaction(async (t) => {
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

        // Harden: Check if coupons feature is enabled before resolving
        const couponCodesToResolve = features.coupons ? requestedCouponCodes : [];
        
        couponBenefits = await CouponService.resolveCoupons(couponCodesToResolve, userId, {
            cartSubtotal: subtotal,
            cartItems: checkoutItems,
            shippingCost,
            transaction: t,
        });

        // If a code was provided but coupons are disabled, we might want to log it or just silently ignore
        // For now, we silently ignore by resolving with empty array, which handles auto-coupons too (none will be returned if resolved with empty array and features.coupons is false)
        // Wait, resolveCoupons itself should probably check the flag too for A-to-Z enforcement.

        orderDiscountAmount = Number(couponBenefits?.orderDiscount || 0);
        appliedCoupon = couponBenefits?.primaryCoupon || couponBenefits?.coupon || null;

        let shippingDiscount = 0;
        if (couponBenefits?.freeShipping) {
            shippingDiscount = Number(couponBenefits.shippingDiscount || shippingCost || 0);
            shippingCost = 0;
        }

        const discountAmount = Number((orderDiscountAmount + shippingDiscount).toFixed(2));

        const total = Number(Math.max(0, subtotal + totalTax + shippingCost - discountAmount).toFixed(2));

        const eventBuffer = [];

        for (const item of checkoutItems) {
            const product = item.currentProduct;
            let updatedRows;
            
            if (item.variantId) {
                updatedRows = await ProductVariant.update(
                    { reservedQty: sequelize.literal(`reserved_qty + ${item.quantity}`) },
                    {
                        where: {
                            id: item.variantId,
                            [Op.and]: sequelize.literal(`(stock_qty - reserved_qty) >= ${item.quantity}`)
                        },
                        transaction: t
                    }
                );
            } else {
                updatedRows = await Product.update(
                    { reservedQty: sequelize.literal(`reserved_qty + ${item.quantity}`) },
                    { 
                        where: { 
                            id: product.id, 
                            [Op.and]: sequelize.literal(`(quantity - reserved_qty) >= ${item.quantity}`)
                        }, 
                        transaction: t 
                    }
                );
            }

            if (updatedRows[0] === 0) {
                 throw new AppError('CONFLICT', 409, `Insufficient stock for product ${product.name}`);
            }
            
            eventBuffer.push({
                name: PRODUCT_EVENTS.STOCK_CHANGED,
                payload: {
                    productId: product.id,
                    variantId: item.variantId || null,
                    change: -item.quantity,
                    type: 'reservation'
                }
            });
        }

        const crypto = require('crypto');
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
        const randStr = crypto.randomBytes(3).toString('hex').toUpperCase();
        const orderNumber = `ORD-${dateStr}-${randStr}`;

        const initialOrderStatus = paymentMethod === 'cod' ? ORDER_DEFAULT_STATUS : 'pending_payment';
        const initialPaymentStatus = paymentMethod === 'cod' ? 'pending_cod' : 'payment_pending';

        const order = await Order.create({
            orderNumber,
            userId,
            status: initialOrderStatus,
            orderShippingStatus: 'not_shipped',
            putBackStatus: null,
            putBackProcessingStatus: false,
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
            shipmentStatus: 'not_shipped',
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
                status: initialPaymentStatus,
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

        await logOrderHistory({
            orderId: order.id,
            entityType: 'Order',
            entityId: order.id,
            statusGroup: 'order',
            toStatus: initialOrderStatus,
            changedBy: userId,
            metadata: { notes, paymentMethod },
            transaction: t,
        });

        if (paymentMethod === 'cod') {
            await addOrderHistoryEvent({
                orderId: order.id,
                eventType: 'order_placed',
                description: 'Order was placed successfully.',
                actorId: userId,
                actorType: 'customer',
                transaction: t,
            });
        } else {
            await addOrderHistoryEvent({
                orderId: order.id,
                eventType: 'payment',
                description: 'Online payment was initiated. The order will be confirmed after payment succeeds.',
                actorId: userId,
                actorType: 'customer',
                transaction: t,
            });
        }

        const appliedCouponIds = (couponBenefits?.appliedCoupons || []).map((coupon) => coupon.id);
        if (paymentMethod === 'cod') {
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
        }

        if (cart && paymentMethod === 'cod') {
            await cart.update({ status: 'converted' }, { transaction: t });
        }
        
        // Finalize transaction
        return { order, eventBuffer };
    });

    // Emit all buffered events after commit
    eventBuffer.forEach(evt => events.emit(evt.name, evt.payload));

    events.emit(ORDER_EVENTS.PLACED, {
        orderId: order.id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        total: order.total
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

    if (paymentMethod === 'cod') {
        try {
            if (NotificationService && NotificationService.sendToUser) {
                const user = await User.findByPk(userId);
                if (user) {
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
    }

    return {
        order,
        ...(clientSecret ? { clientSecret } : {}),
    };
};

const getOrders = async (userId, isAdmin, page = 1, limit = 20, filters = {}) => {
    const { limit: lmt, offset } = getPagination(page, limit);
    const where = isAdmin ? {} : { userId };

    const normalizedStatus = typeof filters.status === 'string' ? filters.status.trim() : '';
    const normalizedSearch = typeof filters.search === 'string' ? filters.search.trim() : '';
    const productId = filters.productId;
    // We'll apply productId filter inside the include to stay subQuery-safe


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
        required: !!productId,
        where: productId ? { productId } : undefined,
        include: [
            {
                model: Product,
                as: 'product',
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
    

    const result = await Order.findAndCountAll({
        where,
        include,
        limit: lmt,
        offset,
        order: [['createdAt', 'DESC']],
        distinct: true,
        // Only use subQuery: false if we have a search that joins User or items, 
        // as Sequelize root 'where' with '$' syntax requires it.
        subQuery: !!normalizedSearch,
    });

    let counts = {};
    if (isAdmin) {
        const countWhere = { ...where };
        delete countWhere.status;

        // Ensure we include items if productId filter is active or search is active
        const countInclude = (normalizedSearch ? include : [])
            .map(inc => ({ ...inc, attributes: [] }));
        if (productId && !countInclude.some(inc => inc.as === 'items')) {
            countInclude.push({
                model: OrderItem,
                as: 'items',
                attributes: [],
                required: true,
                include: [{ model: Product, as: 'product', attributes: [] }]
            });
        }

        const statusCounts = await Order.findAll({
            where: countWhere,
            include: countInclude,
            attributes: [
                [sequelize.col('Order.status'), 'status'],
                [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('Order.id'))), 'count']
            ],
            group: [sequelize.col('Order.status')],
            raw: true
        });
        counts = statusCounts.reduce((acc, curr) => {
            acc[curr.status] = parseInt(curr.count, 10);
            return acc;
        }, {});
    }

    return {
        rows: result.rows,
        count: result.count,
        counts
    };
};

const getOrderById = async (id, userId, isAdmin) => {
    const where = isAdmin ? { id } : { id, userId };
    let order = await Order.findOne({
        where,
        include: HEAVY_ORDER_INCLUDE,
    });

    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
    if (order.status === 'closed') {
        await sequelize.transaction(async (t) => {
            const lockedOrder = await Order.findByPk(order.id, {
                transaction: t,
                lock: Transaction.LOCK.UPDATE,
            });
            await repairInvalidClosedOrder(lockedOrder, t);
        });
        order = await Order.findOne({ where, include: HEAVY_ORDER_INCLUDE });
    }
    if (order.status !== 'closed' && order.status !== 'cancelled') {
        await sequelize.transaction(async (t) => {
            const lockedOrder = await Order.findByPk(order.id, {
                transaction: t,
                lock: Transaction.LOCK.UPDATE,
            });
            await repairCompletableOrder(lockedOrder, t);
        });
        order = await Order.findOne({ where, include: HEAVY_ORDER_INCLUDE });
    }
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
            include: [
                { model: FulfillmentItem, as: 'fulfillmentItems', required: false },
                { model: ShipmentItem, as: 'shipmentItems', required: false },
            ],
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

        const payment = await Payment.findOne({
            where: { orderId: order.id },
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });
        const normalizedPaymentStatus = normalizePaymentStatus(payment?.status, payment?.provider || order.paymentMethod);
        if (order.paymentMethod !== 'cod' && !isPaymentSettled(normalizedPaymentStatus, payment?.provider)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Cannot ship an unpaid online order');
        }
        if (order.paymentMethod === 'cod' && normalizedPaymentStatus !== 'pending_cod' && normalizedPaymentStatus !== 'paid_cod') {
            throw new AppError('VALIDATION_ERROR', 400, 'COD shipment requires pending COD or paid COD payment state');
        }

        // Build map: orderItemId → { totalQty, alreadyShipped, remaining, productId, snapshotName }
        const orderItemMap = {};
        for (const oi of order.items) {
            const alreadyShipped = getDispatchedQuantityForOrderItem(oi);
            orderItemMap[oi.id] = {
                totalQty:      oi.quantity,
                alreadyShipped,
                remaining:     oi.quantity - alreadyShipped,
                productId:     oi.productId,
                variantId:     oi.variantId,
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

        // Group total deduction by product/variant key
        const stockDeductions = new Map(); // "productId:variantId" -> total qty to deduct
        for (const item of items) {
            const qty  = Number(item.quantity);
            const info = orderItemMap[item.orderItemId];
            if (!info?.productId) continue; 
            
            const key = `${info.productId}:${info.variantId || ''}`;
            stockDeductions.set(
                key,
                (stockDeductions.get(key) || 0) + qty
            );
        }

        // Row-lock each product/variant then perform strict atomic stock deduction
        for (const [key, qty] of stockDeductions) {
            const [productId, variantIdStr] = key.split(':');
            const variantId = variantIdStr || null;

            if (variantId) {
                const variant = await ProductVariant.findByPk(variantId, {
                    transaction: t,
                    lock: Transaction.LOCK.UPDATE,
                });

                if (!variant) {
                    throw new AppError('NOT_FOUND', 404, `Variant ${variantId} not found during stock deduction`);
                }

                const [affectedRows] = await ProductVariant.update(
                    {
                        stockQty: sequelize.literal(`stock_qty - ${qty}`),
                        reservedQty: sequelize.literal(`reserved_qty - ${qty}`),
                    },
                    {
                        where: {
                            id: variantId,
                            stockQty: { [Op.gte]: qty },
                            reservedQty: { [Op.gte]: qty },
                        },
                        transaction: t,
                    }
                );

                if (affectedRows === 0) {
                    throw new AppError('CONFLICT', 409, `Stock deduction failed for variant ${variant.sku}: insufficient quantity or reserved stock.`);
                }
            } else {
                const product = await Product.findByPk(productId, {
                    transaction: t,
                    lock: Transaction.LOCK.UPDATE,
                });

                if (!product) {
                    throw new AppError('NOT_FOUND', 404, `Product ${productId} not found during stock deduction`);
                }

                const [affectedRows] = await Product.update(
                    {
                        quantity: sequelize.literal(`quantity - ${qty}`),
                        reservedQty: sequelize.literal(`reserved_qty - ${qty}`),
                    },
                    {
                        where: {
                            id: productId,
                            quantity: { [Op.gte]: qty },
                            reservedQty: { [Op.gte]: qty },
                        },
                        transaction: t,
                    }
                );

                if (affectedRows === 0) {
                    throw new AppError('CONFLICT', 409, `Stock deduction failed for "${product.name}": insufficient quantity or reserved stock.`);
                }
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

        const productIds = items.map(reqItem => orderItemMap[reqItem.orderItemId]?.productId).filter(Boolean);
        const products = await Product.findAll({
            where: { id: productIds },
            attributes: ['id', 'weightGrams', 'lengthCm', 'breadthCm', 'heightCm'],
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

        let providerShipmentId = null;
        let awbCode = trackingNumber || null;
        let trackingUrl = null;
        let labelUrl = null;
        let finalStatus = status === 'pending' ? SHIPMENT_DEFAULT_STATUS : (status || SHIPMENT_DEFAULT_STATUS);
        let courierName = courier || (provider ? provider.name : 'Manual Shipping');
        let rawResponse = null;

        // Create the fulfillment record
        ensureValidShipmentTransition(SHIPMENT_DEFAULT_STATUS, finalStatus);
        const fulfillment = await Fulfillment.create({
            orderId,
            trackingNumber: awbCode,
            courier:        courierName,
            notes:          notes || null,
            status:         finalStatus === SHIPMENT_DEFAULT_STATUS ? 'pending' : finalStatus,
        }, { transaction: t });

        // Hit Provider API if not manual
        if (adapter && provider.code !== 'manual') {
            const user = await User.findByPk(order.userId, { transaction: t });
            order.user = user;

            const address = order.shippingAddressSnapshot || {};
            
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

        const nextOrderStatus = order.status === 'processing' ? 'ready_for_shipment' : order.status;
        if (order.status !== nextOrderStatus) {
            const previousOrderStatus = order.status;
            ensureValidOrderTransition(order.status, nextOrderStatus);
            await order.update({ status: nextOrderStatus }, { transaction: t });
            await logOrderHistory({
                orderId: order.id,
                entityType: 'Order',
                entityId: order.id,
                statusGroup: 'order',
                fromStatus: previousOrderStatus,
                toStatus: nextOrderStatus,
                changedBy: actingUserId,
                metadata: { event: 'shipment_created' },
                transaction: t,
            });
        }
        const newStatus = await syncOrderShippingStatus(order, t, actingUserId);

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
                        newOrderShippingStatus: newStatus,
                    },
                }, t);
            }
        } catch (err) {}

        fulfillment.setDataValue('shipments', [shipment]);
        return fulfillment;
    });
};


const updateStatus = async (id, status, actingUserId) => {
    let orderRecord, beforeStatus, eventBuffer = [];

    await sequelize.transaction(async (t) => {
        const order = await Order.findByPk(id, {
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

        beforeStatus = order.status;
        if (status === 'refunded') {
            throw new AppError('VALIDATION_ERROR', 400, 'Use the refund action so payment state and audit metadata stay consistent');
        }

        ensureValidOrderTransition(order.status, status);
        const payment = await Payment.findOne({
            where: { orderId: id },
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });
        const derivedShippingStatus = await syncOrderShippingStatus(order, t, actingUserId);
        if (status === 'closed' && !canCloseOrder({ order, payment, orderShippingStatus: derivedShippingStatus })) {
            throw new AppError(
                'VALIDATION_ERROR',
                400,
                'Cannot close order until payment is settled and shipment lifecycle is delivered or RTO'
            );
        }
        if (
            status === 'processing' &&
            order.paymentMethod !== 'cod' &&
            (!payment || ['payment_pending', 'pending'].includes(payment.status))
        ) {
            throw new AppError(
                'VALIDATION_ERROR',
                400,
                'Online orders can move to processing only after payment is completed'
            );
        }
        if (status === 'cancelled') {
            const activeShipmentCount = await Shipment.count({
                where: { orderId: order.id },
                transaction: t,
            });
            if (activeShipmentCount > 0) {
                throw new AppError('VALIDATION_ERROR', 400, 'Cannot cancel an order after shipment has been created');
            }
        }

        if (status === 'cancelled') {
            eventBuffer = await releaseOrderReservationsAndCoupons(order, t);
        }
        await order.update({ status }, { transaction: t });
        await logOrderHistory({
            orderId: order.id,
            entityType: 'Order',
            entityId: order.id,
            statusGroup: 'order',
            fromStatus: before.status,
            toStatus: status,
            changedBy: actingUserId,
            transaction: t,
        });

        await addOrderHistoryEvent({
            orderId: order.id,
            eventType: 'status_changed',
            description: `Order status changed from ${before.status} to ${status}.`,
            actorId: actingUserId,
            actorType: 'admin',
            transaction: t,
        });
        
        // Sync payment status if order is marked as paid
        if (status === 'processing') {
            if (payment && ['payment_pending', 'pending'].includes(payment.status)) {
                const nextPaymentStatus = payment.provider === 'cod' ? 'pending_cod' : 'paid_online';
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
            if (payment && ['payment_pending', 'pending_cod', 'pending'].includes(payment.status)) {
                await payment.update({ 
                    status: 'payment_failed',
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
                    changes: { before: beforeStatus, after: status }
                }, t);
            }
        } catch(err) {}
        
        orderRecord = await Order.findByPk(id, {
            include: HEAVY_ORDER_INCLUDE,
            transaction: t,
        });
    });

    // Emit events after commit
    eventBuffer.forEach(evt => events.emit(evt.name, evt.payload));

    events.emit(ORDER_EVENTS.STATUS_CHANGED, {
        orderId: id,
        previousStatus: beforeStatus,
        newStatus: status
    });

    return orderRecord;
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

        if (!payment || !['paid_online', 'paid_cod', 'completed', 'cod_collected'].includes(payment.status)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Cannot refund an order before payment has been captured or COD has been collected');
        }

        if (payment && !['paid_online', 'paid_cod', 'completed', 'cod_collected'].includes(payment.status)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Only captured payments can be refunded');
        }

        const refund = await OrderRefund.create({
            orderId: order.id,
            paymentId: payment.id,
            amount: payment.amount,
            currency: payment.currency || 'INR',
            status: 'refunded',
            reason: 'Manual full-order refund',
            processedAt: new Date(),
            metadata: { legacyFullOrderRefund: true },
        }, { transaction: t });

        if (payment && !['refunded'].includes(payment.status)) {
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

        await logOrderHistory({
            orderId: order.id,
            entityType: 'OrderRefund',
            entityId: refund.id,
            statusGroup: 'refund',
            toStatus: 'refunded',
            changedBy: actingUserId,
            metadata: { amount: payment.amount },
            transaction: t,
        });

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: ACTIONS.STATUS_CHANGE,
                    entity: ENTITIES.ORDER,
                    entityId: id,
                    changes: { refundId: refund.id, status: 'refunded' },
                }, t);
            }
        } catch (err) {}

        return order.id;
    });

    return getOrderById(refundedOrderId, actingUserId, true);
};

const cancelOrder = async (id, userId) => {
    let orderRecord, prevStatus, eventsToEmit;

    await sequelize.transaction(async (t) => {
        const order = await Order.findOne({ where: { id, userId }, include: [{ model: OrderItem, as: 'items' }], transaction: t });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

        prevStatus = order.status;

        if (!isCustomerCancelableOrderStatus(order.status)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Only pending or processing orders can be cancelled');
        }
        const activeShipmentCount = await Shipment.count({
            where: { orderId: order.id },
            transaction: t,
        });
        if (activeShipmentCount > 0) {
            throw new AppError('VALIDATION_ERROR', 400, 'Cannot cancel an order after shipment has been created');
        }


        ensureValidOrderTransition(previousStatus, 'cancelled');
        await releaseOrderReservationsAndCoupons(order, t);

        await order.update({ status: 'cancelled' }, { transaction: t });
        await logOrderHistory({
            orderId: order.id,
            entityType: 'Order',
            entityId: order.id,
            statusGroup: 'order',
            fromStatus: previousStatus,
            toStatus: 'cancelled',
            changedBy: userId,
            transaction: t,
        });

        // Sync payment status
        const payment = await Payment.findOne({
            where: { orderId: order.id },
            transaction: t,
            lock: Transaction.LOCK.UPDATE
        });
        if (payment && ['pending', 'payment_pending', 'pending_cod'].includes(payment.status)) {
            await payment.update({
                status: 'payment_failed',
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
                    changes: { before: prevStatus, after: 'cancelled' },
                }, t);
            }
        } catch (err) {}

        orderRecord = await Order.findByPk(id, {
            include: HEAVY_ORDER_INCLUDE,
            transaction: t,
        });
    });

    // Emit events after commit
    if (eventsToEmit) {
        eventsToEmit.forEach(evt => events.emit(evt.name, evt.payload));
    }

    events.emit(ORDER_EVENTS.STATUS_CHANGED, {
        orderId: id,
        previousStatus: prevStatus,
        newStatus: 'cancelled'
    });

    return orderRecord;
};

const updateFulfillmentStatus = async (orderId, fulfillmentId, status, actingUserId) => {
    await sequelize.transaction(async (t) => {
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

        const nextShipmentStatus = status === 'pending' ? SHIPMENT_DEFAULT_STATUS : status;
        const oldStatus = fulfillment.status === 'pending' ? SHIPMENT_DEFAULT_STATUS : fulfillment.status;
        if (oldStatus === nextShipmentStatus) return;
        ensureValidShipmentTransition(oldStatus, nextShipmentStatus);
        await fulfillment.update({ status: nextShipmentStatus === SHIPMENT_DEFAULT_STATUS ? 'pending' : nextShipmentStatus }, { transaction: t });
        const linkedShipments = await Shipment.findAll({
            where: { fulfillmentId: fulfillment.id },
            transaction: t,
        });
        for (const shipment of linkedShipments) {
            const history = Array.isArray(shipment.statusHistory) ? shipment.statusHistory : [];
            await shipment.update({
                status: nextShipmentStatus,
                statusHistory: appendStatusHistoryEvent(history, nextShipmentStatus),
            }, { transaction: t });
            await logOrderHistory({
                orderId: order.id,
                entityType: 'Shipment',
                entityId: shipment.id,
                statusGroup: 'shipment',
                fromStatus: oldStatus,
                toStatus: nextShipmentStatus,
                changedBy: actingUserId,
                transaction: t,
            });
        }
        const derivedShippingStatus = await syncOrderShippingStatus(order, t, actingUserId);
        await syncCodPaymentIfDelivered(order, t, actingUserId);
        await syncOrderClosureIfComplete(order, t, actingUserId);

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: 'STATUS_CHANGE',
                    entity: 'Fulfillment',
                    entityId: fulfillment.id,
                    changes: { before: oldStatus, after: nextShipmentStatus, orderShippingStatus: derivedShippingStatus },
                }, t);
            }
        } catch (err) {}
    });

    return getOrderById(orderId, actingUserId, true);
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

const createShipment = createFulfillment;

const updateShipmentStatus = async (orderId, shipmentId, payload, actingUserId) => {
    const { status, trackingNumber, trackingUrl, courierName } = payload;
    await sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, { transaction: t, lock: Transaction.LOCK.UPDATE });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

        const shipment = await Shipment.findOne({
            where: { id: shipmentId, orderId },
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });
        if (!shipment) throw new AppError('NOT_FOUND', 404, 'Shipment not found');

        const before = shipment.status;
        if (status) ensureValidShipmentTransition(before, status);
        const history = Array.isArray(shipment.statusHistory) ? shipment.statusHistory : [];
        const updates = {
            ...(trackingNumber !== undefined ? { trackingNumber, awb: trackingNumber } : {}),
            ...(trackingUrl !== undefined ? { trackingUrl } : {}),
            ...(courierName !== undefined ? { courierName } : {}),
        };
        const statusChanged = status && status !== before;
        if (statusChanged) {
            updates.status = status;
            updates.statusHistory = appendStatusHistoryEvent(history, status);
        }
        await shipment.update(updates, { transaction: t });

        if (shipment.fulfillmentId && statusChanged) {
            await Fulfillment.update(
                { status: status === SHIPMENT_DEFAULT_STATUS ? 'pending' : status },
                { where: { id: shipment.fulfillmentId }, transaction: t }
            );
        }

        if (statusChanged) {
            await logOrderHistory({
                orderId,
                entityType: 'Shipment',
                entityId: shipment.id,
                statusGroup: 'shipment',
                fromStatus: before,
                toStatus: status,
                changedBy: actingUserId,
                metadata: { trackingNumber, trackingUrl, courierName },
                transaction: t,
            });
        }

        await syncOrderShippingStatus(order, t, actingUserId);
        await syncCodPaymentIfDelivered(order, t, actingUserId);
        await syncOrderClosureIfComplete(order, t, actingUserId);
    });

    return getOrderById(orderId, actingUserId, true);
};

const getDeliveredQuantityByOrderItem = async (orderId, transaction) => {
    const deliveredShipments = await Shipment.findAll({
        where: { orderId, status: 'delivered' },
        include: [{ model: ShipmentItem, as: 'items' }],
        transaction,
    });
    return deliveredShipments.flatMap((shipment) => shipment.items || []).reduce((map, item) => {
        map[item.orderItemId] = (map[item.orderItemId] || 0) + Number(item.quantity || 0);
        return map;
    }, {});
};

const getActivePutBackQuantityByOrderItem = async (orderId, type, transaction, excludeId = null) => {
    const where = { orderId, type };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    const records = await OrderReturn.findAll({
        where,
        include: [{ model: OrderReturnItem, as: 'items' }],
        transaction,
    });
    return records
        .filter((record) => !['return_rejected', 'replacement_rejected'].includes(record.status))
        .flatMap((record) => record.items || [])
        .reduce((map, item) => {
            map[item.orderItemId] = (map[item.orderItemId] || 0) + Number(item.quantity || 0);
            return map;
        }, {});
};

const createPutBackRequest = async (orderId, payload, actingUserId, isAdmin, type) => {
    const defaultStatus = type === 'replacement' ? REPLACEMENT_DEFAULT_STATUS : RETURN_DEFAULT_STATUS;
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, { transaction: t, lock: Transaction.LOCK.UPDATE });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
        if (!isAdmin && order.userId !== actingUserId) throw new AppError('FORBIDDEN', 403, 'You cannot access this order');
        if (!Array.isArray(payload.items) || payload.items.length === 0) {
            throw new AppError('VALIDATION_ERROR', 400, 'At least one item is required');
        }

        const orderItems = await OrderItem.findAll({ where: { orderId }, transaction });
        const itemIds = new Set(orderItems.map((item) => item.id));
        const deliveredQty = await getDeliveredQuantityByOrderItem(orderId, t);
        const existingQty = await getActivePutBackQuantityByOrderItem(orderId, type, t);
        const requestedByItem = {};

        for (const item of payload.items) {
            const qty = Number(item.quantity);
            if (!itemIds.has(item.orderItemId)) {
                throw new AppError('VALIDATION_ERROR', 400, `Order item ${item.orderItemId} does not belong to this order`);
            }
            if (!Number.isInteger(qty) || qty <= 0) {
                throw new AppError('VALIDATION_ERROR', 400, 'Return/replacement quantity must be a positive integer');
            }
            requestedByItem[item.orderItemId] = (requestedByItem[item.orderItemId] || 0) + qty;
            const available = Number(deliveredQty[item.orderItemId] || 0) - Number(existingQty[item.orderItemId] || 0);
            if (requestedByItem[item.orderItemId] > available) {
                throw new AppError('VALIDATION_ERROR', 400, `Cannot ${type} more units than delivered for an item`);
            }
        }

        const record = await OrderReturn.create({
            orderId,
            requestedBy: actingUserId,
            type,
            status: defaultStatus,
            reason: payload.reason || null,
            metadata: payload.metadata || {},
        }, { transaction: t });

        for (const item of payload.items) {
            await OrderReturnItem.create({
                returnId: record.id,
                orderItemId: item.orderItemId,
                shipmentItemId: item.shipmentItemId || null,
                quantity: Number(item.quantity),
                reason: item.reason || payload.reason || null,
                metadata: item.metadata || {},
            }, { transaction: t });
        }

        await logOrderHistory({
            orderId,
            entityType: type === 'replacement' ? 'Replacement' : 'Return',
            entityId: record.id,
            statusGroup: type,
            toStatus: defaultStatus,
            changedBy: actingUserId,
            metadata: { reason: payload.reason },
            transaction: t,
        });
        await syncPutBackCache(order, t, actingUserId);
        return OrderReturn.findByPk(record.id, {
            include: [{ model: OrderReturnItem, as: 'items' }],
            transaction: t,
        });
    });
};

const createReturnRequest = (orderId, payload, actingUserId, isAdmin = false) => (
    createPutBackRequest(orderId, payload, actingUserId, isAdmin, 'return')
);

const createReplacementRequest = (orderId, payload, actingUserId, isAdmin = false) => (
    createPutBackRequest(orderId, payload, actingUserId, isAdmin, 'replacement')
);

const updatePutBackStatus = async (orderId, returnId, status, actingUserId, isAdmin) => {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, { transaction: t, lock: Transaction.LOCK.UPDATE });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
        if (!isAdmin && order.userId !== actingUserId) throw new AppError('FORBIDDEN', 403, 'You cannot access this order');
        const record = await OrderReturn.findOne({
            where: { id: returnId, orderId },
            include: [{ model: OrderReturnItem, as: 'items' }],
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });
        if (!record) throw new AppError('NOT_FOUND', 404, 'Return/replacement request not found');
        const before = record.status;
        ensureValidStatusTransition('return', before, status);
        const updates = { status };
        if (status.endsWith('_approved')) updates.approvedAt = new Date();
        if (status.endsWith('_rejected')) updates.rejectedAt = new Date();
        if (status.endsWith('_completed')) updates.completedAt = new Date();
        await record.update(updates, { transaction: t });
        await logOrderHistory({
            orderId,
            entityType: record.type === 'replacement' ? 'Replacement' : 'Return',
            entityId: record.id,
            statusGroup: record.type,
            fromStatus: before,
            toStatus: status,
            changedBy: actingUserId,
            transaction: t,
        });
        await syncPutBackCache(order, t, actingUserId);
        return OrderReturn.findByPk(record.id, {
            include: [{ model: OrderReturnItem, as: 'items' }],
            transaction: t,
        });
    });
};

const processRefund = async (orderId, payload, actingUserId, isAdmin) => {
    if (!isAdmin) throw new AppError('FORBIDDEN', 403, 'You do not have permission to refund orders');
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, { transaction: t, lock: Transaction.LOCK.UPDATE });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
        const payment = await Payment.findOne({ where: { orderId }, transaction: t, lock: Transaction.LOCK.UPDATE });
        if (!payment || !['paid_online', 'paid_cod', 'completed', 'cod_collected'].includes(payment.status)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Cannot refund before payment has been captured');
        }
        let returnRequest = null;
        if (payload.returnId) {
            returnRequest = await OrderReturn.findOne({ where: { id: payload.returnId, orderId }, transaction: t });
            if (!returnRequest) throw new AppError('NOT_FOUND', 404, 'Return/replacement request not found');
            if (!['pickup_completed', 'return_completed'].includes(returnRequest.status)) {
                throw new AppError('VALIDATION_ERROR', 400, 'Cannot refund before pickup or return completion');
            }
        }
        const amount = Number(payload.amount || payment.amount);
        if (!Number.isFinite(amount) || amount <= 0 || amount > Number(payment.amount)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Refund amount must be greater than 0 and cannot exceed payment amount');
        }
        const refundStatus = payload.status || (amount < Number(payment.amount) ? 'partially_refunded' : 'refunded');
        const refund = await OrderRefund.create({
            orderId,
            returnId: returnRequest?.id || null,
            paymentId: payment.id,
            amount,
            currency: payment.currency || 'INR',
            status: refundStatus,
            reason: payload.reason || null,
            providerRefundId: payload.providerRefundId || null,
            processedAt: ['refunded', 'partially_refunded'].includes(refundStatus) ? new Date() : null,
            metadata: payload.metadata || {},
        }, { transaction: t });
        if (refundStatus === 'refunded') {
            await payment.update({
                status: 'refunded',
                metadata: {
                    ...(payment.metadata || {}),
                    refundedBy: actingUserId,
                    refundedAt: new Date().toISOString(),
                },
            }, { transaction: t });
        }
        await logOrderHistory({
            orderId,
            entityType: 'OrderRefund',
            entityId: refund.id,
            statusGroup: 'refund',
            toStatus: refund.status,
            changedBy: actingUserId,
            metadata: { amount },
            transaction: t,
        });
        return refund;
    });
};

const addNote = async (orderId, note, actorId) => {
    const order = await Order.findByPk(orderId, { attributes: ['id'] });
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

    const event = await addOrderHistoryEvent({
        orderId,
        eventType: 'admin_note',
        description: note,
        actorId,
        actorType: 'admin',
    });
    return event;
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
    createShipment,
    updateShipmentStatus,
    createReturnRequest,
    createReplacementRequest,
    updatePutBackStatus,
    processRefund,
    getAllowedNextStatuses: (status) => getAllowedNextStatuses('order', normalizeOrderStatus(status)),
    addOrderHistoryEvent,
    addNote,
};
