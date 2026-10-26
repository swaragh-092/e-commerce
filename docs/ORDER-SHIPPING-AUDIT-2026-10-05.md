# Order & Shipping Workflow Audit — 2026-10-05 (Verified)

**Branch audited:** `codex/shipping-rule-pricing-main`
**Git SHA:** `39611db`
**Working Tree Status:** 32 modified files, 3 unapplied migrations, 7 new test files (uncommitted in working tree)
**Audit type:** Read-only verification. Zero code, configuration, or database records were modified.
**Auditor:** Antigravity agent
**Verification Date:** 2026-10-05

---

## Executive Summary

A comprehensive, zero-assumption verification was conducted on the entire order-to-delivery lifecycle. Every assertion was validated against actual code in the working tree, database schema state via live PostgreSQL connection, and test execution (`481 server unit tests`, `92 client unit tests`).

### Status of Prior Audit Hypotheses & Working Tree Changes

| Item / Finding | Initial Audit Status | Verified Reality in Working Tree & DB | Actual Status |
|---|---|---|---|
| **Database Migrations** | Not audited | `guest_session_id`, `idempotency_key`, `expires_at` defined in models but migrations are **DOWN** | 🚨 **P0 BLOCKER** |
| **P0-1: Global Guest Cart Wipe** | Open | `Cart.update` where `userId: null` still executes on guest online payment | ❌ **P0 Unresolved** |
| **P0-2: Guest Order Confirmation** | Open (401) | `GET /orders/:id` patched to `optionalAuth`, but frontend route `/account/orders/:id` is behind `<ProtectedRoute />` | ⚠️ **P1 Partial** |
| **P1-1: Inventory Restocking on Cancel/Return** | Reported Broken | Implemented in `order.service.js:3151,3383` with unit test `inventory.shipmentCancellation.test.js` | ✅ **Fixed in Working Tree** |
| **P1-2: Shiprocket Carrier Cancellation** | Reported Broken | Implemented in `order.service.js:3048` and `shiprocket.provider.js:905` | ✅ **Fixed in Working Tree** |
| **P1-3: Delivery Webhook Settlement & Closure** | Reported Broken | Auto-closure for prepaid implemented (`syncOrderClosureIfComplete`). COD collection is admin-confirmed via `confirmCodPayment`. | ✅ **Designed & Handled** |
| **P1-4: Exclusive Delivery Tax Omitted** | Reported Broken | Implemented in `orderDetailUtils.js:88-91` (`Shipping tax` row appended to `getTaxRows`) | ✅ **Fixed in Working Tree** |
| **P2-1: Quoted vs Assigned Courier Drift** | Reported Broken | Implemented in `shiprocket.provider.js:828` (`courier_id` passed to `/courier/assign/awb`) | ✅ **Fixed in Working Tree** |
| **P2-2: Manifest & Carrier Invoice in UI** | Reported Broken | Implemented in `OrderDetailPage.jsx:1592-1601` with download links | ✅ **Fixed in Working Tree** |
| **P2-3: Booking Errors Hidden in Admin UI** | Reported Broken | Implemented in `OrderDetailPage.jsx:1570-1574,1603` with error Alert and Retry button | ✅ **Fixed in Working Tree** |

---

## 1. Critical Showstoppers (P0)

### 🚨 SHOWSTOPPER 1: Unapplied Database Migrations Crashing Live Model Queries

**Files affected:**
- `server/src/modules/order/order.model.js` (`guestSessionId`, `idempotencyKey`)
- `server/src/modules/payment/payment.model.js` (`expiresAt`)
- `server/migrations/20261005143000-add-guest-order-session.js` (Status: `down`)
- `server/migrations/20261005160000-add-order-idempotency-key.js` (Status: `down`)
- `server/migrations/20261005161000-add-payment-attempt-expiry.js` (Status: `down`)

**Grounded Evidence:**
Running `npx sequelize-cli db:migrate:status` reveals:
```
down 20261005143000-add-guest-order-session.js
down 20261005160000-add-order-idempotency-key.js
down 20261005161000-add-payment-attempt-expiry.js
```
Querying `Order.findOne` against the PostgreSQL database produces:
```
Query FAILED with: column "guest_session_id" does not exist
```
Querying `Payment.findOne` produces:
```
Payment Query FAILED with: column "expires_at" does not exist
```
**Impact:**
Because unit tests mock Sequelize/database models, all 481 unit tests pass in isolation. However, in any live server instance or integration test hitting the real PostgreSQL database, every single call to query an Order or Payment throws a fatal 500 error (`column "guest_session_id" does not exist`).
**Action Required:**
Before running or deploying the code in this branch, the three pending migrations must be applied (`npx sequelize-cli db:migrate`).

---

### 🚨 SHOWSTOPPER 2: Global Active Guest Cart Wipe on Online Payment (P0-1)

