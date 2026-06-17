'use strict';
const { Op, Transaction } = require('sequelize');
const {
    sequelize,
    Order,
    OrderItem,
    Cart,
    CartItem,
    Product,
    ProductImage,
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
    UserProfile,
} = require('../index');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
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
const InventoryService = require('../inventory/inventory.service');
const { normalizeDateOnly, isDateOnOrAfter } = require('./orderDate.utils');

const { getPagination } = require('../../utils/pagination');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const { getVariantUnitPrice } = require('../product/product.pricing');
const productComboService = require('../product/productCombo.service');
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
    normalizePutBackRecordStatus,
    ensureValidStatusTransition,
    deriveOrderShippingStatus,
    derivePutBackCache,
    isPaymentSettled,
    isShippingTerminal,
    canCloseOrder,
} = require('../../utils/orderWorkflow');

const ADMIN_ORDER_LIST_USER_ATTRIBUTES = ['id', 'firstName', 'lastName', 'email'];
const ADMIN_ORDER_PAYMENT_ATTRIBUTES = ['id', 'provider', 'status', 'amount', 'currency', 'transactionId', 'metadata', 'createdAt', 'updatedAt'];

const queueShipmentNotification = async (orderId, shipmentStatus, shipment = {}) => {
    if (!['shipped', 'out_for_delivery', 'delivered'].includes(shipmentStatus)) return;
    try {
        const order = await Order.findByPk(orderId);
        if (!order) return;

        if (['out_for_delivery', 'delivered'].includes(shipmentStatus)) {
            await NotificationService.sendDeliveryUpdate(order.userId, order.id, shipmentStatus);
            return;
        }

        const user = await User.findByPk(order.userId, {
            include: [{ model: UserProfile, as: 'profile', required: false }],
        });
        if (!user) return;

        await NotificationService.sendToUser(
            'order_shipped',
            ['email', 'sms', 'whatsapp'],
            user,
            {
                order_number: order.orderNumber,
                order_id: order.id,
                customer_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                tracking_number: shipment.trackingNumber || shipment.awb,
                tracking_url: shipment.trackingUrl,
                courier: shipment.courierName,
                order_total: order.total,
            },
            order.id
        );
    } catch (err) {
        logger.error('Failed to queue shipment notification', { orderId, shipmentStatus, error: err.message });
    }
};

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

const appendExpectedDeliveryHistory = (history = [], nextDate, actingUserId = null, source = 'admin') => {
    const date = normalizeDateOnly(nextDate);
    if (!date) return Array.isArray(history) ? history : [];
    const entries = Array.isArray(history) ? history : [];
    const previousDate = entries[entries.length - 1]?.date || null;
    return [
        ...entries,
        {
            date,
            previousDate,
            at: new Date().toISOString(),
            source,
            changedBy: actingUserId,
        },
    ];
};

const assertExpectedDeliveryDateNotBeforeOrderDate = (expectedDeliveryDate, orderDate) => {
    if (!expectedDeliveryDate) return;
    if (!isDateOnOrAfter(expectedDeliveryDate, orderDate)) {
        throw new AppError('VALIDATION_ERROR', 400, 'Expected delivery date cannot be before the order date');
    }
};

