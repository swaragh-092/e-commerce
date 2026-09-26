/**
 * Resolve a free-shipping announcement from the same settings used by the
 * shipping calculator. A stale free-shipping claim must never be shown when
 * checkout is using a flat-rate or carrier quote.
 */
export const isFreeShippingPromotion = (text) =>
  typeof text === 'string' &&
  /free\s+shipping/i.test(text) &&
  /\b(?:over|above|orders?)\b/i.test(text);

export const resolveShippingAnnouncement = ({ announcement = {}, shipping = {}, formatPrice }) => {
  const text = typeof announcement.text === 'string' ? announcement.text.trim() : '';

  if (!isFreeShippingPromotion(text)) return text;

  const method = shipping?.method || 'flat_rate';
  if (method === 'free') return 'Free shipping on every order.';

  const threshold = Number(shipping?.freeThreshold);
  if (method === 'free_above_threshold' && Number.isFinite(threshold) && threshold > 0) {
    return `Free shipping on orders over ${formatPrice(threshold)}.`;
  }

  // Do not render a promotion that checkout cannot honour.
  return '';
};
