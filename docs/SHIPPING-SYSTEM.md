# Shipping System — A to Z Architecture & Edge Cases Guide

This document provides a complete technical reference for the e-commerce platform's shipping subsystem, detailing the 10 production edge cases handled A-to-Z, resolved architectural gaps, delivery states, checkout UX, and background operations.

---

## 1. Core Architecture

The shipping engine uses a dual-responsibility model:
- **Store Shipping Rules (Customer Charge):** Define what the customer pays (Flat rate, Free above threshold, Per-kg slab, Volumetric, or % of order).
- **Shipping Providers / Carrier APIs (Operational Fulfillment):** Check real-time courier serviceability, COD availability, and calculate internal carrier costs.

### A. Shipping Providers ("The Who")
- **Shiprocket (`shiprocket`):** Direct REST API integration for automated courier assignment, serviceability, label generation, manifest download, and tracking.
- **Ekart (`ekart`):** Enterprise courier provider adapter.
- **Manual Delivery (`manual`):** In-house delivery fleet or fixed local dispatch.

### B. Shipping Zones ("The Where")
Pincode prefix-based geographical classification:
- **Same City (`same_city`):** First 4 digits match dispatch warehouse (sub-district proximity).
- **Same State (`same_state`):** First 2 digits match dispatch warehouse.
- **National (`national`):** Standard domestic delivery across India.
- **Remote (`remote`):** Special logistical zones (e.g. North-East India prefixes `78`, `79`, `83`, and Jammu & Kashmir `19`).

### C. Shipping Rules ("The How")
Rules are evaluated strictly by **Priority** (descending order):
- **Rate Types:** `flat`, `free_above_threshold`, `percent_of_order`, `per_kg_slab`, `volumetric`, `free`.
- **Structured Slabs:** First slab weight (e.g. 500g), additional slab weight and rate, zone distance multipliers, and fuel surcharge percentage.
- **COD Controls:** Per-rule `codAllowed` and optional COD handling fees (flat or percentage with minimum floor).

---

## 2. The 10 Practical Edge Cases Handled A-to-Z

