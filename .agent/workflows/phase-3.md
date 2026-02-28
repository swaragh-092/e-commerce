---
description: How to build Phase 3 — Cart, Checkout, Orders, Payment, and Coupon
---

# Phase 3 — Shopping Flow (Cart → Checkout → Order → Payment → Coupon)

// turbo-all

## Prerequisites
Phase 2 must be complete (Products and Categories working).

## Step 1: Build Cart module

Follow `/new-module` workflow for `cart`:
- Models: `carts`, `cart_items`
- Guest carts: use `sessionId` when no user
- Merge flow: on login, merge guest cart → user cart
- Validate stock on add/update
- Filter out soft-deleted products on fetch
- Endpoint: DELETE /api/cart to clear all

## Step 2: Build Coupon module

Follow `/new-module` workflow for `coupon`:
- Models: `coupons`, `coupon_usages`
- Validation: active, within dates, under usage limit, under per-user limit, min order amount, applicable scope
- All validation MUST run inside a transaction
- On cancel/refund: decrement usedCount
- Rate limit: 10/min on validate endpoint

## Step 3: Build Order module

Follow `/new-module` workflow for `order`:
- Models: `orders`, `order_items`, `addresses`
- Snapshot fields: snapshotName, snapshotPrice, snapshotImage, snapshotSku, variantInfo (JSONB)
- shippingAddressSnapshot: JSONB copy of address at time of order
- discountAmount + couponId for coupon tracking
- Order number format: ORD-YYYYMMDD-NNN

**CRITICAL — Checkout flow (in order.service.js):**
1. Validate cart not empty
2. Re-fetch current prices (NEVER trust cart)
3. If prices changed → return 409
4. Validate coupon if applied
5. Calculate tax (global setting or per-product override)
6. Calculate shipping (flat rate or free threshold)
7. BEGIN TRANSACTION
   a. Reserve inventory (atomic UPDATE with WHERE clause)
   b. Create Order + OrderItems with snapshots
   c. Create CouponUsage if coupon used
   d. Mark cart as 'converted'
8. COMMIT
9. Create Stripe PaymentIntent
10. Return clientSecret

## Step 4: Build Payment module

Follow `/new-module` workflow for `payment`:
- Models: `payments`, `webhook_events`
- Provider pattern: abstract PaymentProvider class
- Stripe provider: createIntent, handleWebhook, refund
- Idempotency: use orderId as Stripe idempotency key
- Webhook dedup: check webhook_events before processing
- On payment_intent.succeeded → update order to 'paid'
- On payment_intent.payment_failed → keep as 'pending_payment'

## Step 5: Test Phase 3

Test the FULL flow:
1. Add items to cart
2. Apply coupon (validate endpoint)
3. Place order (checkout)
4. Verify prices re-validated
5. Verify inventory reserved
6. Payment intent created
7. Simulate webhook → order moves to 'paid'
8. Admin: update status to shipped → delivered
9. Cancel order → inventory released, coupon usage reversed

Edge cases to test:
- Two users buy last item → one gets 409 INSUFFICIENT_STOCK
- Apply expired coupon → rejected
- Apply coupon twice → rejected (per-user limit)
- Change price mid-cart → 409 PRICE_CHANGED on checkout