**Files affected:**
- `server/src/modules/payment/payment.service.js:51–58` (`getActiveCartIdForUser`)
- `server/src/modules/payment/payment.service.js:187` (`initiatePayment`)
- `server/src/modules/payment/payment.service.js:793–804` (`recordPaymentSuccess`)

**Grounded Evidence:**
In `payment.service.js`:
```javascript
const getActiveCartIdForUser = async (userId) => {
    if (!userId) return null; // Returns null for any guest checkout
    ...
};
```
In `recordPaymentSuccess`:
```javascript
await Cart.update(
    { status: 'converted' },
    {
        where: payment?.metadata?.cartId
            ? { id: payment.metadata.cartId, status: 'active' }
            : {
                userId: lockedOrder.userId, // lockedOrder.userId is null for guest orders!
                status: 'active',
            },
        transaction: t,
    }
);
```
**SQL Generated by Sequelize:**
```sql
UPDATE "carts" SET "status" = 'converted'
WHERE "user_id" IS NULL AND "status" = 'active';
```
**Impact:**
When any guest customer completes an online payment (Razorpay, Stripe, Cashfree, PayU), Sequelize updates all carts where `user_id IS NULL AND status = 'active'`. This wipes out the shopping carts of **every single concurrent guest user** browsing the website.
**Required Fix:**
```javascript
const cartWhere = payment?.metadata?.cartId
    ? { id: payment.metadata.cartId, status: 'active' }
    : lockedOrder.userId
        ? { userId: lockedOrder.userId, status: 'active' }
        : lockedOrder.guestSessionId
            ? { sessionId: lockedOrder.guestSessionId, status: 'active' }
            : null;

if (cartWhere) {
    await Cart.update({ status: 'converted' }, { where: cartWhere, transaction: t });
}
```

---

## 2. High Priority Issues (P1)

### P1-1: Guest Post-Checkout Navigation Redirects to Login

**Files affected:**
- `client/src/routes/AppRoutes.jsx:174–180`
- `client/src/pages/storefront/PaymentSuccessPage.jsx:114`

**Grounded Evidence:**
1. In `order.routes.js`, `GET /orders/:id` was updated to `optionalAuth`, allowing guests to view their order verification on `PaymentSuccessPage.jsx`.
2. However, in `PaymentSuccessPage.jsx`:
   ```javascript
   const orderDetailPath = orderId ? `/account/orders/${orderId}` : '/orders';
   ```
3. In `AppRoutes.jsx`:
   ```jsx
   <Route element={<ProtectedRoute />}>
     <Route path="account/orders/:id" element={<StoreOrderDetailPage />} />
     <Route path="orders" element={<AllOrdersPage />} />
   </Route>
   ```
**Impact:**
When a guest customer clicks "View Order Details" or "Track Package" on the order success screen, `ProtectedRoute` intercepts the route and redirects the guest to `/login`. Guests cannot track their order or view their order details once they navigate away from `/payment/success`.
**Required Fix:**
Provide a public guest order tracking page (e.g. `/orders/track/:id` or `/guest/orders/:id`) authenticated via session header or order lookup token.

---

### P1-2: COD Settlement Architecture Verification

**Files affected:**
- `server/src/modules/payment/payment.service.js:1197–1340` (`confirmCodPayment`)
- `server/src/modules/order/order.service.js:274–298` (`syncCodPaymentIfDelivered`)
- `server/src/modules/shipping/shipping.webhook.service.js:198–205`

**Grounded Evidence:**
- Initial audit assumed carrier delivery webhook should automatically set COD payments to `paid_cod`.
- Code inspection revealed an intentional operational distinction: Shiprocket courier delivery does not equal immediate cash remittance to merchant bank account (remittances occur on 3–7 day courier cycles).
- Delivery webhooks trigger `syncCodPaymentIfDelivered`, which logs that COD payment is eligible for collection.
- Actual cash receipt is verified by admin via `confirmCodPayment(actingUserId, orderId, { amount })` in `OrderDetailPage.jsx:1031`.
- Once fully collected, `confirmCodPayment` automatically transitions the order to `closed`.
- Prepaid orders are automatically closed via `syncOrderClosureIfComplete` upon delivery confirmation.

---

## 3. Verified Working Tree Fixes

The following 6 issues identified in preliminary audits were inspected and confirmed to be **already implemented** in the uncommitted working tree:

### 1. Inventory Restocked on Shipment Cancellation & Customer Returns (P1-1 Fix)
- **File:** `server/src/modules/order/order.service.js:3151, 3383`
- **Verification:** `updateShipmentStatus` now queries `ShipmentItem` and calls `restockOrderItemInventory` with `InventoryService.restockReturn` and restores variant reservation. Customer returns via `updatePutBackStatus` also call `restockOrderItemInventory`.
- **Unit Test:** `server/tests/unit/inventory.shipmentCancellation.test.js` passes (1/1).

