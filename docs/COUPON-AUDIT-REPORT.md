# Coupon Functionality Audit Report

## 1. Schema & Database Models
The coupon system relies on two core models: `Coupon` and `CouponUsage`.

- **`Coupon` Model (`server/src/modules/coupon/coupon.model.js`)**: 
  - Supports three discount types: `percentage`, `fixed_amount`, and `free_shipping`.
  - Comprehensive configuration options for applicability (`applicableTo`, `applicableIds`, `excludedProductIds`, `excludeSaleItems`).
  - Robust limitations configuration (`minOrderAmount`, `maxDiscount`, `usageLimit`, `perUserLimit`).
  - Stacking rules (`allowOrderDiscounts`, `allowShippingDiscounts`, `allowMultipleCoupons`) are implemented to handle multi-coupon scenarios.
  - Required User Rules constraint (`coupons percentage CHECK <= 100`) is respected and validated on both database level (via migration) and application level.
- **`CouponUsage` Model (`server/src/modules/coupon/couponUsage.model.js`)**:
  - Acts as a junction table linking a `Coupon` to a `User` and an `Order`. This correctly enables per-user usage tracking and prevents abuse.

## 2. Business Logic & Services
The core logic resides in `server/src/modules/coupon/coupon.service.js`.

- **Validation (`assertCouponRules`, `assertCouponIsUsable`)**:
  - Correctly verifies that percentage values do not exceed 100%.
  - Free shipping validation ensures value is `0`.
  - Validates active dates, usage limits (`usedCount` vs `usageLimit`), and user-specific limits (`CouponUsage.count`).
  - `first_order` eligibility strictly counts previous `completed` or `delivered` orders, properly ignoring failed/pending ones so users don't lose their first-order discount due to a payment failure.
- **Evaluation (`evaluateCouponAgainstContext`)**:
  - Correctly filters cart items based on the coupon's inclusion (`applicableIds`) and exclusion (`excludedIds`) criteria for Products, Categories, and Brands.
  - Ignores items flagged as `isSaleItem` if `excludeSaleItems` is enabled.
  - Automatically caps percentage discounts at `maxDiscount` if specified.
- **Stacking Logic (`chooseStackedEvaluations`)**:
  - Elegantly handles automatic/suggested coupons in combination with manual coupons.
  - `canStackPair` strictly enforces stacking rules between multiple applied coupons to prevent unintended discount combinations.

## 3. Order Integration
Coupons are deeply integrated into the checkout flow (`server/src/modules/order/order.service.js`).

- **Order Placement**: 
  - `CouponService.resolveCoupons` is called during checkout to evaluate all requested codes alongside auto-applicable coupons against the actual cart content and shipping cost.
  - Generates the final `discountAmount` applied to the order total.
  - Within the order transaction, `CouponUsage.create` is invoked for each applied coupon, and the `Coupon.usedCount` is atomically incremented (`used_count + 1`).
- **Order Cancellation**:
  - `releaseOrderReservationsAndCoupons` handles order rollback (e.g., when an order is cancelled). It properly deletes the associated `CouponUsage` records and decrements `Coupon.usedCount` (`GREATEST(used_count - 1, 0)`), restoring the coupon for future use.

## 4. Admin Dashboard
The admin UI (`client/src/pages/admin/CouponsPage.jsx`) provides full CRUD operations.

- **Form Validation**: Accurately mirrors backend requirements. Catches logical conflicts before submission (e.g., trying to include and exclude the exact same product).
- **Offer Preview**: Real-time generation of a "Promotion Summary" string based on the active form state.
- **DataGrid**: Clear visualization of usage stats (`usedCount` / `usageLimit`), visibility, and lifecycle status.

## 5. Storefront Integration
- **Cart & Checkout** (`CartPage.jsx`, `CheckoutPage.jsx`):
  - Fetches eligible coupons dynamically via `getEligibleCoupons`.
  - Displays auto-applied coupons and suggests the best available coupon if no manual code is entered.
  - Honors the `showAvailableCoupons` feature flag to toggle public visibility.

## 6. Background Jobs
- **`couponExpiry.job.js`**: A cron job runs daily at midnight, marking any coupon where `end_date` is past the current date as `is_active: false`. This provides a solid safeguard for expired campaigns.

## Conclusion & Recommendations
The coupon system is exceptionally comprehensive, robust, and correctly implements the business rules, including multi-tier targeting, stacking rules, and automated evaluation.

**Minor Recommendations for Future Enhancements:**
1. **Validation Schema Consistency**: `coupon.validation.js` validates `value: Joi.number().min(0).required()`. Since percentage coupons are constrained to `<= 100` via the DB and `coupon.service.js`, the system is safe. However, updating the Joi schema to strictly enforce `.max(100)` when `type === 'percentage'` would allow the API to fail faster with a standard validation response format.
2. **Order Failures**: While `releaseOrderReservationsAndCoupons` exists, ensure it is hooked into the payment failure webhook or a background job that cleans up stale `pending` orders, so that coupon usage slots aren't permanently consumed by abandoned checkouts.
