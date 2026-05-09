'use strict';

const orderWorkflow = require('../../../shared/order-workflow.json');
const AppError = require('./AppError');

const unique = (values = []) => [...new Set(values.filter((value) => value !== undefined && value !== null))];
const statusGroup = (group) => Object.freeze([...(orderWorkflow.statuses?.[group] || [])]);
const transitionGroup = (group) => Object.freeze({ ...(orderWorkflow.transitions?.[group] || {}) });

const PAYMENT_STATUS_VALUES = statusGroup('payment');
const ORDER_STATUS_VALUES = statusGroup('order');
const SHIPMENT_STATUS_VALUES = statusGroup('shipment');
const ORDER_SHIPPING_STATUS_VALUES = statusGroup('order_shipping');
const RETURN_LIFECYCLE_STATUS_VALUES = Object.freeze(
    (orderWorkflow.statuses?.return || []).filter((status) => status.startsWith('return_'))
);
const REPLACEMENT_STATUS_VALUES = Object.freeze(
    (orderWorkflow.statuses?.return || []).filter((status) => status.startsWith('replacement_'))
);
const PUT_BACK_RECORD_STATUS_VALUES = Object.freeze([
    ...RETURN_LIFECYCLE_STATUS_VALUES,
    ...REPLACEMENT_STATUS_VALUES,
]);
const REFUND_STATUS_VALUES = statusGroup('refund');
const PUT_BACK_STATUS_VALUES = statusGroup('put_back');

const ORDER_DEFAULT_STATUS = orderWorkflow.transitions?.order?.default?.[0] || 'confirmed';
const PAYMENT_DEFAULT_STATUS = orderWorkflow.transitions?.payment?.default?.[0] || 'payment_pending';
const SHIPMENT_DEFAULT_STATUS = orderWorkflow.transitions?.shipment?.default?.[0] || 'created';
const RETURN_DEFAULT_STATUS = 'return_requested';
const REPLACEMENT_DEFAULT_STATUS = 'replacement_requested';
const REFUND_DEFAULT_STATUS = orderWorkflow.transitions?.refund?.default?.[0] || 'refund_initiated';
const ORDER_DEFAULT_SHIPPING_STATUS = 'not_shipped';

const TERMINAL_SHIPMENT_STATUSES = Object.freeze(['delivered', 'rto']);
const ACTIVE_PUT_BACK_STATUSES = Object.freeze(orderWorkflow.derived?.put_back_processing?.true_if_any || []);
const COMPLETED_PUT_BACK_STATUSES = Object.freeze(orderWorkflow.derived?.put_back_processing?.false_if_all || []);

const legacyOrderStatusMap = Object.freeze({
    pending_cod: 'confirmed',
    paid: 'processing',
    partially_shipped: 'processing',
    shipped: 'ready_for_shipment',
    delivered: 'closed',
    refunded: 'closed',
});

const legacyPaymentStatusMap = Object.freeze({
    pending: 'payment_pending',
    completed: 'paid_online',
    cod_collected: 'paid_cod',
    failed: 'payment_failed',
    refunded: 'paid_online',
});

const normalizeOrderStatus = (status) => legacyOrderStatusMap[status] || status || ORDER_DEFAULT_STATUS;
const normalizePaymentStatus = (status, provider) => {
    if (PAYMENT_STATUS_VALUES.includes(status)) return status;
    if (provider === 'cod' && status === 'pending') return 'pending_cod';
    return legacyPaymentStatusMap[status] || status || PAYMENT_DEFAULT_STATUS;
};

const getAllowedNextStatuses = (group, currentStatus) => {
    const transitions = transitionGroup(group);
    return transitions[currentStatus] || [];
};

const ensureStatusValue = (group, status) => {
    const values = statusGroup(group);
    if (!values.includes(status)) {
        throw new AppError('VALIDATION_ERROR', 400, `Invalid ${group} status: ${status}`);
    }
};

const ensureValidStatusTransition = (group, currentStatus, nextStatus) => {
    if (currentStatus === nextStatus) return;
    ensureStatusValue(group, nextStatus);
    const allowedStatuses = getAllowedNextStatuses(group, currentStatus);
    if (!allowedStatuses.includes(nextStatus)) {
        throw new AppError(
            'VALIDATION_ERROR',
            400,
            `Cannot change ${group} status from ${currentStatus} to ${nextStatus}`
        );
    }
};

const shipmentRank = Object.freeze({
    created: 0,
    packed: 0,
    shipped: 1,
    in_transit: 1,
    out_for_delivery: 2,
    delivered: 3,
    delivery_failed: 4,
    rto_initiated: 5,
    rto_in_transit: 5,
    rto: 6,
});

