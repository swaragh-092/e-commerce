'use strict';

const orderWorkflow = require('../../../shared/order-workflow.json');
const AppError = require('./AppError');

const ORDER_STATUS_VALUES = Object.freeze((orderWorkflow.statuses || []).map((status) => status.key));
const ORDER_STATUS_TRANSITIONS = Object.freeze(orderWorkflow.transitions || {});
const ORDER_DEFAULT_STATUS = orderWorkflow.defaultStatus;
const CUSTOMER_CANCELABLE_ORDER_STATUSES = Object.freeze(orderWorkflow.customerCancelableStatuses || []);
const ADMIN_REFUNDABLE_ORDER_STATUSES = Object.freeze(orderWorkflow.adminRefundableStatuses || []);
const ADMIN_FULFILLABLE_ORDER_STATUSES = Object.freeze(orderWorkflow.adminFulfillableStatuses || []);

const getAllowedNextStatuses = (currentStatus) => ORDER_STATUS_TRANSITIONS[currentStatus] || [];

const isRefundableOrderStatus = (status) => ADMIN_REFUNDABLE_ORDER_STATUSES.includes(status);

const isCustomerCancelableOrderStatus = (status) => CUSTOMER_CANCELABLE_ORDER_STATUSES.includes(status);

const isFulfillableOrderStatus = (status) => ADMIN_FULFILLABLE_ORDER_STATUSES.includes(status);

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

module.exports = {
  ORDER_WORKFLOW: Object.freeze(orderWorkflow),
  ORDER_STATUS_VALUES,
  ORDER_STATUS_TRANSITIONS,
  ORDER_DEFAULT_STATUS,
  CUSTOMER_CANCELABLE_ORDER_STATUSES,
  ADMIN_REFUNDABLE_ORDER_STATUSES,
  getAllowedNextStatuses,
  isRefundableOrderStatus,
  isCustomerCancelableOrderStatus,
  isFulfillableOrderStatus,
  ensureValidStatusTransition,
};