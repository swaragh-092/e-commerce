import { describe, it, expect } from 'vitest';
import { getShipmentTimeline } from '../../components/orders/order-detail/orderDetailUtils';

describe('parcel tracking history', () => {
  it('combines carrier scans and staff history without repeating the same status update', () => {
    const timeline = getShipmentTimeline({
      statusHistory: [
        { status: 'created', at: '2026-10-05T08:00:00Z', source: 'admin' },
        { status: 'out_for_delivery', at: '2026-10-05T09:00:00Z', source: 'webhook', location: 'Delivery hub' },
      ],
      events: [
        { id: 'event-1', eventStatus: 'out_for_delivery', eventTimestamp: '2026-10-05T09:00:00.000Z' },
        { id: 'event-2', eventStatus: 'delivered', eventTimestamp: '2026-10-05T10:00:00Z' },
      ],
    });
    expect(timeline.map((event) => event.status)).toEqual(['delivered', 'out_for_delivery', 'created']);
    expect(timeline[1].location).toBe('Delivery hub');
    expect(timeline[1].source).toBe('carrier');
  });

  it('uses the receipt time for a scan without a carrier timestamp', () => {
    expect(getShipmentTimeline({ events: [{ eventStatus: 'unknown', eventTimestamp: '1970-01-01T00:00:00Z', createdAt: '2026-10-05T09:00:00Z' }] })[0].at)
      .toBe('2026-10-05T09:00:00Z');
    expect(getShipmentTimeline({})).toEqual([]);
  });
});
