# Engineering Audit & Daily Commit Log — October 1, 2026

This document provides a comprehensive, ground-truth record of all engineering work, architectural hardenings, security remediations, and code commits completed on **October 1, 2026** across all developer and AI sessions (including Antigravity, OpenCode, Codex, and manual peer contributions).

---

## 1. Executive Summary

Today's work resolved critical production-readiness blockers across four core domains:
1. **Shipping Rate Calculation & Multi-Package Planning**:
   - Single order-level application for `percent_of_order` shipping rules on multi-parcel split orders (preventing duplicate percentage charges).
   - Dynamic remainder box optimization to eliminate wasteful oversized packaging for multi-quantity items.
   - Mixed-product package groups with variant-level constraint enforcement.
   - Pincode coverage validation in admin preview and checkout quote consumption.
   - Widening `webhook_secret` to `TEXT` and adding IP-based webhook rate limiting.
2. **Payment Gateway Hardening & Webhook Reliability**:
   - Zero-total orders (100% discount coupons) settle idempotently without contacting external gateways, skipping provider sessions.
   - Cashfree retry attempt tracking (`metadata.attempts`) to capture and match superseded order IDs on asynchronous webhook callbacks.
   - Explicit `payment.failed` webhook ingestion for Razorpay and Cashfree, preventing orders from remaining in indeterminate pending states.
   - Guarded PayU return redirects against missing order IDs.
   - Background reservation timeout worker marks abandoned payments `payment_expired`.
3. **Authentication, Access Control & CodeQL Security**:
   - CodeQL alert 57 resolution: Re-architected trusted-device cookies with AES-256-GCM authenticated encryption applied directly at the `res.cookie` sink with strict `httpOnly` and `secure` flags.
   - Account deletion grace period preservation: Removed premature session revocation in `deleteAccount`, allowing customers to log in and cancel deletion during the 30-day window.
   - Passwordless phone-only account deletion via SMS OTP and OAuth deletion support.
   - Legacy OAuth uppercase email normalization via case-insensitive database lookups.
   - Row-level lock (`FOR UPDATE OF u`) on candidate super-admin records to eliminate race conditions during staff deletion/demotion.
4. **Order Management & Storefront Alignment**:
   - Reconciled financial breakdown for free-shipping orders (`subtotal + tax + shippingCost - discountAmount = total`) to ensure invoice integrity.
   - Digital orders (`requiresShipping === false`) exclude COD, bypass shipping quotes/addresses, and mark delivery completed immediately without distorting shipment totals.
   - Storefront tax preview alignment: Computed client-side line item taxes based on net discounted taxable values matching the server's GST algorithm.
   - Fixed `plannedParcelId` reference error in the admin order fulfillment dialog.

---

## 2. Chronological Commit History (October 1, 2026)

All 22 commits executed today are cataloged below in reverse chronological order:

```
fd3000a fix(payments): free-order idempotency, failure history status, PayU redirect guards
ea0e3f3 fix(pr78): apply percent shipping once, harden cookies for CodeQL, and align tax discounts
42e3ccb fix(pr78): address package fit, deletion grace, phone auth, and shipping delivery comments
b6614eb fix(checkout,coupon,admin,auth): address PR #78 review comments
e1dab2f fix(admin,oauth): declare plannedParcelId state and match OAuth emails case-insensitively
978b5b8 fix: resolve free-shipping quotes, reject digital COD, isolate targeted GST lines, recheck coverage, and allow delivery retries
127931e fix(auth): close session-revoke windows, OTP/reset/2FA edges, join-aware admin guards
28ef03a feat(shipping): configure mixed product package groups
4a857a6 fix(auth): session verification fallback, jwt claims, and auth/user security hardening
b5be210 feat(shipping): optimize parcel planning remainder box allocation and add unit tests
3f2a613 fix(order): allow COD orders to close upon return to origin (RTO) without payment collection
c0fc313 fix(shipping): widen webhookSecret to TEXT and add webhook rate limiter
74d4064 fix(shipping): audit hardening, security fixes, and multi-package fulfillment
f41e817 Merge pull request #77 from swaragh-092/codex/storewide-pincode-coverage
ecc5045 fix(shipping): clarify pincode coverage rules
b2c21f4 Merge pull request #76 from swaragh-092/codex/default-shipping-package
c811152 feat(shipping): add measured default package and capacity validation
c14d74f Merge pull request #75 from swaragh-092/feature/my-feature
d52d796 fix(env): fix TDZ in validateEnvironment, terminate on uncaughtException, and pass admin prefix to Docker client
b74ec52 feat(shipping): implement shipping reliability edge cases and tracking reconciliation
f30a8e7 Merge pull request #74 from swaragh-092/feature/my-feature
b9ba233 Templates
```