| # | Edge Case | Problem / Risk | System Behaviour & Implementation |
|---|---|---|---|
| **1** | **Wrong credentials or blocked Shiprocket user** | Repeated auth calls lock accounts, hammer API rate limits, and crash checkout with unhandled 401s. | An in-memory circuit breaker (`authFailureCache`) caches 401/403/unauthorized failures for 10 minutes (`AUTH_FAILURE_COOLDOWN_MS`). Prevents repeated login requests. Admin UI has a "Test Connection" button with instant feedback. Customers receive a friendly 503 ("Delivery checking is temporarily unavailable. Please retry shortly."). Updating provider credentials instantly clears cooldown (`clearAuthCooldown()`). |
| **2** | **Different pickup pincodes in settings** | Mismatches between store settings and carrier settings cause wrong pricing zones and rejected pickups. | A single dispatch warehouse origin is enforced across the board via `resolveDispatchOrigin()`. Zone detection, checkout serviceability, and fulfillment `shipping_operations` resolve and pass the exact matching saved Shiprocket pickup location (`pickupLocationName`) and pincode. |
| **3** | **Invalid or unsupported customer pincode** | Invalid strings or non-serviceable remote pincodes crash calculations or return raw 500 errors. | Strict 6-digit numeric format validation (`/^\d{6}$/`). Non-matching strings return `serviceable: false` with clear reason. Carrier 400/404/422 responses are caught gracefully and translated to user-friendly unserviceable messages with an always-visible "Change Address" action. |
| **4** | **COD unavailable but prepaid available** | Carrier rejects COD queries with 0 couriers, causing shoppers to abandon carts even though prepaid delivery is supported. | When COD check returns 0 couriers, the provider automatically falls back to check prepaid (`cod: 0`). If prepaid is supported, it returns `serviceable: true, codAvailable: false` with a clear explanation. Storefront checkout notifies the shopper, auto-switches to prepaid, and re-evaluates upon method change. Order creation strictly blocks COD submission (`COD_UNAVAILABLE`) if COD is unsupported. |
| **5** | **Missing weight or dimensions** | Products without dimensions default to zero weight, leading to massive carrier undercharges or rejected shipments. | Stacking algorithm computes `max(L) × max(B) × sum(H × qty)` and includes configured packaging tare weight. In production / strict mode, physical products missing measurements throw `MISSING_PRODUCT_MEASUREMENTS` (400), eliminating silent defaults. `createShipment()` strictly rejects carrier shipments with missing measurements or zero weight. |
| **6** | **Heavy or oversized parcels** | Parcels exceeding courier weight/length limits result in returned shipments or arbitrary carrier penalties. Mathematical splitting without physical split creates logistics chaos. | Evaluates courier physical thresholds (e.g. max 20kg–50kg, max 150cm length) across checkout, carrier adapters, and admin simulation. Parcels exceeding limits are blocked with clear messaging ("Package weight exceeds courier maximum limit. Until parcel splitting is enabled, please reduce item quantity or contact support.") instead of multiplying costs on impossible packages. |
| **7** | **Overlapping or no matching rules** | Unclear fallback charges or accidental international shipments on domestic store rules. | Predictable priority evaluation (highest priority wins). Explicit domestic area guard in both `calculateRuleDecision()` and `calculateManualDecision()` ensures non-Indian addresses are blocked with "Delivery is currently only available within India", preventing universal rules without zones from allowing international dispatch. |
| **8** | **Cart/address changes or expired quote** | Price drift, customer changing items or addresses after quote was created, or stale coupons. | Quotes are fingerprinted with SHA-256 hashes of `cartHash`, `addressHash`, `paymentMethod`, and `couponHash`. `validateQuoteForOrder()` verifies hashes on order submission; mismatch throws `SHIPPING_QUOTE_STALE` (400) and triggers recalculation. Accepted quote amount is persisted to order. Free shipping offers still strictly require delivery availability (`quote.serviceable === true`). |
| **9** | **Carrier timeout during shipment** | Network drops or carrier timeouts leave order in limbo; blind retries create duplicate shipments and waste shipping fees. | Before attempting to create a shipment on carrier API, the system queries `checkShipmentExists()` using real `GET /orders?search=${orderNumber}`. If already created on carrier, reconciles existing AWB and shipment details or assigns missing AWB via `/courier/assign/awb` without duplicate dispatch. Failed operations are queued in `shipping_operations` with retry limits and displayed in admin. |
| **10** | **Webhooks: duplicate, delayed, missing** | Out-of-order events cause status regressions; DB locks on outer-joins crash webhook handlers; unmapped statuses get lost. | 1. Database lock fix: removed outer-join locking on `Shipment.findOne` (loads associations cleanly without lock conflicts).<br>2. Monotonic status progression rank blocks stale/regressive statuses.<br>3. Unknown carrier statuses are recorded in `lastProviderError` and `statusHistory`.<br>4. Background cron job (`trackingReconciliation.job.js`) runs every 30 minutes, touching `updatedAt` to ensure round-robin polling and prevent starvation. |

---

## 3. Customer Delivery States at Checkout