const syncOrderShippingStatus = async (order, transaction, actingUserId = null) => {
    const shipments = await Shipment.findAll({
        where: { orderId: order.id },
        attributes: ['id', 'status'],
        include: [{ model: ShipmentItem, as: 'items' }],
        transaction,
    });
    const orderItems = await OrderItem.findAll({
        where: { orderId: order.id },
        attributes: ['id', 'quantity'],
        transaction,
    });
    const nextStatus = deriveQuantityAwareOrderShippingStatus(orderItems, shipments);
    if (order.orderShippingStatus !== nextStatus) {
        const previous = order.orderShippingStatus;
        await order.update({ orderShippingStatus: nextStatus }, { transaction });
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

const deriveQuantityAwareOrderShippingStatus = (orderItems = [], shipments = []) => {
    const fallbackStatus = deriveOrderShippingStatus(shipments);
    const totalQuantity = orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    if (totalQuantity <= 0) return fallbackStatus;

    const deliveredQuantity = shipments
        .filter((shipment) => shipment.status === 'delivered')
        .flatMap((shipment) => shipment.items || [])
        .reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    if (deliveredQuantity >= totalQuantity) return 'delivered';
    if (deliveredQuantity > 0) return 'partially_delivered';
    return fallbackStatus === 'delivered' ? 'partially_delivered' : fallbackStatus;
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
        include: [{ model: ShipmentItem, as: 'items' }],
        transaction,
    });
    const orderItems = await OrderItem.findAll({
        where: { orderId: order.id },
        attributes: ['id', 'quantity'],
        transaction,
    });
    const derivedShippingStatus = deriveQuantityAwareOrderShippingStatus(orderItems, shipments);

    if (canCloseOrder({ order, payment, orderShippingStatus: derivedShippingStatus })) {
        if (order.orderShippingStatus !== derivedShippingStatus) {
            await order.update({ orderShippingStatus: derivedShippingStatus }, { transaction });
        }
        return order;
    }

    const nextStatus = shipments.length > 0 ? 'ready_for_shipment' : 'processing';
    await order.update({
        status: nextStatus,
        orderShippingStatus: derivedShippingStatus,
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
        include: [{ model: ShipmentItem, as: 'items' }],
        transaction,
    });
    const orderItems = await OrderItem.findAll({
        where: { orderId: order.id },
        attributes: ['id', 'quantity'],
        transaction,
    });
    const derivedShippingStatus = deriveQuantityAwareOrderShippingStatus(orderItems, shipments);
    if (order.orderShippingStatus !== derivedShippingStatus) {
        await order.update({ orderShippingStatus: derivedShippingStatus }, { transaction });
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

const getPrimaryProductImageUrl = (product = {}) => {
    const images = Array.isArray(product.images) ? product.images : [];
    const image = images.find((item) => item.isPrimary) || images[0];
    return image?.url || null;
};

const HEAVY_ORDER_INCLUDE = [
    {
        model: OrderItem,
        as: 'items',
        include: [
            {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'slug'],
                required: false,
                include: [{ model: ProductImage, as: 'images', attributes: ['id', 'url', 'alt', 'sortOrder', 'isPrimary'], required: false }],
            },
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
                    { model: OrderItem, as: 'orderItem', attributes: ['id', 'snapshotName', 'snapshotSku', 'snapshotImage', 'variantInfo', 'quantity', 'total'] },
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
                    { model: OrderItem, as: 'orderItem', attributes: ['id', 'snapshotName', 'snapshotSku', 'snapshotImage', 'variantInfo', 'quantity', 'total'] },
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
    const shippingStatus = order.orderShippingStatus || 'not_shipped';
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
    if (order.inventoryReleasedAt) {
        return [];
    }

    const orderItems = order.items || await OrderItem.findAll({
        where: { orderId: order.id },
        transaction,
    });

    const eventBuffer = [];
    const variantProductIdsToSync = new Set();
    for (const item of orderItems) {
        if (!item.productId || Number(item.quantity) <= 0) continue;
        await InventoryService.release({
            productId: item.productId,
            variantId: item.variantId || null,
            qty: Number(item.quantity),
            orderId: order.id,
            orderItemId: item.id,
            metadata: {
                reason: 'order_cancel_or_release',
            },
            transaction,
            syncParent: false,
        });
        if (item.variantId) variantProductIdsToSync.add(String(item.productId));
        
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

    for (const productId of variantProductIdsToSync) {
        await InventoryService.syncParentProductFromVariants(productId, transaction);
    }

    await order.update({ inventoryReleasedAt: new Date() }, { transaction });

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

    return eventBuffer;
};

const FINAL_REFUND_STATUSES = Object.freeze(['refunded', 'partially_refunded']);
const money = (value) => Number(Number(value || 0).toFixed(2));

const getCapturedPaymentAmount = (payment, order = {}) => {
    if (!payment) return 0;
    if (payment.provider === 'cod') {
        const collected = money(payment.metadata?.codCollectedAmount);
        if (collected > 0) return collected;
        const paymentAmount = money(payment.amount);
        const orderTotal = money(order.total);
        if (normalizePaymentStatus(payment.status, payment.provider) === 'paid_cod') {
            return paymentAmount || orderTotal;
        }
        if (paymentAmount > 0 && paymentAmount < orderTotal) {
            return paymentAmount;
        }
        return 0;
    }
    return money(payment.amount || order.total);
};

const canRefundCapturedPayment = (payment, order) => {
    if (!payment) return false;
    if (payment.provider === 'cod') return getCapturedPaymentAmount(payment, order) > 0;
    const normalizedStatus = normalizePaymentStatus(payment.status, payment.provider);
    return isPaymentSettled(payment.status, payment.provider) || ['partially_refunded', 'refunded'].includes(normalizedStatus);
};

const getRestoredPaymentStatusAfterPartialRefund = (payment, order = {}) => {
    const provider = payment?.provider || order?.paymentMethod;
    if (provider === 'cod') {
        const orderTotal = money(order?.total);
        const collectedAmount = money(
            payment?.metadata?.codCollectedAmount
            || (money(payment?.metadata?.codDueAmount) === 0 ? payment?.amount : 0)
        );
        return orderTotal > 0 && collectedAmount >= orderTotal ? 'paid_cod' : 'pending_cod';
    }
    return 'paid_online';
};

const repairItemScopedPartialRefundPaymentStatus = async (order, transaction = null) => {
    if (!order) return order;
    const payment = order.Payment || await Payment.findOne({
        where: { orderId: order.id },
        transaction,
    });
    if (!payment || payment.status !== 'partially_refunded') return order;

    const refundedAmount = money(payment.metadata?.refundedAmount);
    const orderTotal = money(order.total);
    if (orderTotal <= 0 || refundedAmount >= orderTotal) return order;

    await payment.update({
        status: getRestoredPaymentStatusAfterPartialRefund(payment, order),
        metadata: {
            ...(payment.metadata || {}),
            itemScopedRefundAmount: refundedAmount,
            refundDueAmount: 0,
            orderRefundBalanceAmount: 0,
        },
    }, { transaction });
    return order;
};

const isCodPaymentShippable = (payment, order) => {
    const normalizedPaymentStatus = normalizePaymentStatus(payment?.status, payment?.provider || order?.paymentMethod);
    if (['pending_cod', 'paid_cod'].includes(normalizedPaymentStatus)) return true;
    if (['refunded', 'partially_refunded'].includes(payment?.status)) {
        const refundedAmount = money(payment?.metadata?.refundedAmount);
        const orderTotal = money(order?.total);
        return orderTotal > 0 && refundedAmount < orderTotal;
    }
    return false;
};

const getRefundedAmount = async (orderId, transaction) => {
    const refunds = await OrderRefund.findAll({
        where: {
            orderId,
            status: { [Op.in]: FINAL_REFUND_STATUSES },
        },
        attributes: ['amount'],
        transaction,
    });
    return refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
};

const getRefundedAmountForReturn = async (returnId, transaction) => {
    if (!returnId) return 0;
    const refunds = await OrderRefund.findAll({
        where: {
            returnId,
            status: { [Op.in]: FINAL_REFUND_STATUSES },
        },
        attributes: ['amount'],
        transaction,
    });
    return money(refunds.reduce((sum, refund) => sum + Number(refund.amount || 0), 0));
};

const getReturnRequestItemAmount = (returnRequest) => {
    const items = returnRequest?.items || [];
    return money(items.reduce((sum, item) => {
        const orderItem = item.orderItem || {};
        const orderedQty = Number(orderItem.quantity || 0);
        const returnedQty = Number(item.quantity || 0);
        const itemTotal = Number(orderItem.total || 0);
        if (orderedQty <= 0 || returnedQty <= 0 || itemTotal <= 0) return sum;
        return sum + (itemTotal * (returnedQty / orderedQty));
    }, 0));
};

const createRefundRecord = async ({
    order,
    payment,
    amount,
    reason,
    actingUserId,
    returnId = null,
    refundScopeAmount = null,
    metadata = {},
    transaction,
}) => {
    const capturedAmount = getCapturedPaymentAmount(payment, order);
    const refundedAmount = await getRefundedAmount(order.id, transaction);
    const remainingRefundable = money(Math.max(capturedAmount - refundedAmount, 0));
    const refundAmount = money(amount ?? remainingRefundable);

    if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Refund amount must be greater than 0');
    }
    if (refundAmount > remainingRefundable) {
        throw new AppError('VALIDATION_ERROR', 400, `Refund amount cannot exceed remaining refundable amount ${remainingRefundable.toFixed(2)}`);
    }

    const orderTotal = money(order.total);
    const nextTotalRefunded = money(refundedAmount + refundAmount);
    const fullRefundBasis = orderTotal > 0 ? orderTotal : capturedAmount;
    const isFullOrderRefund = fullRefundBasis > 0 && nextTotalRefunded >= fullRefundBasis;
    const scopedRefundBasis = money(refundScopeAmount || refundAmount);
    const refundStatus = scopedRefundBasis > 0 && refundAmount >= scopedRefundBasis ? 'refunded' : 'partially_refunded';
    const nextPaymentStatus = isFullOrderRefund
        ? 'refunded'
        : getRestoredPaymentStatusAfterPartialRefund(payment, order);
    const refund = await OrderRefund.create({
        orderId: order.id,
        returnId,
        paymentId: payment.id,
        amount: refundAmount,
        currency: payment.currency || 'INR',
        status: refundStatus,
        reason,
        processedAt: new Date(),
        metadata: {
            ...metadata,
            totalRefundedAmount: nextTotalRefunded,
            capturedAmount,
            refundScopeAmount: scopedRefundBasis,
            itemScoped: Boolean(returnId),
        },
    }, { transaction });

    await payment.update({
        status: nextPaymentStatus,
        metadata: {
            ...(payment.metadata || {}),
            refundedAmount: nextTotalRefunded,
            refundDueAmount: returnId || isFullOrderRefund ? 0 : money(Math.max(capturedAmount - nextTotalRefunded, 0)),
            orderRefundBalanceAmount: returnId || isFullOrderRefund ? 0 : money(Math.max(fullRefundBasis - nextTotalRefunded, 0)),
            itemScopedRefundAmount: returnId ? nextTotalRefunded : payment.metadata?.itemScopedRefundAmount,
            lastRefundedBy: actingUserId,
            lastRefundedAt: new Date().toISOString(),
            fullyRefundedAt: isFullOrderRefund ? new Date().toISOString() : payment.metadata?.fullyRefundedAt,
        },
    }, { transaction });

    await logOrderHistory({
        orderId: order.id,
        entityType: 'OrderRefund',
        entityId: refund.id,
        statusGroup: 'refund',
        toStatus: refundStatus,
        changedBy: actingUserId,
        metadata: { amount: refundAmount, totalRefundedAmount: nextTotalRefunded, reason },
        transaction,
    });

    await addOrderHistoryEvent({
        orderId: order.id,
        eventType: 'refund',
        description: `${refundStatus === 'refunded' ? 'Full' : 'Partial'} refund of ${refundAmount.toFixed(2)} recorded.`,
        actorId: actingUserId,
        actorType: 'admin',
        metadata: { refundId: refund.id, amount: refundAmount, status: refundStatus },
        transaction,
    });

    return refund;
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
                { model: ProductImage, as: 'images' },
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
                            { model: ProductImage, as: 'images' },
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
            
            if (item.variantId) {
                await InventoryService.reserve({
                    productId: item.productId,
                    variantId: item.variantId,
                    qty: Number(item.quantity),
                    metadata: {
                        reason: 'order_placement_reserve',
                    },
                    transaction: t,
                });
            } else if (product.type === 'combo') {
                // Combo products: validate virtual stock against all constituents.
                // Stock deduction happens per-constituent after OrderItem creation.
                await productComboService.validateComboStock(product.id, item.quantity, t);
            } else {
                await InventoryService.reserve({
                    productId: product.id,
                    variantId: null,
                    qty: Number(item.quantity),
                    metadata: {
                        reason: 'order_placement_reserve',
                    },
                    transaction: t,
                });
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
            orderShippingStatus: 'not_shipped',
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
            const isCombo = item.currentProduct?.type === 'combo';
            // Capture immutable combo snapshot at order time
            const comboSnapshot = isCombo
                ? await productComboService.buildComboSnapshot(item.productId, t)
                : null;

            await OrderItem.create({
                orderId: order.id,
                productId: item.productId,
                variantId: item.variantId || null,
                snapshotName: item.currentProduct.name,
                snapshotPrice: item.currentPrice,
                snapshotImage: getPrimaryProductImageUrl(item.currentProduct),
                snapshotSku: item.currentProduct.sku,
                variantInfo: item.variant ? item.variant.toJSON() : null,
                quantity: item.quantity,
                total: item.currentPrice * item.quantity,
                taxBreakdown: item.taxBreakdown || null,
                isCombo,
                comboSnapshot,
            }, { transaction: t });

            // Atomically deduct stock from each constituent for combo products
            if (isCombo) {
                await productComboService.deductComboStock(item.productId, item.quantity, t);
            }
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

    let notificationUser = null;
    try {
        notificationUser = await User.findByPk(userId, {
            include: [{ model: UserProfile, as: 'profile', required: false }],
        });
    } catch (err) {}

    try {
        if (NotificationService && NotificationService.sendToAdmins) {
            await NotificationService.sendToAdmins(
                'admin_new_order',
                ['email', 'sms', 'whatsapp'],
                {
                    customer_name: notificationUser
                        ? `${notificationUser.firstName || ''} ${notificationUser.lastName || ''}`.trim() || notificationUser.email
                        : 'Customer',
                    customer_email: notificationUser?.email || '',
                    order_number: order.orderNumber,
                    order_date: order.createdAt,
                    order_id: order.id,
                    order_total: order.total,
                    order_subtotal: order.subtotal,
                    shipping_total: order.shippingCost,
                    tax_total: order.tax,
                    discount_total: order.discountAmount,
                    payment_method: paymentMethod,
                },
                order.id
            );
        }
    } catch (err) {
        logger.error('Failed to queue admin new order notification', { orderId: order.id, error: err.message });
    }

    if (paymentMethod === 'cod') {
        try {
            if (NotificationService && NotificationService.sendToUser) {
                const user = notificationUser;
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
    const andClauses = [];

    const normalizedStatus = typeof filters.status === 'string' ? filters.status.trim() : '';
    const normalizedShippingStatus = typeof filters.orderShippingStatus === 'string' ? filters.orderShippingStatus.trim() : '';
    const normalizedSearch = typeof filters.search === 'string' ? filters.search.trim() : '';
    const productId = filters.productId;
    // Apply product filter with EXISTS so list query and grouped count query
    // can share identical predicates without fragile include/group behavior.
    if (productId) {
        andClauses.push(
            sequelize.where(
                sequelize.literal(`EXISTS (
                    SELECT 1
                    FROM order_items AS oi
                    WHERE oi.order_id = "Order"."id"
                      AND oi.product_id = ${sequelize.escape(productId)}
                )`),
                true
            )
        );
    }


    // if (normalizedStatus) {
    //     where.status = normalizedStatus;
    // }

    if (normalizedStatus) {
        const statuses = normalizedStatus.split(',').map(s => s.trim()).filter(Boolean);
        where.status = statuses.length === 1 ? statuses[0] : { [Op.in]: statuses };
    }

    if (normalizedShippingStatus) {
        const shippingStatuses = normalizedShippingStatus.split(',').map(s => s.trim()).filter(Boolean);
        where.orderShippingStatus = shippingStatuses.length === 1 ? shippingStatuses[0] : { [Op.in]: shippingStatuses };
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
            // Avoid fragile nested-include alias references in paginated/count queries.
            // Use EXISTS against order_items/products so Postgres always has a valid FROM path.
            sequelize.where(
                sequelize.literal(`EXISTS (
                    SELECT 1
                    FROM order_items AS oi
                    INNER JOIN products AS p ON p.id = oi.product_id
                    WHERE oi.order_id = "Order"."id"
                      AND p.name ILIKE ${sequelize.escape(searchPattern)}
                )`),
                true
            ),
        ];
        if (isAdmin) {
            searchClauses.push(
                sequelize.where(
                    sequelize.literal(`EXISTS (
                        SELECT 1
                        FROM users AS u
                        WHERE u.id = "Order"."user_id"
                          AND (
                            u.first_name ILIKE ${sequelize.escape(searchPattern)}
                            OR u.last_name ILIKE ${sequelize.escape(searchPattern)}
                            OR (u.first_name || ' ' || u.last_name) ILIKE ${sequelize.escape(searchPattern)}
                            OR u.email ILIKE ${sequelize.escape(searchPattern)}
                          )
                    )`),
                    true
                )
            );
            // Search by phone in shipping address snapshot
            searchClauses.push(
                sequelize.where(
                    sequelize.literal(`"Order"."shipping_address_snapshot"->>'phone' ILIKE ${sequelize.escape(searchPattern)}`),
                    true
                )
            );
        }
        where[Op.or] = searchClauses;
    }

    if (andClauses.length) {
        where[Op.and] = andClauses;
    }

    logger.debug('OrderService.getOrders: start', {
        userId,
        isAdmin,
        page,
        limit,
        hasSearch: Boolean(normalizedSearch),
        hasStatus: Boolean(normalizedStatus),
        hasShippingStatus: Boolean(normalizedShippingStatus),
        hasProductId: Boolean(productId),
    });

    let pagedIds = [];
    let totalCount = 0;
    try {
        [pagedIds, totalCount] = await Promise.all([
            Order.findAll({
                where,
                attributes: ['id'],
                limit: lmt,
                offset,
                order: [['createdAt', 'DESC']],
                raw: true,
            }),
            Order.count({
                where,
                distinct: true,
                col: 'id',
            }),
        ]);
    } catch (err) {
        logger.error('OrderService.getOrders: id/count query failed', {
            error: err.message,
            name: err.name,
            sql: err.sql,
            original: err.original?.message,
        });
        throw err;
    }

    const orderIds = pagedIds.map((row) => row.id);
    let rows = [];
    if (orderIds.length > 0) {
        try {
            rows = await Order.findAll({
                where: { id: { [Op.in]: orderIds } },
                include,
                order: [['createdAt', 'DESC']],
            });
        } catch (err) {
            logger.error('OrderService.getOrders: rows query failed', {
                error: err.message,
                name: err.name,
                sql: err.sql,
                original: err.original?.message,
            });
            throw err;
        }
    }

    let counts = {};
    if (isAdmin) {
        try {
            const countWhere = { ...where };
            delete countWhere.status;

            const statusCounts = await Order.findAll({
                where: countWhere,
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
        } catch (err) {
            logger.error('Order status counts query failed; continuing without counts', {
                error: err.message,
            });
            counts = {};
        }
    }

    return {
        rows,
        count: totalCount,
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
            await repairItemScopedPartialRefundPaymentStatus(lockedOrder, t);
        });
        order = await Order.findOne({ where, include: HEAVY_ORDER_INCLUDE });
    } else {
        await sequelize.transaction(async (t) => {
            const lockedOrder = await Order.findByPk(order.id, {
                transaction: t,
                lock: Transaction.LOCK.UPDATE,
            });
            await repairItemScopedPartialRefundPaymentStatus(lockedOrder, t);
        });
        order = await Order.findOne({ where, include: HEAVY_ORDER_INCLUDE });
    }
    return order;
};

const createFulfillment = async (orderId, payload, actingUserId, auditContext = null) => {
    // payload: { trackingNumber, courier, notes, status, items: [{ orderItemId, quantity }], providerId }
    const { trackingNumber, courier, expectedDeliveryDate, notes, status, items, providerId } = payload;
    const normalizedExpectedDeliveryDate = normalizeDateOnly(expectedDeliveryDate);

    if (!items || items.length === 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'At least one item is required for a shipment');
    }

    const fulfillment = await sequelize.transaction(async (t) => {
        // Lock the order row to prevent concurrent fulfillment races
        // We split this from item fetching because FOR UPDATE cannot be applied to outer joins in some DBs (e.g. Postgres)
        const order = await Order.findByPk(orderId, {
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });

        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
        assertExpectedDeliveryDateNotBeforeOrderDate(normalizedExpectedDeliveryDate, order.createdAt);

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
        if (order.paymentMethod === 'cod' && !isCodPaymentShippable(payment, order)) {
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
                isCombo:       Boolean(oi.isCombo),
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
            if (info.isCombo) continue;
            
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

            await InventoryService.shipDeduct({
                productId,
                variantId,
                qty,
                orderId,
                metadata: {
                    reason: 'shipment_created',
                },
                transaction: t,
            });
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
            expectedDeliveryDate: normalizedExpectedDeliveryDate,
            expectedDeliveryHistory: normalizedExpectedDeliveryDate
                ? appendExpectedDeliveryHistory([], normalizedExpectedDeliveryDate, actingUserId)
                : [],
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
        if (normalizedExpectedDeliveryDate) {
            await addOrderHistoryEvent({
                orderId,
                eventType: 'shipment_expected_delivery',
                description: `Expected delivery date set to ${normalizedExpectedDeliveryDate}.`,
                actorId: actingUserId,
                actorType: 'admin',
                metadata: { shipmentId: shipment.id, expectedDeliveryDate: normalizedExpectedDeliveryDate },
                transaction: t,
            });
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
                        expectedDeliveryDate: normalizedExpectedDeliveryDate,
                        shipmentId: shipment.id,
                        fulfillmentStatus: status || 'pending',
                        newOrderShippingStatus: newStatus,
                        method: auditContext?.method,
                        path: auditContext?.path,
                    },
                    ipAddress: auditContext?.ip,
                    userAgent: auditContext?.userAgent,
                });
            }
        } catch (err) {}

        fulfillment.setDataValue('shipments', [shipment]);
        return fulfillment;
    });

    const createdShipment = fulfillment.get('shipments')?.[0];
    await queueShipmentNotification(orderId, createdShipment?.status, createdShipment);
    return fulfillment;
};


const updateStatus = async (id, status, actingUserId, auditContext = null) => {
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
            fromStatus: beforeStatus,
            toStatus: status,
            changedBy: actingUserId,
            transaction: t,
        });

        await addOrderHistoryEvent({
            orderId: order.id,
            eventType: 'status_changed',
            description: `Order status changed from ${beforeStatus} to ${status}.`,
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
            if (payment && isPaymentSettled(payment.status, payment.provider)) {
                await createRefundRecord({
                    order,
                    payment,
                    reason: 'Order cancelled before shipment',
                    actingUserId,
                    metadata: { cancellationRefund: true },
                    transaction: t,
                });
            } else if (payment && ['payment_pending', 'pending_cod', 'pending'].includes(payment.status)) {
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
                    changes: { 
                        before: beforeStatus, 
                        after: status,
                        method: auditContext?.method,
                        path: auditContext?.path
                    },
                    ipAddress: auditContext?.ip,
                    userAgent: auditContext?.userAgent,
                });
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

    if (status === 'cancelled') {
        try {
            const user = await User.findByPk(orderRecord.userId, {
                include: [{ model: UserProfile, as: 'profile', required: false }],
            });
            if (user) {
                const variables = {
                    customer_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                    customer_email: user.email,
                    order_number: orderRecord.orderNumber,
                    order_id: orderRecord.id,
                    cancel_reason: 'Order cancelled by admin',
                    order_total: orderRecord.total,
                };
                await NotificationService.sendToUser('order_cancelled', ['email', 'sms', 'whatsapp'], user, variables, orderRecord.id);
                await NotificationService.sendToAdmins('admin_order_cancelled', ['email', 'sms', 'whatsapp'], variables, orderRecord.id);
            }
        } catch (err) {
            logger.error('Failed to queue admin cancellation notifications', { orderId: id, error: err.message });
        }
    }

    return orderRecord;
};

const refundOrder = async (id, actingUserId, isAdmin, auditContext = null) => {
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
                    changes: { 
                        orderId: id, 
                        status: 'refunded',
                        method: auditContext?.method,
                        path: auditContext?.path
                    },
                    ipAddress: auditContext?.ip,
                    userAgent: auditContext?.userAgent,
                });
            }
        } catch (err) {}

        return order.id;
    });

    const refundedOrder = await getOrderById(refundedOrderId, actingUserId, true);
    try {
        const user = await User.findByPk(refundedOrder.userId, {
            include: [{ model: UserProfile, as: 'profile', required: false }],
        });
        if (user) {
            await NotificationService.sendToUser(
                'order_refunded',
                ['email', 'sms', 'whatsapp'],
                user,
                {
                    customer_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                    order_number: refundedOrder.orderNumber,
                    order_id: refundedOrder.id,
                    refund_amount: refundedOrder.total,
                    order_total: refundedOrder.total,
                },
                refundedOrder.id
            );
        }
    } catch (err) {
        logger.error('Failed to queue refund notification', { orderId: refundedOrderId, error: err.message });
    }

    return refundedOrder;
};

