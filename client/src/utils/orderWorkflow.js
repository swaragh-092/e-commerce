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

export const countOrdersByStatuses = (orders = [], statuses = []) =>
  orders.filter((order) => statuses.includes(order?.status)).length;