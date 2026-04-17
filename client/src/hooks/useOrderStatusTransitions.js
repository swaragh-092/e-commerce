import { useMemo } from 'react';
import orderWorkflow from '../../../shared/order-workflow.json';

export const useOrderStatusTransitions = (currentStatus) => {
  return useMemo(() => {
    if (!currentStatus) return { allowedNextStatuses: [], isRefundable: false, isCancelable: false, isFulfillable: false, allStatuses: orderWorkflow.statuses || [] };
    
    const allowedNextStatuses = orderWorkflow.transitions[currentStatus] || [];
    const isRefundable = (orderWorkflow.adminRefundableStatuses || []).includes(currentStatus);
    const isCancelable = (orderWorkflow.customerCancelableStatuses || []).includes(currentStatus);
    const isFulfillable = (orderWorkflow.adminFulfillableStatuses || []).includes(currentStatus);

    return {
      allowedNextStatuses,
      isRefundable,
      isCancelable,
      isFulfillable,
      allStatuses: orderWorkflow.statuses || []
    };
  }, [currentStatus]);
};

export default useOrderStatusTransitions;
