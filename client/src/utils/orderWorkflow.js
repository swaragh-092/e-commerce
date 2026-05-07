import orderWorkflow from '../../../shared/order-workflow.json';

const fallbackLabel = (status) =>
  String(status || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const colorMap = {
  confirmed: 'info',
  on_hold: 'warning',
  processing: 'primary',
  ready_for_shipment: 'secondary',
  cancelled: 'error',
  closed: 'success',
  payment_pending: 'warning',
  pending_cod: 'warning',
  payment_failed: 'error',
  payment_expired: 'error',
  paid_cod: 'success',
  paid_online: 'success',
  not_shipped: 'default',
  partially_shipped: 'info',
  shipped: 'primary',
  partially_out_for_delivery: 'warning',
  out_for_delivery: 'warning',
  partially_delivered: 'success',
  delivered: 'success',
  delivery_failed: 'error',
  partially_rto: 'error',
  rto_initiated: 'error',
  rto: 'error',
  return_requested: 'warning',
  return_approved: 'info',
  return_rejected: 'error',
  pickup_scheduled: 'secondary',
  pickup_completed: 'primary',
  return_completed: 'success',
  replacement_requested: 'warning',
  replacement_approved: 'info',
  replacement_rejected: 'error',
  replacement_processing: 'primary',
  replacement_shipped: 'secondary',
  replacement_delivered: 'success',
  replacement_completed: 'success',
  refund_initiated: 'warning',
  refund_processing: 'primary',
  refund_failed: 'error',
  refunded: 'success',
  partially_refunded: 'info',
};

const statuses = orderWorkflow.statuses || {};
const transitions = orderWorkflow.transitions || {};

export const ORDER_WORKFLOW = Object.freeze(orderWorkflow);
export const ORDER_STATUS_OPTIONS = Object.freeze(statuses.order || []);
export const PAYMENT_STATUS_OPTIONS = Object.freeze(statuses.payment || []);
export const SHIPMENT_STATUS_OPTIONS = Object.freeze(statuses.shipment || []);
export const ORDER_SHIPPING_STATUS_OPTIONS = Object.freeze(statuses.order_shipping || []);
export const RETURN_STATUS_OPTIONS = Object.freeze((statuses.return || []).filter((status) => status.startsWith('return_')));
export const REPLACEMENT_STATUS_OPTIONS = Object.freeze((statuses.return || []).filter((status) => status.startsWith('replacement_')));
export const REFUND_STATUS_OPTIONS = Object.freeze(statuses.refund || []);
export const ORDER_STATUS_DEFAULT = transitions.order?.default?.[0] || 'confirmed';
export const ORDER_STATUS_STEPPER = ORDER_STATUS_OPTIONS;
export const ORDER_TERMINAL_STATUSES = Object.freeze(['cancelled', 'closed']);
export const ORDER_FULFILLMENT_STEPPER = Object.freeze(['not_shipped', 'partially_shipped', 'shipped', 'out_for_delivery', 'delivered']);
export const ORDER_STATUS_SUMMARY_GROUPS = Object.freeze([
  { key: 'active', label: 'Active', statuses: ['confirmed', 'on_hold', 'processing', 'ready_for_shipment'] },
  { key: 'issues', label: 'Needs attention', statuses: ['cancelled'] },
  { key: 'closed', label: 'Closed', statuses: ['closed'] },
]);

export const getOrderStatusMeta = (status) => ({
  key: status,
  label: fallbackLabel(status),
  muiColor: colorMap[status] || 'default',
});

export const getOrderStatusLabel = (status) => fallbackLabel(status);
export const getOrderStatusColor = (status) => colorMap[status] || 'default';

export const getAllowedOrderStatuses = (status) => {
  if (!status) return ORDER_STATUS_OPTIONS;
  return [status, ...(transitions.order?.[status] || [])];
};

export const isOrderRefundableStatus = (status) =>
  ['processing', 'ready_for_shipment', 'closed'].includes(status);

export const isOrderCustomerCancelableStatus = (status) =>
  ['confirmed', 'on_hold', 'processing'].includes(status);

export const isOrderFulfillableStatus = (status) =>
  ['processing', 'ready_for_shipment'].includes(status);

export const countOrdersByStatuses = (orders = [], selectedStatuses = []) =>
  orders.filter((order) => selectedStatuses.includes(order?.status)).length;

export const getPaymentStatusLabel = (status) => fallbackLabel(status || 'payment_pending');
export const getPaymentStatusColor = (status) => colorMap[status] || 'default';
export const getShipmentStatusLabel = (status) => fallbackLabel(status || 'not_shipped');
export const getShipmentStatusColor = (status) => colorMap[status] || 'default';
export const getReturnStatusLabel = (status) => fallbackLabel(status);
export const getReturnStatusColor = (status) => colorMap[status] || 'default';
export const getRefundStatusLabel = (status) => fallbackLabel(status);
export const getRefundStatusColor = (status) => colorMap[status] || 'default';

export const getOrderProgressSteps = (order = {}, progress = {}) => {
  const orderStatus = order?.status;
  const shippingStatus = order?.orderShippingStatus || order?.shipmentStatus || 'not_shipped';
  const paymentStatus = order?.Payment?.status || order?.paymentStatus;
  const isCancelled = orderStatus === 'cancelled';
  const isClosed = orderStatus === 'closed';
  const paymentSettled = ['paid_online', 'paid_cod', 'completed', 'cod_collected'].includes(paymentStatus);
  const shipped = ['partially_shipped', 'shipped', 'partially_out_for_delivery', 'out_for_delivery', 'partially_delivered', 'delivered'].includes(shippingStatus);
  const outForDelivery = ['partially_out_for_delivery', 'out_for_delivery', 'partially_delivered', 'delivered'].includes(shippingStatus);
  const delivered = shippingStatus === 'delivered';

  const steps = [
    { key: 'placed', label: 'Order placed', status: 'completed', occurredAt: order?.createdAt },
    { key: 'payment', label: getPaymentStatusLabel(paymentStatus), status: paymentSettled ? 'completed' : 'active' },
    { key: 'processing', label: 'Processing', status: ['processing', 'ready_for_shipment', 'closed'].includes(orderStatus) ? 'completed' : 'pending' },
    { key: 'shipped', label: getShipmentStatusLabel(shippingStatus), status: shipped ? 'completed' : 'pending' },
    { key: 'out_for_delivery', label: 'Out for delivery', status: outForDelivery ? 'completed' : 'pending' },
    { key: 'delivered', label: 'Delivered', status: delivered ? 'completed' : 'pending' },
  ];

  if (isCancelled || isClosed) {
    return [
      ...steps.filter((step) => step.status === 'completed' || step.key === 'placed'),
      {
        key: orderStatus,
        label: isCancelled ? 'Cancelled' : 'Closed',
        status: 'terminal',
        occurredAt: order?.updatedAt,
      },
    ];
  }

  return steps;
};