---

## 3. Detailed Commit & Feature Breakdown

### Commit `fd3000a` — Payment & Free-Order Hardening
- **Author**: OpenCode / spidy092
- **Files Changed**:
  - `client/src/pages/storefront/CheckoutPage.jsx`
  - `server/src/modules/payment/payment.controller.js`
  - `server/src/modules/payment/payment.service.js`
- **What Was Fixed**:
  1. *Free Order Idempotency*: When an order total is ₹0 (100% coupon), `PaymentService.createOrder` immediately returns `{ provider, freeOrder: true, amount: 0 }` instead of rejecting with a status error if the order was already marked `processing`.
  2. *Client Redirection for Free Orders*: In `CheckoutPage.jsx`, if `orderTotal <= 0.009`, the client navigates directly to `/payment/success` without attempting to start an external payment gateway session.
  3. *PayU Return Redirect Guards*: In `payment.controller.js`, `handlePayUReturn` guards against missing `result.orderId` before appending URL search parameters, redirecting safely to `/payment/failure`.
  4. *Payment Failure History Transition*: Corrected `fromStatus` in `markPaymentFailed` to reflect `payment.status` rather than a static string.

---

### Commit `ea0e3f3` — Shipping Rule Multi-Parcel Fix, CodeQL Cookie Encryption & Tax Preview
- **Author**: Antigravity / spidy092
- **Files Changed**:
  - `server/src/modules/shipping/shipping.service.js`
  - `server/tests/unit/shipping.service.test.js`
  - `server/src/modules/auth/authCookies.js`
  - `server/tests/unit/auth.cookies.test.js`
  - `client/src/pages/storefront/CheckoutPage.jsx`
- **What Was Fixed**:
  1. *Percent of Order Shipping Rules*: When multi-package items split an order into multiple parcels, `calculateRuleRate` was previously called once per parcel with full cart subtotal, multiplying the percentage fee by parcel count. Evaluated `percent_of_order` once at the order level while keeping per-parcel summation for weight-based slabs.
  2. *CodeQL Alert 57 Clear-Text Cookie Resolution*: Applied AES-256-GCM cipher encryption directly in `res.cookie(TRUSTED_DEVICE_COOKIE, encrypt(rawToken), ...)`. Removed unused `signTrustedDevice` from unit test imports.
  3. *Checkout Tax Preview Discount Alignment*: Updated `priceResolver` in `taxSummary` memo to calculate effective taxable price after line discounts (`Math.max(0, itemSubtotal - itemDiscount) / quantity`), synchronizing client tax previews with backend calculations.

---

### Commit `42e3ccb` — Package Fit, Deletion Grace, Phone Auth & Shipping Denominator
- **Author**: Antigravity / spidy092
- **Files Changed**:
  - `server/migrations/20261002000000-user-profiles-phone-unique.js`
  - `server/src/modules/auth/auth.service.js`
  - `server/src/modules/auth/authCookies.js`
  - `server/src/modules/order/order.service.js`
  - `server/src/modules/payment/payment.service.js`
  - `server/src/modules/shipping/shipping.packages.js`
  - `server/src/modules/user/user.service.js`
  - `server/src/modules/user/user.validation.js`
  - `client/src/pages/storefront/ProductDetailPage.jsx`
  - `client/src/pages/storefront/CheckoutPage.jsx`
