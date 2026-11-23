export const isOrderShippingRequired = (order = {}) => {
  if (order.shippingAddressSnapshot?.digital === true) return false;
  const items = order.items || order.OrderItems || [];
  return items.length === 0 || items.some((item) => item.requiresShipping !== false && item.product?.requiresShipping !== false);
};

export const getFulfillmentProgress = (items = [], fulfillments = []) => {
  const shippingItems = items.filter((item) => item.requiresShipping !== false && item.product?.requiresShipping !== false);
  const total = shippingItems.reduce((sum, item) => sum + Math.max(Number(item.quantity) || 0, 0), 0);
  const deliveredByItem = fulfillments.filter((row) => row.status === 'delivered')
    .flatMap((row) => row.items || []).reduce((result, item) => {
      const id = item.orderItemId || item.orderItem?.id;
      if (id) result[id] = (result[id] || 0) + Math.max(Number(item.quantity) || 0, 0);
      return result;
    }, {});
  const shipped = shippingItems.reduce((sum, item) => sum + Math.min(deliveredByItem[item.id] || 0, Math.max(Number(item.quantity) || 0, 0)), 0);
  return { total, shipped, remaining: Math.max(total - shipped, 0) };
};

export const getOrderDataWarnings = (order, progress) => {
  const shipping = order.orderShippingStatus ?? order.shipmentStatus;
  const warnings = [];
  if (!isOrderShippingRequired(order)) return warnings;
  if (order.status === 'cancelled' && ['delivered', 'partially_delivered'].includes(shipping)) {
    warnings.push(`This cancelled order has a ${shipping.replaceAll('_', ' ')} delivery status. Review shipment and order history before taking action.`);
  }
  if (shipping === 'delivered' && progress.total > 0 && progress.shipped < progress.total) {
    warnings.push('Delivery status is delivered, but item-level fulfillment records do not confirm delivery of every item.');
  }
  return warnings;
};
