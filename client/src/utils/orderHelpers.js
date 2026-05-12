import { PAYMENT_SETTLED_STATUSES } from './constants';

/**
 * Build a compact product summary from order items.
 * Handles both `items` (new backend alias) and `OrderItems` (legacy).
 */
export const getProductSummary = (order, maxNames = 2) => {
    const items = order.items || order.OrderItems || [];
    if (!items.length) return { summary: 'No items', count: 0, qty: 0 };

    const names = items
        .map((i) => i.Product?.name || i.product?.name || null)
        .filter(Boolean);

    const totalQty = items.reduce((s, i) => s + (i.quantity || 1), 0);
    const shown = names.slice(0, maxNames);
    const extra = names.length - shown.length;

    return {
        summary: shown.join(', ') + (extra > 0 ? ` +${extra} more` : ''),
        count: items.length,
        qty: totalQty,
    };
};

export const formatOrderDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
    });

export const getCustomerOrderDisplayStatus = (order = {}) => {
    const orderStatus = order.status;
    // Legacy fallback: older orders may only have shipmentStatus. Remove once migration is confirmed.
    const shippingStatus = order.orderShippingStatus || order.shipmentStatus || 'not_shipped';
    const paymentStatus = order.Payment?.status || order.paymentStatus;
    const paymentSettled = PAYMENT_SETTLED_STATUSES.includes(paymentStatus);

    if (orderStatus === 'cancelled') return 'cancelled';
    if (orderStatus === 'pending_payment') return 'pending_payment';
    if (['delivered', 'partially_delivered'].includes(shippingStatus)) return 'delivered';
    if (['rto', 'partially_rto', 'rto_initiated'].includes(shippingStatus)) return 'rto';
    if (orderStatus === 'closed') return 'delivered';
    if (['out_for_delivery', 'partially_out_for_delivery'].includes(shippingStatus)) return 'out_for_delivery';
    if (['shipped', 'partially_shipped', 'in_transit'].includes(shippingStatus)) return 'shipped';
    if (['created', 'packed'].includes(shippingStatus)) return shippingStatus;
    if (paymentSettled || ['confirmed', 'processing', 'ready_for_shipment'].includes(orderStatus)) return 'processing';
    return 'placed';
};

export const getCustomerOrderStatusLabel = (status) => ({
    pending_payment: 'Pending Payment',
    placed: 'Placed',
    processing: 'Processing',
    packed: 'Packed',
    shipped: 'Shipped',
    out_for_delivery: 'Out For Delivery',
    delivered: 'Delivered',
    rto: 'Returned to Origin',
    cancelled: 'Cancelled',
}[status] || 'Placed');