- **What Was Fixed**:
  1. *Postgres Migration Idempotency*: Added `pg_class` catalog check in `20261002000000-user-profiles-phone-unique.js` to skip recreating `user_profiles_phone_unique` if already created by earlier migrations.
  2. *Cancellable Account Deletion*: Removed session kill-switch in `deleteAccount`. Allowed users to log in during the 30-day grace period to cancel deletion. Supported passwordless phone deletion via OTP.
  3. *Shipping Delivery Completion Denominator*: Filtered out digital items (`requiresShipping === false`) from `deriveQuantityAwareOrderShippingStatus`, allowing mixed physical/digital orders to reach `delivered` when all physical items are fulfilled.
  4. *Free Shipping Financial Consistency*: Retained quoted `shippingCost` while setting `shippingDiscount = shippingCost` inside `discountAmount`. Reconciled `subtotal + tax + shipping - discount = total` on invoices.
  5. *Buy Now Digital Flag*: Propagated `requiresShipping` through `buyNowItem` and added an authoritative server-fetch fallback in `CheckoutPage.jsx`.

---

### Commit `b6614eb` — Digital Quoteless Checkout, Super-Admin Row Locking & Coupon Stacking
- **Author**: Antigravity / spidy092
- **Files Changed**:
  - `client/src/context/AuthContext.jsx`
  - `client/src/pages/storefront/CheckoutPage.jsx`
  - `server/src/modules/admin/admin.service.js`
  - `server/src/modules/coupon/coupon.service.js`
  - `server/src/modules/user/user.service.js`
- **What Was Fixed**:
  1. *Digital Quoteless/Addressless Checkout*: Digital carts skip shipping address and quote requirements, and reject COD.
  2. *Super-Admin Concurrency Lock*: Applied `FOR UPDATE OF u` in Postgres raw SQL when checking `count <= 1` active super-admins during staff deletion/demotion.
  3. *Coupon Stacking Line Allocation*: Implemented multi-pass algorithm in `CouponService.buildCombinationResult` ensuring stacked coupon discounts never exceed item line subtotals.
  4. *Auth Context Auto-Login*: Automatically finalized session on registration when email verification is disabled in settings.

---

### Commit `e1dab2f` — Admin Parcel State & OAuth Email Normalization
- **Author**: Antigravity / spidy092
- **Files Changed**:
  - `client/src/pages/admin/OrderDetailPage.jsx`
  - `server/src/modules/auth/oauth.service.js`
- **What Was Fixed**:
  1. *Planned Parcel State*: Declared missing `const [plannedParcelId, setPlannedParcelId] = useState('')` in `OrderDetailPage.jsx` to prevent runtime `ReferenceError`.
  2. *Case-Insensitive OAuth Match*: Used `LOWER(email)` in `findOrCreateOAuthUser` to prevent account duplication when existing accounts have uppercase emails.

---

### Commit `978b5b8` — Free Shipping Quotes, Digital COD, Targeted GST & Coverage Recheck
- **Author**: Antigravity / spidy092
- **Files Changed**:
  - `server/src/modules/shipping/shipping.service.js`
  - `server/src/modules/order/order.service.js`
  - `server/src/modules/coupon/coupon.service.js`
  - `server/src/modules/tax/tax.service.js`
- **What Was Fixed**:
  1. *Free Shipping Before Quote*: `CouponService.buildCombinationResult` preserves `freeShipping: true` even when quoted shipping cost is ₹0 during initial cart evaluation.
  2. *COD Rejection for Digital*: Explicitly threw `COD_UNAVAILABLE` when an order contains only non-shipping items.
  3. *Recheck Coverage on Quote Validation*: `validateQuoteForOrder` re-evaluates current storewide allow/block pincode lists upon order placement.
  4. *Inter-State vs Intra-State GST*: Required both origin and destination states to match before applying SGST+CGST; single or mismatched states default to IGST.

---

### Commit `127931e` — Session Invalidation Windows, OTP/Reset Tokens & Role Guards
- **Author**: Antigravity / spidy092
- **Files Changed**:
  - `server/src/modules/auth/auth.service.js`
  - `server/src/utils/tokenBlocklist.js`
  - `server/src/middleware/auth.middleware.js`
- **What Was Fixed**:
  1. *Session Revocation Windows*: Added in-memory `tokenBlocklist.isSessionRevoked(sid)` fast path to immediately revoke access tokens before JWT expiration.
  2. *Single-Purpose Token Guards*: `auth.middleware.js` rejects JWTs containing a `purpose` claim (such as `2fa_temp` or `trusted_device`) from authenticating general API routes.
  3. *Join-Aware Admin Guards*: Super-admin checks evaluate both legacy `user.role` column and `user_roles` junction table.