const cancelOrder = async (id, userId) => {
    let orderRecord, prevStatus, eventsToEmit;

    await sequelize.transaction(async (t) => {
        const order = await Order.findOne({
            where: { id, userId },
            include: [{ model: OrderItem, as: 'items' }],
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });
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


        ensureValidOrderTransition(prevStatus, 'cancelled');
        eventsToEmit = await releaseOrderReservationsAndCoupons(order, t);

        await order.update({ status: 'cancelled' }, { transaction: t });
        await logOrderHistory({
            orderId: order.id,
            entityType: 'Order',
            entityId: order.id,
            statusGroup: 'order',
            fromStatus: prevStatus,
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
        } else if (payment && isPaymentSettled(payment.status, payment.provider)) {
            await createRefundRecord({
                order,
                payment,
                reason: 'Order cancelled before shipment',
                actingUserId: userId,
                metadata: { cancellationRefund: true, cancelledBy: 'customer' },
                transaction: t,
            });
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

    try {
        const user = await User.findByPk(userId, {
            include: [{ model: UserProfile, as: 'profile', required: false }],
        });
        if (user) {
            const variables = {
                customer_name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                customer_email: user.email,
                order_number: orderRecord.orderNumber,
                order_id: orderRecord.id,
                cancel_reason: 'Customer requested cancellation',
                order_total: orderRecord.total,
            };
            await NotificationService.sendToUser('order_cancelled', ['email', 'sms', 'whatsapp'], user, variables, orderRecord.id);
            await NotificationService.sendToAdmins('admin_order_cancelled', ['email', 'sms', 'whatsapp'], variables, orderRecord.id);
        }
    } catch (err) {
        logger.error('Failed to queue order cancellation notifications', { orderId: id, error: err.message });
    }

    return orderRecord;
};

const updateFulfillmentStatus = async (orderId, fulfillmentId, status, actingUserId, auditContext = null) => {
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
                    changes: { 
                        before: oldStatus, 
                        after: nextShipmentStatus, 
                        orderShippingStatus: derivedShippingStatus,
                        method: auditContext?.method,
                        path: auditContext?.path
                    },
                    ipAddress: auditContext?.ip,
                    userAgent: auditContext?.userAgent,
                });
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


const updateShipmentStatus = async (orderId, shipmentId, payload, actingUserId, auditContext = null) => {
    const { status, trackingNumber, trackingUrl, courierName, expectedDeliveryDate } = payload;
    let queuedStatus = null;
    let queuedShipment = null;

    await sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, { transaction: t, lock: Transaction.LOCK.UPDATE });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

        const shipment = await Shipment.findOne({
            where: { id: shipmentId, orderId },
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });
        if (!shipment) throw new AppError('NOT_FOUND', 404, 'Shipment not found');

        const latestShipmentStatus = Array.isArray(shipment.statusHistory) && shipment.statusHistory.length > 0
            ? shipment.statusHistory[shipment.statusHistory.length - 1]?.status
            : null;
        const before = latestShipmentStatus || shipment.status;
        if (status) ensureValidShipmentTransition(before, status);
        const history = Array.isArray(shipment.statusHistory) ? shipment.statusHistory : [];
        const expectedDeliveryChanged = expectedDeliveryDate !== undefined;
        const normalizedExpectedDeliveryDate = expectedDeliveryChanged
            ? normalizeDateOnly(expectedDeliveryDate)
            : null;
        const updates = {
            ...(trackingNumber !== undefined ? { trackingNumber, awb: trackingNumber } : {}),
            ...(trackingUrl !== undefined ? { trackingUrl } : {}),
            ...(courierName !== undefined ? { courierName } : {}),
        };
        if (expectedDeliveryChanged) {
            if (isShippingTerminal(before)) {
                throw new AppError(
                    'VALIDATION_ERROR',
                    400,
                    'Expected delivery date cannot be changed after the shipment is delivered or returned'
                );
            }
            if (!normalizedExpectedDeliveryDate) {
                throw new AppError('VALIDATION_ERROR', 400, 'Expected delivery date must be a valid date');
            }
            assertExpectedDeliveryDateNotBeforeOrderDate(normalizedExpectedDeliveryDate, order.createdAt);
            updates.expectedDeliveryDate = normalizedExpectedDeliveryDate;
            updates.expectedDeliveryHistory = appendExpectedDeliveryHistory(
                shipment.expectedDeliveryHistory,
                normalizedExpectedDeliveryDate,
                actingUserId
            );
        }
        const statusChanged = status && status !== before;
        if (statusChanged) {
            updates.status = status;
            updates.statusHistory = appendStatusHistoryEvent(history, status);
            queuedStatus = status;
        }
        await shipment.update(updates, { transaction: t });
        queuedShipment = shipment.get({ plain: true });

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
                metadata: { trackingNumber, trackingUrl, courierName, expectedDeliveryDate: normalizedExpectedDeliveryDate },
                transaction: t,
            });
        }

        if (expectedDeliveryChanged) {
            await addOrderHistoryEvent({
                orderId,
                eventType: 'shipment_expected_delivery',
                description: `Expected delivery date set to ${normalizedExpectedDeliveryDate}.`,
                actorId: actingUserId,
                actorType: 'admin',
                metadata: { shipmentId: shipment.id, expectedDeliveryDate: normalizedExpectedDeliveryDate },
                transaction: t,
            });
        }

        await syncOrderShippingStatus(order, t, actingUserId);
        await syncCodPaymentIfDelivered(order, t, actingUserId);
        await syncOrderClosureIfComplete(order, t, actingUserId);

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: 'STATUS_CHANGE',
                    entity: 'Shipment',
                    entityId: shipment.id,
                    changes: { 
                        before, 
                        after: status,
                        method: auditContext?.method,
                        path: auditContext?.path
                    },
                    ipAddress: auditContext?.ip,
                    userAgent: auditContext?.userAgent,
                });
            }
        } catch (err) {}
    });

    await queueShipmentNotification(orderId, queuedStatus, queuedShipment || {});

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
    const where = { orderId };
    if (type) where.type = type;
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