### 2. Shiprocket Carrier Cancellation on Admin Cancel (P1-2 Fix)
- **File:** `server/src/modules/order/order.service.js:3048`, `shiprocket.provider.js:903`
- **Verification:** When admin cancels a booked shipment (`status: 'cancelled'`), `order.service.js` directly invokes `resolveProvider(provider).cancelShipment({ awbCode })`.
- `shiprocket.provider.js` calls `/orders/cancel/shipment/awbs` first and recognizes HTTP 204 or body success. If the route is explicitly unsupported (405/501 or a route-specific 404), it falls back to documented `POST /orders/cancel` with the Shiprocket order ID in `ids`; an AWB-not-found response, timeout, auth error, or carrier business rejection does not trigger fallback.

### 3. Exclusive Shipping Tax in Invoice and Admin UI (P1-4 Fix)
- **File:** `client/src/components/orders/order-detail/orderDetailUtils.js:88–91`
- **Verification:** `getTaxRows()` appends `{ label: 'Shipping tax', value: order.shippingTaxAmount }` whenever `shippingTaxIncluded !== true` and `shippingTaxAmount > 0`.
- Both `OrderDetailPage.jsx` and `OrderInvoicePage.jsx` import `getTaxRows()` and render the reconciled tax rows.

### 4. Quoted Courier vs Assigned Courier Drift (P2-1 Fix)
- **File:** `server/src/modules/shipping/providers/shiprocket.provider.js:828`
- **Verification:** `/courier/assign/awb` now explicitly receives `courier_id: Number(shipment.courierCompanyId)`.

### 5. Manifest & Carrier Invoice Download Controls in Admin UI (P2-2 Fix)
- **File:** `client/src/pages/admin/OrderDetailPage.jsx:1592–1601`
- **Verification:** "Download Manifest" (`manifestUrl`) and "Carrier Invoice" (`invoiceUrl`) links are rendered inside shipment cards.

### 6. Carrier Booking Failure Alert & Retry Button (P2-3 Fix)
- **File:** `client/src/pages/admin/OrderDetailPage.jsx:1570–1574, 1603`
- **Verification:** Carrier errors (`lastProviderError` / `operationError`) render a prominent `<Alert severity="error">`, and a "Retry carrier booking" button triggers `retryShippingOperation`.

---

## 4. ADR 0003 Rule Engine Compliance Verification

The shipping pricing rule engine implementation was audited against all clauses of ADR 0003:

| ADR 0003 Requirement | Code Implementation | Status |
|---|---|---|
| Order flat / % fee applied once | `shipping.service.js:810–835` | ✅ Compliant |
| Per-kg / volumetric fees summed per planned parcel | `shipping.packages.js:300–370` | ✅ Compliant |
| COD fee applied once per order | `shipping.service.js:920` | ✅ Compliant |
| 3D bin-packing parcel volume calculation | `shipping.packages.js:140–210` | ✅ Compliant |
| Pro-rated parcel subtotal / COD amount | `order.service.js:1944–1954` (`calculateShipmentAmounts`) | ✅ Compliant |
| Order shipping charge allocated only to first parcel | `allocateOrderShipping: priorShipmentCount === 0` | ✅ Compliant |
| Quote checksum integrity (SHA-256) | `shipping.service.js:680–710` | ✅ Compliant |

**ADR 0003 Compliance: 100% VERIFIED**

---

## 5. Test Suite Execution Results

All tests were executed on 2026-10-05:

- **Server Unit Tests:**
  `npm test -- --run`
  **481 passed, 0 failed** (47 test files, 11.77s)
- **Client Unit Tests:**
  `npm test -- --run`
  **92 passed, 0 failed** (23 test files, 22.28s)
- **Live Database Compatibility Check:**
  **FAILED**: PostgreSQL schema lacks `guest_session_id`, `idempotency_key`, `expires_at` due to unapplied migrations.

---

## 6. Comprehensive Recommended Remediation Plan

1. **Step 1 (Immediate Database Migration):**
   Run `npx sequelize-cli db:migrate` to align PostgreSQL with `order.model.js` and `payment.model.js`.
2. **Step 2 (P0-1 Fix):**
   Patch `Cart.update` in `payment.service.js:793` to condition guest cart conversion on `lockedOrder.guestSessionId`, preventing global cart wipes.
3. **Step 3 (P1-1 Route Fix):**
   Update `AppRoutes.jsx` to provide guest-accessible order tracking or allow `StoreOrderDetailPage` to load for guest sessions via `x-session-id`.
4. **Step 4 (Regression Tests):**
   Add end-to-end integration tests that run against the real PostgreSQL container rather than purely mocked Sequelize instances.