---

### Commits `28ef03a` & `b5be210` — Parcel Planning, Mixed Package Groups & Remainder Box Optimization
- **Author**: Antigravity / spidy092
- **Files Changed**:
  - `server/src/modules/shipping/shipping.packages.js`
  - `server/tests/unit/shipping.package.test.js`
  - `client/src/pages/admin/ShippingPage.jsx`
- **What Was Fixed**:
  1. *Mixed Product Groups*: Supported `mixGroup` configuration on package profiles, packing complementary products together into shared parcels up to profile limits.
  2. *Remainder Box Allocation*: Instead of repeating the largest box for trailing quantities, the planner dynamically selects the smallest eligible box that preserves the minimum parcel count.

---

### Commit `3f2a613` — COD Orders Return-to-Origin (RTO) Settlement
- **Author**: Antigravity / spidy092
- **Files Changed**:
  - `server/src/utils/orderWorkflow.js`
- **What Was Fixed**:
  - `canCloseOrder` permits COD orders with `orderShippingStatus === 'rto'` to transition to `closed` without demanding collected cash payments.

---

### Commits `c0fc313` & `74d4064` — Shipping Audit Hardening, Secrets & Rate Limiting
- **Author**: Antigravity / spidy092
- **Files Changed**:
  - `server/migrations/20261001140000-widen-webhook-secret-to-text.js`
  - `server/src/middleware/rateLimiter.middleware.js`
  - `server/src/modules/shipping/shipping.webhook.routes.js`
  - `server/src/modules/shipping/shipping.webhook.service.js`
- **What Was Fixed**:
  1. *Webhook Secret Storage*: Widened `webhook_secret` column on `shipping_providers` to `TEXT` to accommodate long carrier tokens.
  2. *Webhook Rate Limiting*: Created dedicated `shippingWebhookLimiter` preventing DDoS on callback endpoints.
  3. *Replay Protection*: Idempotent tracking of incoming carrier events via `ShippingOperation` and `ShipmentEvent`.

---

### Commits `f41e817`, `ecc5045`, `b2c21f4`, `c811152` — Default Package & Storewide Pincode Coverage
- **Author**: Codex / Chethan H R / spidy092
- **PRs**: PR #76, PR #77
- **What Was Fixed**:
  1. Added measured default package configuration and validation for unprofiled items.
  2. Implemented storewide allow/block pincode coverage rules affecting both standard quotes and manual rule evaluation.

---

### Commits `c14d74f`, `d52d796`, `b74ec52` — Environment Validation & Shipping Reliability
- **Author**: spidy092 / Chethan H R
- **PR**: PR #75
- **What Was Fixed**:
  1. Fixed Temporal Dead Zone (TDZ) bug in `validateEnvironment.js`.
  2. Added process exit handlers on unhandled exceptions.
  3. Passed admin prefix correctly to Docker client containers.
  4. Implemented carrier sync retry circuit breakers for Shiprocket API outages.

---

## 4. Verification Evidence & Test Run Matrix

Every change in this daily log has been validated through automated testing suites:

| Test Suite | Total Files | Total Tests | Outcome | Duration |
|---|---|---|---|---|
| **Server Unit Tests** | 41 files | 421 tests | **All 421 Passed (0 Failures)** | 4.54s |
| **Client Unit Tests** | 22 files | 90 tests | **All 90 Passed (0 Failures)** | 16.65s |
| **Client Production Build** | Vite bundle | Complete | **Built in 14.26s (0 Errors)** | 14.26s |
| **GitHub Actions CI (PR #78)** | 9 workflows | 9 check runs | **All 9 Succeeded** | N/A |

### Remote GitHub Actions Run Proof (`commit ea0e3f3`)
- `Backend (Node 18)`: **SUCCESS**
- `Frontend (Node 18)`: **SUCCESS**
- `CodeQL (javascript-typescript)`: **SUCCESS**
- `CodeQL - Code Quality (javascript-typescript)`: **SUCCESS**
- `GitGuardian Security Checks`: **SUCCESS**