const createPutBackRequest = async (orderId, payload, actingUserId, isAdmin, type, auditContext = null) => {
    const defaultStatus = type === 'replacement' ? REPLACEMENT_DEFAULT_STATUS : RETURN_DEFAULT_STATUS;
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, { transaction: t, lock: Transaction.LOCK.UPDATE });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
        if (!isAdmin && order.userId !== actingUserId) throw new AppError('FORBIDDEN', 403, 'You cannot access this order');
        if (!Array.isArray(payload.items) || payload.items.length === 0) {
            throw new AppError('VALIDATION_ERROR', 400, 'At least one item is required');
        }

        const orderItems = await OrderItem.findAll({ where: { orderId }, transaction: t });
        const itemIds = new Set(orderItems.map((item) => item.id));
        const deliveredQty = await getDeliveredQuantityByOrderItem(orderId, t);
        const existingQty = await getActivePutBackQuantityByOrderItem(orderId, null, t);
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

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: 'CREATE',
                    entity: type === 'replacement' ? 'Replacement' : 'Return',
                    entityId: record.id,
                    changes: { 
                        orderId, 
                        type, 
                        reason: payload.reason,
                        method: auditContext?.method,
                        path: auditContext?.path
                    },
                    ipAddress: auditContext?.ip,
                    userAgent: auditContext?.userAgent,
                });
            }
        } catch (err) {}

        return OrderReturn.findByPk(record.id, {
            include: [{ model: OrderReturnItem, as: 'items' }],
            transaction: t,
        });
    });
};