const deriveOrderShippingStatus = (shipments = []) => {
    const statuses = shipments.map((shipment) => shipment.status || shipment).filter(Boolean);
    if (statuses.length === 0) return ORDER_DEFAULT_SHIPPING_STATUS;

    const all = (set) => statuses.every((status) => set.includes(status));
    const any = (set) => statuses.some((status) => set.includes(status));
    const some = (set) => any(set) && !all(set);
    const hasUnadvanced = statuses.some((status) => shipmentRank[status] < 1);
    const hasPreTerminal = statuses.some((status) => !TERMINAL_SHIPMENT_STATUSES.includes(status));

    if (all(['rto'])) return 'rto';
    if (any(['rto_initiated', 'rto_in_transit'])) return 'rto_initiated';
    if (some(['rto']) && hasPreTerminal) return 'partially_rto';
    if (any(['delivery_failed'])) return 'delivery_failed';
    if (all(['delivered'])) return 'delivered';
    if (some(['delivered'])) return 'partially_delivered';
    if (all(['out_for_delivery'])) return 'out_for_delivery';
    if (some(['out_for_delivery'])) return 'partially_out_for_delivery';
    if (all(['shipped', 'in_transit'])) return 'shipped';
    if (any(['shipped', 'in_transit']) || (any(['packed']) && hasUnadvanced)) return 'partially_shipped';
    return 'not_shipped';
};

const buildQuantityMap = (rows = [], key = 'orderItemId') => rows.reduce((map, row) => {
    const rowKey = row[key];
    if (!rowKey) return map;
    map[rowKey] = (map[rowKey] || 0) + Number(row.quantity || 0);
    return map;
}, {});

const derivePutBackCache = ({ orderItems = [], putBacks = [] }) => {
    const totalQuantity = orderItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const activeRecords = putBacks.filter((record) => ACTIVE_PUT_BACK_STATUSES.includes(record.status));
    const completedRecords = putBacks.filter((record) => COMPLETED_PUT_BACK_STATUSES.includes(record.status));
    const completedReturnItems = completedRecords
        .filter((record) => record.type === 'return')
        .flatMap((record) => record.items || []);
    const completedReplacementItems = completedRecords
        .filter((record) => record.type === 'replacement')
        .flatMap((record) => record.items || []);
    const returnedQty = Object.values(buildQuantityMap(completedReturnItems)).reduce((sum, qty) => sum + qty, 0);
    const replacedQty = Object.values(buildQuantityMap(completedReplacementItems)).reduce((sum, qty) => sum + qty, 0);

    let putBackStatus = null;
    if (totalQuantity > 0 && returnedQty >= totalQuantity) putBackStatus = 'full_return';
    else if (totalQuantity > 0 && replacedQty >= totalQuantity) putBackStatus = 'full_replacement';
    else if (returnedQty > 0) putBackStatus = 'partial_return';
    else if (replacedQty > 0) putBackStatus = 'partial_replacement';

    return {
        putBackStatus,
        putBackProcessingStatus: activeRecords.length > 0,
    };
};

const isCustomerCancelableOrderStatus = (status) => ['confirmed', 'on_hold', 'processing'].includes(normalizeOrderStatus(status));
const isRefundableOrderStatus = (status) => ['closed', 'processing', 'ready_for_shipment'].includes(normalizeOrderStatus(status));
const isFulfillableOrderStatus = (status) => ['processing', 'ready_for_shipment'].includes(normalizeOrderStatus(status));

const getAllowedOrderStatuses = (status) => getAllowedNextStatuses('order', normalizeOrderStatus(status));

const isPaymentSettled = (status, provider) => ['paid_online', 'paid_cod'].includes(normalizePaymentStatus(status, provider));
const isShippingTerminal = (status) => ['delivered', 'rto'].includes(status);
const canCloseOrder = ({ order, payment, orderShippingStatus }) => {
    const paymentStatus = payment?.status || order?.paymentStatus;
    const paymentProvider = payment?.provider || order?.paymentMethod;
    return isPaymentSettled(paymentStatus, paymentProvider) && isShippingTerminal(orderShippingStatus || order?.orderShippingStatus);
};

module.exports = {
    ORDER_WORKFLOW: Object.freeze(orderWorkflow),
    PAYMENT_STATUS_VALUES,
    ORDER_STATUS_VALUES,
    SHIPMENT_STATUS_VALUES,
    ORDER_SHIPPING_STATUS_VALUES,
    RETURN_LIFECYCLE_STATUS_VALUES,
    REPLACEMENT_STATUS_VALUES,
    PUT_BACK_RECORD_STATUS_VALUES,
    REFUND_STATUS_VALUES,
    PUT_BACK_STATUS_VALUES,
    ORDER_DEFAULT_STATUS,
    PAYMENT_DEFAULT_STATUS,
    SHIPMENT_DEFAULT_STATUS,
    RETURN_DEFAULT_STATUS,
    REPLACEMENT_DEFAULT_STATUS,
    REFUND_DEFAULT_STATUS,
    ORDER_DEFAULT_SHIPPING_STATUS,
    normalizeOrderStatus,
    normalizePaymentStatus,
    getAllowedNextStatuses,
    getAllowedOrderStatuses,
    ensureStatusValue,
    ensureValidStatusTransition,
    deriveOrderShippingStatus,
    derivePutBackCache,
    isPaymentSettled,
    isShippingTerminal,
    canCloseOrder,
    isRefundableOrderStatus,
    isCustomerCancelableOrderStatus,
    isFulfillableOrderStatus,
};
