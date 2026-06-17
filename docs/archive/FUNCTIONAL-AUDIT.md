# Functionality Audit Report: E-commerce Platform

## 1. Executive Summary

| Metric | Score |
| :--- | :--- |
| **Functionality Score** | 8.5/10 |
| **System Correctness** | High |
| **Major Risks** | Duplicate Orders, Stale Stock Reservations |

### Overall System Correctness
The system demonstrates a robust architectural foundation with clear module separation, atomic database operations for critical paths (stock reservation), and a strong focus on idempotency in payment processing. The use of Sequelize transactions across all business logic services ensures data integrity.

### Major Risks
1. **Duplicate Order Creation:** The system lacks an idempotency key for order placement, making it vulnerable to duplicate orders if a user double-submits the checkout form.
2. **Stale Stock Reservations:** Stock is reserved upon order creation (`pending_payment`). If a payment fails or is abandoned, there is no automated mechanism to release these reservations, potentially leading to artificial stock-outs.
3. **Cart Merge Inconsistency:** The guest-to-user cart merge process does not validate combined quantities against available stock, which could lead to overselling at the checkout stage.

---

## 2. Module-wise Analysis

### Product Management
* ✅ **Working Features:**
    * Product creation with automated slug generation and collision handling.
    * Variant management with strict attribute/value pair validation.
    * Rich-text sanitization for descriptions.
    * Soft deletion (paranoid) for products and variants.
* ❌ **Issues Found:**
    * None major in core logic.
* ⚠️ **Edge Case Failures:**
    * **Negative Stock:** While `stockQty` is an integer, there is no model-level or service-level check preventing an admin from setting a negative stock value during creation/update.
* 💡 **Recommendations:**
    * Add `min: 0` validation to `stockQty` in the `ProductVariant` model.
    * Implement a bulk inventory adjustment utility for warehouse operations.

### Cart System
* ✅ **Working Features:**
    * Atomic stock checks during `addItem` using `Transaction.LOCK.UPDATE`.
    * Session-based guest carts and user-based persistent carts.
    * Automatic removal of items if the underlying product is disabled or deleted during cart fetch.
* ❌ **Issues Found:**
    * **Merge Stock Validation:** `mergeGuestCart` combines guest and user items without checking if the total quantity exceeds available stock.
* ⚠️ **Edge Case Failures:**
    * **Zero/Negative Quantity:** `updateItem` does not explicitly block updating an item to a quantity of 0 or less (which should ideally trigger a removal or error).
* 💡 **Recommendations:**
    * Add a stock validation loop inside `mergeGuestCart`.
    * Enforce `quantity > 0` in `addItem` and `updateItem`.

### Checkout & Order System
* ✅ **Working Features:**
    * Atomic stock reservation using `reservedQty` with literal updates and conditional `where` clauses (`(quantity - reserved_qty) >= needed`).
    * Comprehensive tax calculation with state-based origin/destination logic.
    * Coupon resolution with multi-coupon support and usage tracking.
    * Address validation ensuring ownership.
* ❌ **Issues Found:**
    * **Missing Order Idempotency:** Rapid double-clicks on "Place Order" will create multiple distinct orders because the `orderNumber` is generated uniquely per request.
* ⚠️ **Edge Case Failures:**
    * **Reservation Leak:** Orders abandoned in `pending_payment` state keep stock reserved indefinitely.
* 💡 **Recommendations:**
    * Implement an `idempotencyKey` (passed from frontend) to prevent duplicate orders.
    * Implement a "Stock Reclaimer" background job to cancel expired `pending_payment` orders (e.g., after 30 minutes) and release reservations.

### Payment Flow
* ✅ **Working Features:**
    * Adapter-based support for Razorpay, Stripe, Cashfree, and PayU.
    * Idempotent webhook processing using a dedicated `WebhookEvent` table as a deduplication fence.
    * Secure handling of gateway credentials with DB-first reading and fallback to environment variables.
    * Order created *before* payment intent, allowing for payment retries without losing the order context.
* ❌ **Issues Found:**
    * None. The multi-gateway implementation is highly resilient.
* ⚠️ **Edge Case Failures:**
    * **Webhook/Redirect Race:** Handled correctly via transaction locking and status checks in `markOrderPaid`.
* 💡 **Recommendations:**
    * Add a "Payment Retry" endpoint for users to attempt payment again if the initial intent expires or fails.

---

## 3. Workflow Validation

| Flow | Result | Issues Found |
| :--- | :--- | :--- |
| **Complete Purchase** | ✅ PASS | Flow is consistent; stock deduction and order creation are atomic. |
| **Payment Failure** | ⚠️ PARTIAL | Order persists in `pending_payment` but stock remains reserved. |
| **Cart Merge** | ❌ FAIL | Possible to exceed stock limits during merge. |
| **Admin Workflow** | ✅ PASS | Product and order management reflect correctly across roles. |

---

## 4. Critical Bugs (Top Priority)

1. **[Logic] Cart Merge Stock Overrun:** `cart.service.js:mergeGuestCart` ignores stock limits.
2. **[Architecture] Duplicate Order Vulnerability:** No idempotency check in `order.service.js:placeOrder`.
3. **[Resource Management] Stock Reservation Leak:** No cleanup for `pending_payment` orders.

---

## 5. Missing Features / Gaps

* **Automated Stock Reclamation:** Vital for e-commerce to prevent "fake" stock-outs from abandoned carts/checkouts.
* **Order Idempotency:** Essential for handling network retries and double-submits.
* **Inventory Audit Log:** While general audit logs exist, a dedicated ledger for inventory changes (adjustments, sales, returns) would improve traceability.

---

## 6. Fix Recommendations

### Priority: High (Immediate Action)
1. **Implement Idempotency:** Add an `idempotency_key` column to the `orders` table. Frontend should generate a UUID when the checkout page loads and send it with `placeOrder`. Use a unique constraint to block duplicates.
2. **Harden Cart Merge:** Update `mergeGuestCart` to include a stock check loop. If stock is insufficient, adjust the quantity to the maximum available and notify the user.

### Priority: Medium (Next Sprint)
1. **Stock Reclaimer Job:** Create a background worker (or simple script) that finds orders in `pending_payment` status older than 30 minutes and calls `cancelOrder`.
2. **Model Validations:** Add `min: 0` and `min: 1` validations to `stockQty` and `CartItem.quantity` respectively.

---

## 7. Final Verdict

**Is the system functionally stable?** **YES**
**Safe for real users?** **YES**, provided that the duplicate order risk is mitigated (e.g., via frontend button disabling) and the stock reclamation issue is acknowledged as a manual management task for now.

The core business logic is sound, and the implementation follows high-standard patterns for data integrity and concurrency.
