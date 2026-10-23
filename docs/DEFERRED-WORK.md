# Deferred work

## Checkout presentation when payment or shipping UI is hidden

Status: Deferred at the user's request on 2026-10-23.

Current behavior:
- Hiding storefront payment options keeps checkout using the configured/default payment method.
- Hiding shipping presentation can hide delivery charges and delivery tax even though they remain included in the order total.

Follow-up requirements:
- Always disclose delivery charges and delivery tax included in checkout totals, even when shipping controls and promotions are hidden.
- When the payment chooser is hidden, clearly show the payment method that will be used.
- Block checkout with a clear message if no valid payment method is configured.
- Preserve backend processing, historical records, and permission enforcement.
- Verify these cases with checkout tests and a browser pass before closing this item.

This deferral does not change current checkout behavior.
