import { useMemo } from 'react';
import orderWorkflow from '../../../shared/order-workflow.json';

export const useOrderStatusTransitions = (currentStatus) => {
  return useMemo(() => {
    const orderStatuses = orderWorkflow.statuses?.order || [];
    const transitions = orderWorkflow.transitions?.order || {};
    const rules = orderWorkflow.rules || {};
    const normalizedStatus = ({
      pending_payment: 'confirmed',
      pending_cod: 'confirmed',
      paid: 'processing',
      partially_shipped: 'processing',
      shipped: 'ready_for_shipment',
      delivered: 'closed',
      refunded: 'closed',
    })[currentStatus] || currentStatus;

    if (!normalizedStatus) {
      return {
        allowedNextStatuses: [],
        isRefundable: false,
        isCancelable: false,
        isFulfillable: false,
        allStatuses: orderStatuses,
      };
    }
    
    const allowedNextStatuses = transitions[normalizedStatus] || [];
    const isRefundable = ['processing', 'ready_for_shipment', 'closed'].includes(normalizedStatus);
    const isCancelable = (rules.cancel_allowed?.order_status || ['confirmed', 'on_hold', 'processing']).includes(normalizedStatus);
    const isFulfillable = (rules.can_create_shipment?.order_status || ['processing', 'ready_for_shipment']).includes(normalizedStatus);

    return {
      allowedNextStatuses,
      isRefundable,
      isCancelable,
      isFulfillable,
      allStatuses: orderStatuses,
    };
  }, [currentStatus]);
};

export default useOrderStatusTransitions;
