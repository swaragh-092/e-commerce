import { describe, expect, it } from 'vitest';
import { getFulfillmentProgress, getOrderDataWarnings } from '../../utils/orderFulfillment';
import { getOrderProgressSteps } from '../../utils/orderWorkflow';

describe('order delivery consistency', () => {
  const items = [{ id: 'one', quantity: 1 }];
  it('never invents delivered quantities from an aggregate delivery label', () => {
    const progress = getFulfillmentProgress(items, []);
    expect(progress).toEqual({ total: 1, shipped: 0, remaining: 1 });
    expect(getOrderDataWarnings({ status: 'cancelled', orderShippingStatus: 'delivered' }, progress)).toHaveLength(2);
  });
  it('counts delivered line items and caps duplicate delivery quantities at the quantity ordered', () => {
    const fulfillment = { status: 'delivered', items: [{ orderItemId: 'one', quantity: 1 }] };
    const progress = getFulfillmentProgress(items, [fulfillment, fulfillment]);
    expect(progress).toEqual({ total: 1, shipped: 1, remaining: 0 });
    expect(getOrderDataWarnings({ status: 'closed', orderShippingStatus: 'delivered' }, progress)).toEqual([]);
  });
  it.each(['shipped', 'cancelled'])('does not treat %s fulfillment records as delivered', (status) => {
    expect(getFulfillmentProgress(items, [{ status, items: [{ orderItemId: 'one', quantity: 1 }] }]).shipped).toBe(0);
  });
  it('does not invent physical deliveries for a digital order', () => {
    const order = { status: 'confirmed', orderShippingStatus: 'delivered', shippingAddressSnapshot: { digital: true }, Payment: { status: 'paid_online' } };
    expect(getOrderDataWarnings(order, { total: 1, shipped: 0 })).toEqual([]);
    const steps = getOrderProgressSteps(order);
    expect(steps.some((step) => ['shipped', 'out_for_delivery', 'delivered'].includes(step.key))).toBe(false);
    expect(steps.find((step) => step.key === 'processing').status).toBe('pending');
  });
  it('counts only shippable items in mixed orders and does not flag a valid delivered order', () => {
    const order = { status: 'closed', orderShippingStatus: 'delivered', items: [
      { id: 'physical', quantity: 1, product: { requiresShipping: true } },
      { id: 'digital', quantity: 2, product: { requiresShipping: false } },
      { id: 'digital-snapshot', quantity: 1, requiresShipping: false },
    ] };
    const progress = getFulfillmentProgress(order.items, [{ status: 'delivered', items: [{ orderItemId: 'physical', quantity: 1 }] }]);
    expect(progress).toEqual({ total: 1, shipped: 1, remaining: 0 });
    expect(getOrderDataWarnings(order, progress)).toEqual([]);
  });
  it('does not infer completed shipping milestones for a cancelled order with stale delivery status', () => {
    expect(getOrderProgressSteps({ status: 'cancelled', orderShippingStatus: 'delivered', Payment: { status: 'payment_expired' } }).map((step) => step.key)).toEqual(['placed', 'cancelled']);
  });
});