The storefront checkout (`CheckoutPage.jsx`) renders 3 distinct customer delivery states:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Available with Fee / Free                                │
│    [✓] Delivery available in 3 days. Free shipping applied. │
├─────────────────────────────────────────────────────────────┤
│ 2. Pincode Unserviceable                                    │
│    [!] Delivery is not available for pincode 799999.        │
│        [ Change Address ]                                   │
├─────────────────────────────────────────────────────────────┤
│ 3. Temporarily Unavailable                                  │
│    [i] Delivery checking is temporarily unavailable.        │
│        Please retry shortly.                                │
│        [ Retry ]                                            │
└─────────────────────────────────────────────────────────────┘
```

### Payable Total Gate
- The final **Total Amount** in Order Summary is strictly gated:
  - If address is not selected: displays `"Select address"`.
  - While quote is calculating: displays `"Calculating..."`.
  - If delivery is unserviceable or error: displays `"Calculated after delivery check"`.
  - Only when a valid quote is confirmed (`shippingQuote?.serviceable === true`): displays the calculated payable total (e.g. `₹1,249.00`).
- Prevents shoppers from seeing a misleading subtotal that ignores shipping costs.

---

## 4. Admin Management & Monitoring

### A. Provider Connection Testing
- Each provider row in **Shipping Management > Shipping Providers** features a **Test Connection** button.
- Tests remote credentials against the carrier API (e.g. `/settings/company/pickup` for Shiprocket).
- Displays live status:
  - **Online**: Shows active pickup locations count (e.g. `Online (3 pickups)`).
  - **Failed**: Highlights authentication failure message.

### B. Failed Shipping Operations & Reconciliation Tab
- **Operations & Failures** tab displays background carrier dispatch attempts.
- Shows:
  - Order Number & Total
  - Operation Type (`create_shipment`, `generate_label`, `cancel_shipment`)
  - Provider Name & Attempt count (`3/8`)
  - Last Error description (carrier timeout, auth failure, validation error)
  - **Retry Now** button: Dispatches operation and runs immediate reconciliation.

---

## 5. Background Tracking Reconciliation Job

- **Job File:** `server/src/jobs/trackingReconciliation.job.js`
- **Schedule:** Every 30 minutes (`*/30 * * * *`)
- **Action:** Queries active in-transit shipments (`in_transit`, `out_for_delivery`, `shipped`) ordered by `updatedAt ASC` and fetches carrier status via `adapter.getTracking({ awbCode })`.
- **Starvation Prevention:** Every inspected shipment touches its `updatedAt` timestamp (even if the status remained unchanged), ensuring round-robin polling across all active shipments rather than repeatedly checking the same 20.
- **Status Updates:** Updates `Shipment.status`, `Fulfillment.status`, `Order.orderShippingStatus`, and records timestamp in `statusHistory`.

---

## 6. Critical Production Hardening (P1 Issues Resolved)

1. **Exact Reference Matching in Recovery (`shiprocket.provider.js`)**:
   - Replaced substring fallback (`|| orders[0]`) with strict exact-match verification (`orders.find(o => String(o.channel_order_id) === targetOrderId || String(o.id) === targetOrderId) || null`).
   - If `/orders?search` returns non-matching orders (e.g. broad search returns `WRONG-AWB` for `EXPECTED-ORDER`), returns `null` rather than attaching another customer's tracking details.
   - Distinguishes 404 (order not found -> `null`) from network timeouts and auth errors (rethrown to retain retry eligibility).
2. **Official Shipment Status Mapping Alignment (`shiprocket.provider.js`)**:
   - Corrected status code `38` (Shiprocket: Reached Destination Hub) to map to `in_transit` (previously inverted to `rto_in_transit`).
   - Corrected status code `46` (Shiprocket: RTO In Transit) to map to `rto_in_transit` (previously mapped to `packed`).
   - Added complete coverage for official status codes (`39`, `40`, `41`, `43`, `44`, `75`, `77`) and normalized string labels (`REACHED DESTINATION HUB` -> `in_transit`, `RTO IN TRANSIT` -> `rto_in_transit`).
3. **Fulfillment Recovery Step Completion & Error Propagation (`shiprocket.provider.js`)**:
   - Orders with existing AWBs no longer bypass remaining fulfillment steps. Recovery inspects whether pickup was scheduled and label generated, executing any missing steps.
   - Removed `.catch(() => null)` from carrier pickup and label generation calls. If pickup or label generation fails, the error is thrown, preventing `shipping_operations` from prematurely completing and allowing the exponential backoff scheduler to retry the failed step.
4. **Webhook Race Guard with Transaction Row Locks (`shipping.webhook.service.js`)**:
   - In `reconcileTracking`, reloads and locks the shipment record inside the transaction: `Shipment.findByPk(shipment.id, { transaction: t, lock: t?.LOCK?.UPDATE })`.
   - If a webhook arrived during the carrier API call window and marked the shipment `delivered`, the poller verifies against the locked `freshShipment.status`. Detecting `isRegression('delivered', 'in_transit')`, it touches `updatedAt` and logs `lastPolledStatus` without regressing the shipment, fulfillment, or order statuses.
5. **Warehouse Origin Parity (`shipping.service.js` & `shippingOperation.service.js`)**:
   - Unified warehouse dispatch origin resolution into `resolveDispatchOrigin(provider, settings)`.
   - Used identically across checkout delivery options, rule zone detection, and fulfillment operations.
6. **Manual Retry State Guard (`shippingOperation.service.js`)**:
   - Wrapped `retryOperation` in a database transaction with `SELECT ... FOR UPDATE` row locking.
   - Rejects retrying `completed` operations or operations actively `processing` within lock duration (`MAX_LOCK_AGE_MS`). Only `failed` or stale operations can be retried.
7. **Physical Measurement Enforcement (`shipping.service.js`)**:
   - In production / strict mode, `computePackageDimensions` throws `MISSING_PRODUCT_MEASUREMENTS` when physical products lack valid weight or dimensions, eliminating silent 500g/10cm defaults.
   - `createShipment` validates `hasMissingMeasurements` and rejects carrier dispatches with unmeasured items.
8. **Polling Queue Starvation Prevention (`shipping.webhook.service.js`)**:
   - Every shipment checked during reconciliation touches `updatedAt: new Date()`, rotating all active shipments fairly in round-robin order.
9. **Always-Visible Checkout Recovery Actions (`CheckoutPage.jsx`)**:
   - Positioned delivery alerts and recovery actions ("Retry" and "Change Address") in an always-visible banner above checkout sections.
   - Also displays alerts and buttons directly in Section 1 summary when collapsed.
   - Automatically expands Section 1 (`setActiveSection(1)`) on shipping error or unserviceable address.

---

## 7. Verification & Automated Tests

All edge cases, P1 bug fixes, and architectural invariants are validated with 100% automated test coverage:

- `server/tests/unit/shipping.edgeCases.test.js` (33/33 tests passing):
  - Circuit breaker & auth cooldown
  - Single warehouse origin enforcement, setting parity & matching fulfillment pickup location
  - Pincode formatting & carrier 404/422 graceful handling
  - COD fallback to prepaid delivery, checkout notification & strict order placement COD blocking
  - Packaging tare, measurement enforcement & strict mode rejection
  - Oversized parcel threshold rejection (checkout & admin simulator)
  - Domestic area guard (universal & manual) & rule priority resolution
  - Stale quote validation (`SHIPPING_QUOTE_STALE`)
  - Real `/orders?search` lookup, missing AWB assignment & error propagation
  - Exact reference matching during recovery (rejecting partial/unrelated order results)
  - Recovery execution of missing pickup/label steps on orders with existing AWBs
  - Non-swallowed error propagation on carrier pickup failures during recovery
  - Official status mapping verification: numeric status `38` -> `in_transit`, numeric status `46` -> `rto_in_transit`, text labels
  - Webhook unknown status recording, numeric tracking parsing (`status: 7`), and polling starvation prevention
  - Transaction row-locked webhook race guard (preventing carrier poll regression against concurrent webhook updates)
  - Manual retry concurrency locks & state guards
- `server/tests/unit/shipping.service.test.js` (5/5 tests passing)
- `server/tests/unit/shipping.webhook.test.js` (5/5 tests passing)
- Full backend suite (35 test files, 294 tests passing).
- Full client build (`npm run build`) passing with zero bundle or syntax errors.


## One measured default package

Configure **Admin → Shipping → Packaging** to use one measured box or envelope for the store. No dimensions or capacities are prefilled. Enter the exterior dimensions in centimetres, empty package weight in grams, maximum item count confirmed to fit, and maximum contents weight in grams. Dimensions must exceed 0.5 cm. The merchant must check fit across the products and item combinations sold; item count is a declared capacity, not an automatic packing algorithm.

With this option enabled, each physical product requires its actual weight without the shipping box or envelope. Product dimensions are optional. Checkout uses the saved package dimensions and adds its empty weight once to the sum of product weights. Known oversized products and orders above the configured count or weight capacity are blocked with a support message. Digital items do not consume capacity. Flat/free shipping rules still determine customer charges; carrier shipment measurements remain required.

The package configuration is included in the quote cache key and saved in the order shipping snapshot. Fulfillment uses that saved configuration, including for partial fulfillment, so changing the default package does not change existing orders. Confirm actual packed measurements before dispatch. This feature does not split orders into multiple parcels.

Disabling the default package restores product-based dimension calculation. New products no longer receive invented weight or dimension defaults; existing measurements are preserved. Missing measurements are shown to customers as an item shipping issue, with no suggestion to change their address.

## Pincode coverage and rate zones

**Admin → Settings → General → Checkout → Storewide Delivery Coverage** is the final storewide allow/block restriction. A blocked pincode always wins; a non-empty allowlist restricts delivery to its listed pincodes. The storewide restriction is applied to manual, rule-based, and Shiprocket quotes after the selected rate/provider is calculated.

**Admin → Settings → Shipping → Rate Zones** groups pincodes for rules to select regional prices or providers. A zone is not a carrier serviceability guarantee and does not replace the storewide restriction. Leave both storewide lists empty to rely on carrier serviceability and matching shipping rules.