const createReturnRequest = (orderId, payload, actingUserId, isAdmin = false, auditContext = null) => (
    createPutBackRequest(orderId, payload, actingUserId, isAdmin, 'return', auditContext)
);

const createReplacementRequest = (orderId, payload, actingUserId, isAdmin = false, auditContext = null) => (
    createPutBackRequest(orderId, payload, actingUserId, isAdmin, 'replacement', auditContext)
);

const updatePutBackStatus = async (orderId, returnId, status, actingUserId, isAdmin, auditContext = null) => {
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, { transaction: t, lock: Transaction.LOCK.UPDATE });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
        if (!isAdmin && order.userId !== actingUserId) throw new AppError('FORBIDDEN', 403, 'You cannot access this order');
        const record = await OrderReturn.findOne({
            where: { id: returnId, orderId },
            transaction: t,
            lock: Transaction.LOCK.UPDATE,
        });
        if (!record) throw new AppError('NOT_FOUND', 404, 'Return/replacement request not found');
        const before = normalizePutBackRecordStatus(record.status, record.type);
        const nextStatus = normalizePutBackRecordStatus(status, record.type);
        ensureValidStatusTransition('return', before, nextStatus);
        const updates = { status: nextStatus };
        if (nextStatus.endsWith('_approved')) updates.approvedAt = new Date();
        if (nextStatus.endsWith('_rejected')) updates.rejectedAt = new Date();
        if (nextStatus.endsWith('_completed')) updates.completedAt = new Date();
        await record.update(updates, { transaction: t });
        await logOrderHistory({
            orderId,
            entityType: record.type === 'replacement' ? 'Replacement' : 'Return',
            entityId: record.id,
            statusGroup: record.type,
            fromStatus: before,
            toStatus: nextStatus,
            changedBy: actingUserId,
            transaction: t,
        });
        await syncPutBackCache(order, t, actingUserId);

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: 'STATUS_CHANGE',
                    entity: record.type === 'replacement' ? 'Replacement' : 'Return',
                    entityId: record.id,
                    changes: { 
                        before, 
                        after: nextStatus,
                        method: auditContext?.method,
                        path: auditContext?.path
                    },
                    ipAddress: auditContext?.ip,
                    userAgent: auditContext?.userAgent,
                });
            }
        } catch (err) {}

        return OrderReturn.findByPk(record.id, {
            include: [{ model: OrderReturnItem, as: 'items' }],
            transaction: t,
        });
    });
};

