import orderWorkflow from '../../../shared/order-workflow.json';

const FALLBACK_STATUS_COLOR = 'default';
const fallbackLabel = (status) =>
  String(status || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const statusMetaByKey = Object.freeze(
  Object.fromEntries((orderWorkflow.statuses || []).map((status) => [status.key, status]))
);

export const ORDER_WORKFLOW = Object.freeze(orderWorkflow);
export const ORDER_STATUS_OPTIONS = Object.freeze((orderWorkflow.statuses || []).map((status) => status.key));
export const ORDER_STATUS_DEFAULT = orderWorkflow.defaultStatus;
export const ORDER_STATUS_STEPPER = ORDER_STATUS_OPTIONS;
export const ORDER_TERMINAL_STATUSES = Object.freeze(['cancelled', 'refunded']);
export const ORDER_FULFILLMENT_STEPPER = Object.freeze(['processing', 'partially_shipped', 'shipped', 'delivered']);
export const ORDER_STATUS_SUMMARY_GROUPS = Object.freeze(orderWorkflow.adminSummaryGroups || []);

export const getOrderStatusMeta = (status) => statusMetaByKey[status] || null;

export const getOrderStatusLabel = (status) => getOrderStatusMeta(status)?.label || fallbackLabel(status);

export const getOrderStatusColor = (status) => getOrderStatusMeta(status)?.muiColor || FALLBACK_STATUS_COLOR;

export const getAllowedOrderStatuses = (status) => {
  if (!status) {
    return ORDER_STATUS_OPTIONS;
  }

  const transitions = orderWorkflow.transitions?.[status] || [];
  return [status, ...transitions];
};

export const isOrderRefundableStatus = (status) =>
  (orderWorkflow.adminRefundableStatuses || []).includes(status);

export const isOrderCustomerCancelableStatus = (status) =>
  (orderWorkflow.customerCancelableStatuses || []).includes(status);

export const isOrderFulfillableStatus = (status) =>
  (orderWorkflow.adminFulfillableStatuses || []).includes(status);

export const countOrdersByStatuses = (orders = [], statuses = []) =>
  orders.filter((order) => statuses.includes(order?.status)).length;

export const getPaymentStatusLabel = (status) => {
  const labels = {
    pending: 'Pending',
    completed: 'Captured',
    cod_collected: 'COD Collected',
    failed: 'Failed',
    refunded: 'Refunded',
  };

  return labels[status] || fallbackLabel(status || 'not_captured');
};

export const getPaymentStatusColor = (status) => {
  const colors = {
    pending: 'warning',
    completed: 'success',
    cod_collected: 'success',
    failed: 'error',
    refunded: 'default',
  };

  return colors[status] || 'default';
};

export const getOrderProgressSteps = (order = {}, progress = {}) => {
  const status = order?.status;
  const paymentMethod = order?.paymentMethod;
  const paymentStatus = order?.Payment?.status || order?.paymentStatus;
  const isCod = paymentMethod === 'cod';
  const isCancelled = status === 'cancelled';
  const isRefunded = status === 'refunded' || paymentStatus === 'refunded';
  const isPaymentSettled = ['paid', 'processing', 'partially_shipped', 'shipped', 'delivered', 'refunded'].includes(status)
    || ['completed', 'cod_collected', 'refunded'].includes(paymentStatus);
  const fulfilledQuantity = Number(progress?.fulfilledQuantity ?? progress?.shipped ?? 0);
  const remainingQuantity = Number(progress?.remainingQuantity ?? progress?.remaining ?? 0);
  const isFullyFulfilled = status === 'delivered' || (fulfilledQuantity > 0 && remainingQuantity === 0);

  const steps = [
    {
      key: 'placed',
      label: 'Order placed',
      status: 'completed',
      occurredAt: order?.createdAt,
    },
    {
      key: isCod ? 'pending_cod' : 'pending_payment',
      label: isCod ? 'Pending COD' : 'Pending payment',
      status: isPaymentSettled || ['pending_cod', 'processing'].includes(status) ? 'completed' : 'active',
    },
    {
      key: 'paid',
      label: isCod ? 'COD collected' : 'Payment captured',
      status: isPaymentSettled ? 'completed' : 'pending',
    },
    {
      key: 'processing',
      label: 'Processing',
      status: ['processing', 'partially_shipped', 'shipped', 'delivered'].includes(status) ? 'completed' : 'pending',
    },
    {
      key: 'shipped',
      label: remainingQuantity > 0 && fulfilledQuantity > 0 ? 'Partially shipped' : 'Shipped',
      status: fulfilledQuantity > 0 ? (isFullyFulfilled ? 'completed' : 'active') : 'pending',
    },
    {
      key: 'delivered',
      label: 'Delivered',
      status: status === 'delivered' ? 'completed' : 'pending',
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
        key: status,
        label: isRefunded ? 'Refunded' : 'Cancelled',
        status: 'terminal',
        occurredAt: order?.updatedAt,
      },
    ];
  }

  return steps;
};
