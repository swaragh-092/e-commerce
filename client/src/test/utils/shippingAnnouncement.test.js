import { describe, expect, it } from 'vitest';
import {
  isFreeShippingPromotion,
  resolveShippingAnnouncement,
} from '../../utils/shippingAnnouncement';

describe('shipping announcement resolution', () => {
  const formatPrice = (amount) => `₹${Number(amount).toFixed(2)}`;

  it('uses the configured currency and threshold used by checkout', () => {
    expect(resolveShippingAnnouncement({
      announcement: { text: 'Free shipping on orders over $50!' },
      shipping: { method: 'free_above_threshold', freeThreshold: 750 },
      formatPrice,
    })).toBe('Free shipping on orders over ₹750.00.');
  });

  it('hides a stale free-shipping claim when checkout uses flat rate', () => {
    expect(resolveShippingAnnouncement({
      announcement: { text: 'Free shipping on orders over $50!' },
      shipping: { method: 'flat_rate', freeThreshold: 50 },
      formatPrice,
    })).toBe('');
  });

  it('leaves non-shipping announcements unchanged', () => {
    expect(isFreeShippingPromotion('Fresh arrivals are live.')).toBe(false);
    expect(resolveShippingAnnouncement({
      announcement: { text: 'Fresh arrivals are live.' },
      shipping: { method: 'flat_rate' },
      formatPrice,
    })).toBe('Fresh arrivals are live.');
  });
});