const processRefund = async (orderId, payload, actingUserId, isAdmin, auditContext = null) => {
    if (!isAdmin) throw new AppError('FORBIDDEN', 403, 'You do not have permission to refund orders');
    return sequelize.transaction(async (t) => {
        const order = await Order.findByPk(orderId, { transaction: t, lock: Transaction.LOCK.UPDATE });
        if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');
        const payment = await Payment.findOne({ where: { orderId }, transaction: t, lock: Transaction.LOCK.UPDATE });
        if (!canRefundCapturedPayment(payment, order)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Cannot refund before payment has been captured');
        }
        let returnRequest = null;
        let refundAmount = payload.amount;
        if (payload.returnId) {
            returnRequest = await OrderReturn.findOne({
                where: { id: payload.returnId, orderId },
                include: [{
                    model: OrderReturnItem,
                    as: 'items',
                    include: [{
                        model: OrderItem,
                        as: 'orderItem',
                        attributes: ['id', 'quantity', 'total', 'snapshotName'],
                    }],
                }],
                transaction: t,
            });
            if (!returnRequest) throw new AppError('NOT_FOUND', 404, 'Return/replacement request not found');
            if (returnRequest.type !== 'return') {
                throw new AppError('VALIDATION_ERROR', 400, 'Refunds can be linked only to return requests');
            }
            const returnStatus = normalizePutBackRecordStatus(returnRequest.status, returnRequest.type);
            if (!['pickup_completed', 'return_completed'].includes(returnStatus)) {
                throw new AppError('VALIDATION_ERROR', 400, 'Cannot refund before pickup or return completion');
            }
            const returnItemAmount = getReturnRequestItemAmount(returnRequest);
            const returnRefundedAmount = await getRefundedAmountForReturn(returnRequest.id, t);
            const remainingReturnRefundable = money(Math.max(returnItemAmount - returnRefundedAmount, 0));
            if (remainingReturnRefundable <= 0) {
                throw new AppError('VALIDATION_ERROR', 400, 'This return request has already been fully refunded');
            }
            refundAmount = money(refundAmount ?? remainingReturnRefundable);
            if (refundAmount > remainingReturnRefundable) {
                throw new AppError('VALIDATION_ERROR', 400, `Refund amount cannot exceed returned product amount ${remainingReturnRefundable.toFixed(2)}`);
            }
        }
        const refund = await createRefundRecord({
            order,
            payment,
            amount: refundAmount,
            reason: payload.reason || (returnRequest ? 'Return refund' : 'Manual refund'),
            actingUserId,
            returnId: returnRequest?.id || null,
            refundScopeAmount: returnRequest ? getReturnRequestItemAmount(returnRequest) : null,
            metadata: {
                ...(payload.metadata || {}),
                providerRefundId: payload.providerRefundId || null,
                requestedStatus: payload.status || null,
                returnItemAmount: returnRequest ? getReturnRequestItemAmount(returnRequest) : null,
            },
            transaction: t,
        });
        await syncPutBackCache(order, t, actingUserId);

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: 'CREATE',
                    entity: 'OrderRefund',
                    entityId: refund.id,
                    changes: { 
                        orderId, 
                        amount: refund.amount, 
                        reason: payload.reason,
                        method: auditContext?.method,
                        path: auditContext?.path
                    },
                    ipAddress: auditContext?.ip,
                    userAgent: auditContext?.userAgent,
                });
            }
        } catch (err) {}

        return refund;
    });
};

const addNote = async (orderId, note, actorId, auditContext = null) => {
    const order = await Order.findByPk(orderId, { attributes: ['id'] });
    if (!order) throw new AppError('NOT_FOUND', 404, 'Order not found');

    const event = await addOrderHistoryEvent({
        orderId,
        eventType: 'admin_note',
        description: note,
        actorId,
        actorType: 'admin',
    });

    try {
        if (AuditService && AuditService.log) {
            await AuditService.log({
                userId: actorId,
                action: 'CREATE',
                entity: 'OrderNote',
                entityId: event.id,
                changes: { 
                    orderId, 
                    note,
                    method: auditContext?.method,
                    path: auditContext?.path
                },
                ipAddress: auditContext?.ip,
                userAgent: auditContext?.userAgent,
            });
        }
    } catch (err) {}

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
