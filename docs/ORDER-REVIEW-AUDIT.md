# Order + Review System Audit Report

## Overview

Full audit of the order lifecycle, review system, and their integration. Covers the order state machine, status fields, review creation flow, verified purchase detection, and all identified bugs.

---

## Table of Contents

1. [Order Model](#1-order-model)
2. [Order State Machine](#2-order-state-machine)
3. [Complete Order Lifecycle](#3-complete-order-lifecycle)
4. [Status Field Reference](#4-status-field-reference)
5. [Review System](#5-review-system)
6. [Bugs Found](#6-bugs-found)
7. [Recommended Fixes](#7-recommended-fixes)

---

## 1. Order Model

**File:** `server/src/modules/order/order.model.js`

### Fields

| Field | Type | Default | Valid Values | Notes |
|---|---|---|---|---|
| `id` | UUID | UUIDV4 | — | Primary key |
| `orderNumber` | STRING(50) | — | Unique | Format: `ORD-YYYYMMDD-XXXXXX` |
| `userId` | UUID | — | FK → User | |
| `status` | STRING(30) | `confirmed` | `ORDER_STATUS_VALUES` | Main order lifecycle |
| `orderShippingStatus` | STRING(50) | `not_shipped` | `ORDER_SHIPPING_STATUS_VALUES` | Derived from shipments |
| `putBackStatus` | STRING(50) | `null` | `PUT_BACK_STATUS_VALUES + null` | Derived from returns |
| `putBackProcessingStatus` | BOOLEAN | `false` | — | Derived from returns |
| `shipmentStatus` | STRING(50) | `pending` | **None (no validation)** | Zombie field — mirror of `orderShippingStatus` |
| `paymentMethod` | STRING(20) | `razorpay` | `razorpay, stripe, payu, cashfree, cod` | |

### Associations

- `Order.belongsTo(User)` — userId
- `Order.hasMany(OrderItem)` — as `items`
- `Order.hasOne(Payment)`
- `Order.hasMany(Fulfillment)` — as `fulfillments`
- `Order.hasMany(Shipment)` — as `shipments`
- `Order.hasMany(OrderReturn)` — as `returns`
- `Order.hasMany(OrderRefund)` — as `refunds`
- `Order.hasMany(OrderStatusHistory)` — as `statusHistory`
- `Order.hasMany(OrderHistory)` — as `history`

---

## 2. Order State Machine

**File:** `shared/order-workflow.json`

### Status Groups

#### Payment (6 statuses)
```
payment_pending → pending_cod → paid_cod, paid_online
                → payment_failed → payment_pending
                → payment_expired → payment_pending
```

#### Order (7 statuses)
```
pending_payment → processing → ready_for_shipment → closed
                → cancelled
confirmed → on_hold → processing → ready_for_shipment → closed
          → cancelled
```

#### Shipment (10 statuses)
```
created → packed → shipped → in_transit → out_for_delivery → delivered (terminal)
                                                           → delivery_failed → out_for_delivery
                                                                             → rto_initiated → rto_in_transit → rto (terminal)
```

#### Order Shipping — Derived (11 statuses)
```
not_shipped → partially_shipped → shipped → partially_out_for_delivery → out_for_delivery
           → partially_delivered → delivered
           → delivery_failed → partially_rto → rto_initiated → rto
```

**Display priority** (highest first):
`delivery_failed` > `rto_initiated` > `partially_rto` > `partially_out_for_delivery` > `out_for_delivery` > `partially_delivered` > `delivered` > `partially_shipped` > `shipped` > `not_shipped`

#### Return (15 statuses)
```
Return flow:  return_requested → return_approved → pickup_scheduled → pickup_completed → return_completed
Replacement:  replacement_requested → replacement_approved → replacement_processing → replacement_shipped → replacement_delivered → replacement_completed
```

#### Refund (5 statuses)
```
refund_initiated → refund_processing → refunded
                                     → refund_failed
                                     → partially_refunded
```

#### Put Back — Derived (4 statuses)
```
full_return, partial_return, full_replacement, partial_replacement
```

### Key Rules

| Rule | Condition |
|---|---|
| `can_create_shipment` | `order.status IN [processing, ready_for_shipment]` AND `payment.status IN [paid_online, pending_cod]` |
| `can_deliver` | `shipment.status = out_for_delivery` |
| `can_close_order` | Payment SETTLED (`paid_online`/`paid_cod`) AND Shipping TERMINAL (`delivered`/`rto`) |

### Terminal Statuses

- **Order terminal:** `cancelled`, `closed`
- **Shipment terminal:** `delivered`, `rto`

---

## 3. Complete Order Lifecycle

### Phase 1: Placement
- **COD:** `order.status = confirmed`, `payment.status = pending_cod`
- **Online:** `order.status = pending_payment`, no payment record yet
- `orderShippingStatus = not_shipped`
- Stock reserved (increment `reservedQty`)

### Phase 2: Payment
- **COD:** Admin collects cash → `payment.status = paid_cod`
- **Online:** Gateway webhook → `payment.status = paid_online` → admin moves order to `processing`

### Phase 3: Fulfillment
- Admin creates fulfillment (`createFulfillment`) → creates `Shipment` with status `created`
- Order status advanced from `processing` → `ready_for_shipment`
- `syncOrderShippingStatus` → derives `orderShippingStatus`

### Phase 4: Shipping
```
shipment: created → packed → shipped → in_transit → out_for_delivery → delivered
```
Each status update calls:
1. `syncOrderShippingStatus` — recomputes `orderShippingStatus`
2. `syncCodPaymentIfDelivered` — fires COD eligibility event
3. `syncOrderClosureIfComplete` — checks if order can auto-close

### Phase 5: Delivery
- All shipments `delivered` → `orderShippingStatus = delivered`
- **Product is fully delivered to customer**

### Phase 6: Closure (Auto)
Auto-closes when: Payment SETTLED + Shipping TERMINAL (`delivered` or `rto`)
Triggered by: `getOrderById`, `updateFulfillmentStatus`, `updateShipmentStatus`

### Phase 7: Returns / Refunds (Post-Delivery)
- Customer requests return/replacement
- Admin approves/rejects
- Refunds via `processRefund` (supports partial)
- `derivePutBackCache` updates `putBackStatus` and `putBackProcessingStatus`

---

## 4. Status Field Reference

### Server Utility Exports (`server/src/utils/orderWorkflow.js`)

| Helper | Returns |
|---|---|
| `normalizeOrderStatus(status)` | Maps legacy → current statuses |
| `deriveOrderShippingStatus(shipments)` | Computes `order_shipping` status from shipment array |
| `isPaymentSettled(status, provider)` | `true` if `paid_online` or `paid_cod` |
| `isShippingTerminal(status)` | `true` if `delivered` or `rto` |
| `canCloseOrder({order, payment, orderShippingStatus})` | Payment settled AND shipping terminal |
| `isRefundableOrderStatus(status)` | `true` for `closed`, `processing`, `ready_for_shipment` |
| `isCustomerCancelableOrderStatus(status)` | `true` for `confirmed`, `on_hold`, `processing` |
| `isFulfillableOrderStatus(status)` | `true` for `processing`, `ready_for_shipment` |

### Client Status Helpers

| File | Purpose |
|---|---|
| `client/src/utils/orderWorkflow.js` | Labels, colors, progress stepper, transition permissions |
| `client/src/utils/orderHelpers.js` | `getCustomerOrderDisplayStatus()` — simplified customer-facing vocabulary |

### Client Status Display Values

**Customer-facing display statuses** (from `orderHelpers.js`):
```
placed → pending_payment → processing → packed → shipped → out_for_delivery → delivered → cancelled
```

Note: `placed` is a client-only label; server does NOT have a `placed` status.

---

## 5. Review System

**Files:**
- `server/src/modules/review/review.model.js` — Model
- `server/src/modules/review/review.service.js` — Business logic
- `server/src/modules/review/review.controller.js` — Controller
- `server/src/modules/review/review.routes.js` — Routes
- `client/src/components/product/ReviewSection.jsx` — Client component
- `client/src/services/reviewService.js` — Client API
- `client/src/pages/admin/ReviewsPage.jsx` — Admin moderation

### Review Model

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | PK |
| `productId` | UUID | FK → Product (CASCADE) |
| `userId` | UUID | FK → User (CASCADE) |
| `orderId` | UUID | FK → Order (SET NULL), nullable |
| `rating` | INTEGER | 1-5 |
| `title` | STRING(255) | nullable |
| `body` | TEXT | nullable |
| `isVerifiedPurchase` | BOOLEAN | default false |
| `status` | STRING(20) | `pending`, `approved`, `rejected` |

**Unique constraint:** `(userId, productId)` — one review per user per product.

### Review Creation Flow

```
User clicks "Write a Review"
    ↓
Client fetches delivered orders: GET /orders?productId=X&orderShippingStatus=delivered&limit=1
    ↓
If order found → set hasPurchased=true, store orderId
    ↓
User submits review
    ↓
Server validates:
  1. Authentication + REVIEWS_CREATE permission
  2. Rate limit (5/day/IP)
  3. Duplicate check (unique userId + productId)
  4. Verified purchase check:
     a. If orderId provided: validate order exists, belongs to user, orderShippingStatus='delivered'
     b. If no orderId: auto-detect via Order.findAll(userId, orderShippingStatus='delivered', productId)
  5. If requirePurchaseForReview=ON and not verified → 403
  6. Create review with status='pending'
  7. Refresh product avg_rating + review_count cache
    ↓
Admin moderates: approve/reject/delete
    ↓
If approved → visible on product page, counted in avg_rating
```

### Feature Toggles (admin settings)

| Key | Default | Notes |
|---|---|---|
| `features.reviews` | `true` | Master ON/OFF for reviews |
| `features.requirePurchaseForReview` | `false` | Require verified purchase to review |

---

## 6. Bugs Found

### Fixed Bugs

| # | File | Lines | Description | Fix |
|---|---|---|---|---|
| F1 | `review.service.js` | 69, 85 | `status: 'delivered'` → should be `orderShippingStatus: 'delivered'` | Changed to `orderShippingStatus` |
| F2 | `order.controller.js` | 20 | Missing `orderShippingStatus` query param | Added destructuring + pass to service |
| F3 | `order.service.js` | 1293, 1308-1311 | Missing `orderShippingStatus` filter in `getOrders` | Added filter logic |
| F4 | `ReviewSection.jsx` | 73 | Client passed `status: 'delivered'` to API | Changed to `orderShippingStatus: 'delivered'` |

### Remaining Bugs

#### CRITICAL

| # | File | Lines | Description |
|---|---|---|---|
| C1 | `ReviewSection.jsx` | 119 | Review button hidden when `hasPurchased=false` even when `requirePurchaseForReview=OFF`. Should be `{(!requirePurchase \|\| hasPurchased) && (...)}` |
| C2 | `review.service.js` | 83-91 | Provided `orderId` not validated against product. User can pass any delivered orderId and get verified badge for wrong product |

#### HIGH

| # | File | Lines | Description |
|---|---|---|---|
| H1 | `review.service.js` | 69 | `partially_delivered` orders excluded. Customer who received some items cannot review |
| H2 | `review.service.js` | 69 | No alternative verification for digital products (no shipments → never `delivered`) |
| H3 | `review.service.js` | 69 | ~~No check on `order.status` or payment. Refunded/cancelled orders still yield verified reviews~~ Fixed: `Op.notIn: ['cancelled', 'refunded']` |
| H4 | `review.service.js` | 175 | `subQuery: !!search` inverted for aliased column filters; admin search by reviewer name likely broken |
| H5 | `order.service.js` | 699 | `return eventBuffer` dead code — coupon cleanup unreachable; cancelled orders permanently consume coupon usage |

#### MEDIUM

| # | File | Lines | Description |
|---|---|---|---|
| M1 | `AllOrdersPage.jsx` | ~70 | `STATUS_CONFIG` missing `on_hold` and `ready_for_shipment` — fall back to "Placed" |
| M2 | `orderHelpers.js` | 38 | `getCustomerOrderDisplayStatus` maps `closed` → `delivered`. Closed could be refunded/RTO |
| M3 | `ReviewSection.jsx` | 86 | `purchaseCheckError` set but never displayed. Silent failure |
| M4 | `AllOrdersPage.jsx` | ~49 | `closed` not in `ORDER_STATUSES` filter list |
| M5 | `order.model.js` | 77 | `shipmentStatus` is a zombie field — declared, no validation, never read |

#### LOW

| # | File | Lines | Description |
|---|---|---|---|
| L1 | `review.service.js` | 68 | `Order.findAll()` without LIMIT — fetches all delivered orders |
| L2 | `review.service.js` | 185-194 | Status counts query includes unnecessary JOINs |
| L3 | `PaymentSuccessPage.jsx` | ~170 | Shows UUID `orderId` instead of human-readable `orderNumber` |
| L4 | Multiple files | — | `PAYMENT_SETTLED_STATUSES` array duplicated in 3 places |
| L5 | `AllOrdersPage.jsx` | ~40 | Dead `userService` import |

---

## 7. Recommended Fixes

### Priority 1 — Critical Bugs

```javascript
// Fix C1: ReviewSection.jsx line 119
// Change from:
{hasPurchased && (
    <Button ...>Write a Review</Button>
)}
// Change to:
{(!requirePurchase || hasPurchased) && (
    <Button ...>Write a Review</Button>
)}
```

```javascript
// Fix C2: review.service.js — Add product validation in orderId check
// After line 85, before marking isVerifiedPurchase:
if (order) {
    const orderItem = await OrderItem.findOne({
        where: { orderId: order.id, productId },
        transaction: t
    });
    if (!orderItem) {
        orderId = null;
    } else {
        isVerifiedPurchase = true;
    }
}
```

### Priority 2 — High Bugs

```javascript
// Fix H1: review.service.js line 69 — Support partially_delivered
const { Op } = require('sequelize');
// ...
where: {
    userId,
    orderShippingStatus: { [Op.in]: ['delivered', 'partially_delivered'] }
}
```

```javascript
// Fix H5: order.service.js line 699 — Remove premature return
// Remove the `return eventBuffer;` on line 699 to allow coupon cleanup
```

### Priority 3 — Medium Bugs

- Add `on_hold`, `ready_for_shipment` entries to `STATUS_CONFIG` in `AllOrdersPage`
- Change `orderHelpers.js` closed mapping to display "Completed" or "Closed" instead of "Delivered"
- Display `purchaseCheckError` in ReviewSection UI
- Add `closed` to `ORDER_STATUSES` filter list
- Add comment to `shipmentStatus` field or remove it

---

## Quick Reference: Order Status ↔ Delivery State

| Order State | `order.status` | `orderShippingStatus` | Customer Can Review? |
|---|---|---|---|
| Placed (COD) | `confirmed` | `not_shipped` | No |
| Placed (Online) | `pending_payment` | `not_shipped` | No |
| Paid, Processing | `processing` | `not_shipped` | No |
| Shipped | `processing` | `shipped` | No |
| Out for delivery | `processing` | `out_for_delivery` | No |
| Some items delivered | `processing` | `partially_delivered` | No (bug H1) |
| All items delivered | `processing` | **`delivered`** | **Yes** |
| Delivered + Payment settled | `closed` | `delivered` | Yes |
| Cancelled | `cancelled` | varies | No (blocked) |
| RTO | `processing` | `rto` | No |
