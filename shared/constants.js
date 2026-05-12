/**
 * Shared constants across the application
 */

// Payment statuses that are considered "settled" (payment confirmed)
export const PAYMENT_SETTLED_STATUSES = [
  'paid_online',
  'paid_cod',
  'completed',
  'cod_collected'
];

// Payment statuses where the user should be allowed to retry payment
export const RETRYABLE_PAYMENT_STATUSES = [
  'payment_pending',
  'payment_failed',
  'payment_expired',
  'pending',
  null,
  undefined
];
