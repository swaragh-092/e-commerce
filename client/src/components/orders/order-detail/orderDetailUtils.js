import { getMediaUrl } from '../../../utils/media';
import {
  getShipmentStatusColor,
  getShipmentStatusLabel,
} from '../../../utils/orderWorkflow';
import { PAYMENT_SETTLED_STATUSES } from '../../../utils/constants';
export {
  formatCompactDateTime,
  formatDateOnly,
  formatDateTime,
} from '../../../utils/dates';

export const PRODUCT_TRACKING_STEPS = [
  { key: 'placed', label: 'Placed' },
  { key: 'payment', label: 'Payment' },
  { key: 'processing', label: 'Processing' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out' },
  { key: 'delivered', label: 'Delivered' },
];

const SHIPMENT_STATUS_RANK = {
  pending: 1,
  awaiting_dispatch: 1,
  created: 2,
  packed: 3,
  shipped: 4,
  in_transit: 4,
  out_for_delivery: 5,
  delivered: 6,
  delivery_failed: 5,
  rto_initiated: 5,
  rto: 6,
  cancelled: 6,
  returned: 6,
};

const PRODUCT_STATUS_META = {
  pending: { label: 'Preparing', color: 'warning', step: 'processing' },
  awaiting_dispatch: { label: 'Preparing', color: 'warning', step: 'processing' },
  created: { label: 'Processing', color: 'primary', step: 'processing' },
  processing: { label: 'Processing', color: 'primary', step: 'processing' },
  packed: { label: 'Packed', color: 'secondary', step: 'packed' },
  shipped: { label: 'Shipped', color: 'primary', step: 'shipped' },
  in_transit: { label: 'In transit', color: 'primary', step: 'shipped' },
  out_for_delivery: { label: 'Out for delivery', color: 'warning', step: 'out_for_delivery' },
  partially_delivered: { label: 'Partially delivered', color: 'warning', step: 'delivered' },
  delivered: { label: 'Delivered', color: 'success', step: 'delivered' },
  partially_refunded: { label: 'Partially refunded', color: 'info', step: 'delivered' },
  refunded: { label: 'Refunded', color: 'success', step: 'delivered' },
  delivery_failed: { label: 'Delivery issue', color: 'error', step: 'out_for_delivery' },
  rto_initiated: { label: 'Returning', color: 'error', step: 'out_for_delivery' },
  rto: { label: 'Returned', color: 'error', step: 'delivered' },
  cancelled: { label: 'Cancelled', color: 'error', step: 'processing' },
  returned: { label: 'Returned', color: 'error', step: 'delivered' },
};

export const getTaxRows = (order = {}) => {
  const breakdown = order.taxBreakdown || {};
  const rates = breakdown.components?.[0]?.rates || {};
  const rows = [
    { label: rates.cgst ? `CGST @ ${rates.cgst}%` : 'CGST', value: breakdown.cgst },
    { label: rates.sgst ? `SGST @ ${rates.sgst}%` : 'SGST', value: breakdown.sgst },
    { label: rates.igst ? `IGST @ ${rates.igst}%` : 'IGST', value: breakdown.igst },
    { label: 'Tax', value: breakdown.flatTax },
  ].filter((row) => Number(row.value || 0) > 0);

  if (rows.length > 0) return rows;
  return Number(order.tax || 0) > 0 ? [{ label: 'Tax', value: order.tax }] : [];
};

const normalizeShipmentStatus = (status) => {
  if (!status || status === 'pending') return 'created';
  return status;
};

const getProductImageUrl = (item = {}) => {
  const rawImage =
    item.snapshotImage ||
    item.product?.images?.find?.((image) => image.isPrimary)?.url ||
    item.product?.images?.[0]?.url ||
    item.Product?.images?.find?.((image) => image.isPrimary)?.url ||
    item.Product?.images?.[0]?.url ||
    '';
  return getMediaUrl(rawImage);
};

const getProductUrl = (item = {}) => {
  const slug = item.product?.slug || item.Product?.slug;
  return slug ? `/products/${slug}` : '';
};

const findFulfillmentItem = (fulfillment = {}, item = {}) =>
  (fulfillment.items || fulfillment.FulfillmentItems || []).find((fulfillmentItem) => {
    const linkedOrderItemId =
      fulfillmentItem.orderItemId ||
      fulfillmentItem.orderItem?.id ||
      fulfillmentItem.OrderItem?.id;
    return linkedOrderItemId === item.id;
  });

const getShipmentHistory = (fulfillment = {}) => {
  const shipment = fulfillment.shipment || fulfillment.Shipment || fulfillment.shipments?.[0] || {};
  return Array.isArray(shipment.statusHistory) ? shipment.statusHistory : [];
};

const getShipmentCarrier = (fulfillment = {}) => {
  const shipment = fulfillment.shipment || fulfillment.Shipment || fulfillment.shipments?.[0] || {};
  return (
    fulfillment.courier ||
    fulfillment.shippingProvider?.name ||
    fulfillment.provider?.name ||
    shipment.courier ||
    shipment.carrier ||
    shipment.provider?.name ||
    shipment.providerName ||
    'Standard shipping'
  );
};

const getShipmentTrackingNumber = (fulfillment = {}) => {
  const shipment = fulfillment.shipment || fulfillment.Shipment || fulfillment.shipments?.[0] || {};
  return fulfillment.trackingNumber || shipment.trackingNumber || shipment.awbNumber || shipment.awb || '';
};

const getShipmentTrackingUrl = (fulfillment = {}) => {
  const shipment = fulfillment.shipment || fulfillment.Shipment || fulfillment.shipments?.[0] || {};
  return fulfillment.trackingUrl || shipment.trackingUrl || shipment.labelUrl || '';
};

const getShipmentExpectedDeliveryDate = (fulfillment = {}) => {
  const shipment = fulfillment.shipment || fulfillment.Shipment || fulfillment.shipments?.[0] || {};
  return shipment.expectedDeliveryDate || fulfillment.estimatedDeliveryDate || fulfillment.deliveryEstimate || '';
};

const getShipmentExpectedDeliveryHistory = (fulfillment = {}) => {
  const shipment = fulfillment.shipment || fulfillment.Shipment || fulfillment.shipments?.[0] || {};
  return Array.isArray(shipment.expectedDeliveryHistory) ? shipment.expectedDeliveryHistory : [];
};

const getStatusTime = (history = [], statuses = []) => {
  const statusSet = new Set(statuses);
  const event = [...history]
    .reverse()
    .find((historyEvent) => statusSet.has(historyEvent.status || historyEvent.toStatus));
  return event?.createdAt || event?.timestamp || event?.at || '';
};

const getLatestHistoryTime = (history = []) => {
  const latest = [...history].reverse().find(Boolean);
  return latest?.createdAt || latest?.timestamp || latest?.at || '';
};

export const buildProductTrackingItems = ({ orderItems, fulfillments, order, payment }) => {
  const paymentMethod = order?.paymentMethod || payment?.provider;
  const isCod = paymentMethod === 'cod';
  const paymentSettled = PAYMENT_SETTLED_STATUSES.includes(payment?.status);
  const paymentStepTime = paymentSettled ? payment?.updatedAt || payment?.createdAt : '';
  const orderPlacedTime = order?.createdAt;
  const processingTime = order?.statusHistory
    ? [...order.statusHistory]
      .reverse()
      .find((event) => event.statusGroup === 'order' && ['processing', 'ready_for_shipment', 'closed'].includes(event.toStatus))
      ?.createdAt
    : '';
  const refundsByReturnId = new Set(
    (order?.refunds || order?.Refunds || [])
      .filter((refund) => ['refunded', 'partially_refunded'].includes(refund.status))
      .map((refund) => refund.returnId)
      .filter(Boolean)
  );
  const refundAmountByReturnId = (order?.refunds || order?.Refunds || [])
    .filter((refund) => ['refunded', 'partially_refunded'].includes(refund.status) && refund.returnId)
    .reduce((map, refund) => {
      map[refund.returnId] = (map[refund.returnId] || 0) + Number(refund.amount || 0);
      return map;
    }, {});
  const refundedQuantityByItem = (order?.returns || order?.Returns || [])
    .filter((request) => request.type === 'return' && refundsByReturnId.has(request.id))
    .flatMap((request) => request.items || [])
    .reduce((map, returnItem) => {
      const orderItemId = returnItem.orderItemId || returnItem.orderItem?.id;
      if (!orderItemId) return map;
      map[orderItemId] = (map[orderItemId] || 0) + Number(returnItem.quantity || 0);
      return map;
    }, {});
  const orderItemAmountById = orderItems.reduce((map, item) => {
    map[item.id] = Number(item.total || 0);
    return map;
  }, {});
  const orderItemQuantityById = orderItems.reduce((map, item) => {
    map[item.id] = Number(item.quantity || 0);
    return map;
  }, {});
  const refundedAmountByItem = (order?.returns || order?.Returns || [])
    .filter((request) => request.type === 'return' && refundsByReturnId.has(request.id))
    .reduce((map, request) => {
      const requestItems = request.items || [];
      const requestItemAmounts = requestItems.map((returnItem) => {
        const orderItemId = returnItem.orderItemId || returnItem.orderItem?.id;
        const orderedQty = Number(orderItemQuantityById[orderItemId] || 0);
        const returnedQty = Number(returnItem.quantity || 0);
        const itemTotal = Number(orderItemAmountById[orderItemId] || 0);
        const amount = orderedQty > 0 ? itemTotal * (returnedQty / orderedQty) : 0;
        return { orderItemId, amount };
      });
      const requestAmount = requestItemAmounts.reduce((sum, item) => sum + item.amount, 0);
      const refundedAmount = Number(refundAmountByReturnId[request.id] || 0);
      requestItemAmounts.forEach((returnItem) => {
        if (!returnItem.orderItemId || requestAmount <= 0) return;
        map[returnItem.orderItemId] = (map[returnItem.orderItemId] || 0) + (refundedAmount * (returnItem.amount / requestAmount));
      });
      return map;
    }, {});

  return orderItems.map((item) => {
    const relatedFulfillments = fulfillments
      .map((fulfillment, index) => {
        const fulfillmentItem = findFulfillmentItem(fulfillment, item);
        if (!fulfillmentItem) return null;

        const history = getShipmentHistory(fulfillment);
        const expectedDeliveryHistory = getShipmentExpectedDeliveryHistory(fulfillment);
        const rawStatus = normalizeShipmentStatus(fulfillment.status || fulfillment.shipment?.status);
        const quantity = Number(fulfillmentItem.quantity || 0);
        const deliveredAt = getStatusTime(history, ['delivered']) || (rawStatus === 'delivered' ? fulfillment.updatedAt : '');

        return {
          id: fulfillment.id,
          index: index + 1,
          quantity,
          status: rawStatus,
          statusLabel: getShipmentStatusLabel(rawStatus),
          statusColor: getShipmentStatusColor(rawStatus),
          trackingNumber: getShipmentTrackingNumber(fulfillment),
          trackingUrl: getShipmentTrackingUrl(fulfillment),
          carrier: getShipmentCarrier(fulfillment),
          deliveredAt,
          estimate: getShipmentExpectedDeliveryDate(fulfillment),
          expectedDeliveryHistory: expectedDeliveryHistory.map((event) => ({
            date: event.date,
            previousDate: event.previousDate,
            at: event.at || event.createdAt || event.timestamp,
          })),
          updatedAt: getLatestHistoryTime(history) || fulfillment.updatedAt || fulfillment.createdAt,
          history: history.map((event) => ({
            status: event.status || event.toStatus,
            label: getShipmentStatusLabel(event.status || event.toStatus),
            at: event.createdAt || event.timestamp || event.at,
            note: event.note || event.message,
          })),
        };
      })
      .filter(Boolean);

    const totalQuantity = Number(item.quantity || 0);
    const deliveredQuantity = relatedFulfillments
      .filter((segment) => segment.status === 'delivered')
      .reduce((sum, segment) => sum + segment.quantity, 0);
    const fulfilledQuantity = relatedFulfillments
      .filter((segment) => segment.status !== 'created')
      .reduce((sum, segment) => sum + segment.quantity, 0);
    const strongestSegment = relatedFulfillments.reduce((best, segment) => {
      const currentRank = SHIPMENT_STATUS_RANK[segment.status] || 0;
      const bestRank = SHIPMENT_STATUS_RANK[best?.status] || 0;
      return currentRank > bestRank ? segment : best;
    }, null);

    let productStatus = strongestSegment?.status || 'processing';
    if (deliveredQuantity > 0 && deliveredQuantity < totalQuantity) {
      productStatus = 'partially_delivered';
    } else if (deliveredQuantity >= totalQuantity && totalQuantity > 0) {
      productStatus = 'delivered';
    } else if (!paymentSettled && !isCod) {
      productStatus = 'pending';
    }
    const refundedQuantity = Math.min(Number(refundedQuantityByItem[item.id] || 0), totalQuantity);
    const refundedAmount = Number(refundedAmountByItem[item.id] || 0);
    if (refundedQuantity > 0 && refundedQuantity < totalQuantity) {
      productStatus = 'partially_refunded';
    } else if (refundedQuantity >= totalQuantity && totalQuantity > 0) {
      productStatus = 'refunded';
    }

    const meta = PRODUCT_STATUS_META[productStatus] || {
      label: getShipmentStatusLabel(productStatus),
      color: getShipmentStatusColor(productStatus),
      step: 'processing',
    };
    const deliveredAt = relatedFulfillments
      .filter((segment) => segment.deliveredAt)
      .sort((a, b) => new Date(b.deliveredAt) - new Date(a.deliveredAt))[0]?.deliveredAt;
    const estimate = relatedFulfillments.find((segment) => segment.estimate)?.estimate;

    return {
      item,
      imageUrl: getProductImageUrl(item),
      productUrl: getProductUrl(item),
      status: productStatus,
      statusMeta: meta,
      currentStep: meta.step,
      segments: relatedFulfillments,
      totalQuantity,
      fulfilledQuantity,
      deliveredQuantity,
      refundedQuantity,
      refundedAmount,
      paymentSettled,
      isCod,
      orderPlacedTime,
      paymentStepTime,
      processingTime,
      deliveredAt,
      estimate,
    };
  });
};
