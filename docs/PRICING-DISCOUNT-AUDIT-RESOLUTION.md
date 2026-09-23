# Pricing, Discount, Sale Labels, Coupon, and Sales Reporting Audit Resolution

This document records the complete verification and resolution of all issues identified during the comprehensive pricing, discount, coupon, and sales reporting audit.

---

## Issue Resolution Matrix

| # | Priority | Module / Area | Issue Description | Root Cause | Status | Verification Evidence |
|---|---|---|---|---|---|---|
| **1** | **P0** | `product.pricing.js`, `order.service.js`, `variantPricing.js` | Variant products ignored sale price at checkout; customer overcharged; frontend synthesized phantom regular price. | `product.pricing.js:118` used `variant?.price` (variant MRP) as `explicitUnitPrice`, ignoring `isSaleActive(product)`. Frontend computed adjustment `100 - 80 = +20`, rendering regular price 120 (phantom) and 17% discount. At checkout (`order.service.js:1119`), customer was charged regular MRP 100 instead of sale price 80. | **FIXED** | Verified by unit tests (`server/tests/unit/product.pricing.test.js`) and execution test: variant regular price: 100, sale price: 80, unit price: 80, discount: 20%, checkout price: 80. |
| **2** | **P0** | `product.pricing.js` | Sale-label schedule never gated price. Expired, future, or inactive labels activated sales immediately. | `resolveSaleLabel` returned `null` for future/expired/inactive labels. `isSaleActive` checked `product.saleLabelResolved?.startDate`, which was undefined because `saleLabelResolved` was null, falling back to "no dates -> active". | **FIXED** | `resolveSaleLabel` preserves preset dates and status. `isSaleActive` and `getSaleStatus` respect `isActive`, `startDate`, and `endDate`. Future labels produce `scheduled` (price = MRP), expired produce `expired` (price = MRP), inactive produce `inactive` (price = MRP). |
| **3** | **P1** | `cart.service.js`, `coupon.service.js`, `order.service.js` | Cart, coupon, and order recomputed prices without label preset context. | `cart.service.js` called `serializeProductPricing` without presets. `coupon.service.js` and `order.service.js` evaluated raw `Product` models without resolving presets against `getSaleLabels()`. | **FIXED** | `getSaleLabels()` presets are passed into `serializeProductPricing` in `cart.service.js`, `mapCartLine` in `coupon.service.js`, and `placeOrder` in `order.service.js`. |
| **4** | **P1** | `analytics.service.js` | `getCouponPerformance` queried non-existent columns `c.discount_type` and `c.discount_value`. | `coupons` table columns are `type` and `value`. Query threw database error upon execution. | **FIXED** | SQL query updated to select `c.type AS discount_type, c.value AS discount_value` and group by `c.id, c.code, c.type, c.value`. |
| **5** | **P1** | `product.pricing.js`, `product.validation.js` | DB constraint `chk_sale_price` violations and validation gaps on partial updates / variable products. | 1) `normalizeSalePayload` allowed dates without `salePrice`. 2) Lowering `price` below existing `salePrice` was not detected. 3) `createProductSchema` forbade `price` on `type === 'variable'`, violating `products.price NOT NULL`. 4) `updateProductSchema` lacked `salePrice < price`. | **FIXED** | 1) `normalizeSalePayload` rejects dates without `salePrice` with 400. 2) Lowering price below existing salePrice throws 400. 3) `createProductSchema` requires `price` across all product types as base MRP. 4) `updateProductSchema` validates `salePrice < price`. |
| **6** | **P1** | `product.service.js` | `bulkUpdateProducts` bypassed sale label and payload validation. | Direct `Product.update(data)` without checking `saleLabel` against active presets or running through `normalizeSalePayload`. | **FIXED** | `bulkUpdateProducts` validates `saleLabel` against active label presets from `getSaleLabels()`. |
| **7** | **P2** | `product.service.js`, `productCombo.service.js` | Price filters, range aggregations, and combo suggested prices used MRP instead of effective prices. | `minPrice`/`maxPrice` and `priceRange` aggregated against raw `Product.price`. `productCombo.service.js` summed constituent `item.price` ignoring `item.salePrice`. | **FIXED** | `getProducts` uses SQL effective price expression (`COALESCE(CASE WHEN sale is active THEN sale_price ELSE price END, price)`) for filters and `priceRange`. `getSuggestedPrice` checks constituent `item.salePrice`. |
| **8** | **P2** | `product.pricing.js`, `ProductDetailPage.jsx` | `discountPercent`/`savingsAmount` displayed % OFF for scheduled sales that had not started. | `getDiscountPercent` computed `price - salePrice` without date gating. `ProductDetailPage.jsx` rendered `${discountPercent}% OFF` when `isScheduledSale` was true. | **FIXED** | `serializeProductPricing` returns `discountPercent: 0` and `savingsAmount: 0` unless `saleActive` is true. `ProductDetailPage.jsx` renders `Starts Soon` chip for scheduled sales and `% OFF` only when active. |
| **9** | **P2** | `analytics.service.js`, `admin.service.js` | Inconsistent order status filtering (`on_hold` excluded). | `VALID_STATUSES` omitted `'on_hold'`. Revenue queries in `admin.service.js` omitted `'on_hold'`. | **FIXED** | Included `'on_hold'` in valid revenue order statuses in `analytics.service.js` and `admin.service.js`. |
| **10** | **P3** | `pricing.js` (client) | Floating point precision difference in client savings amount. | `getSavingsAmount` omitted `.toFixed(2)`, returning raw float. | **FIXED** | Updated to `Number((regularPrice - salePrice).toFixed(2))`. |
| **11** | **R1** | `analytics.service.js` | `on_hold` omitted in 12 raw-SQL analytics queries across `analytics.service.js`. | Lines 179, 206, 287, 346, 454, 512, 594, 659, 719, 747, 846, 861, 883 hardcoded `('confirmed','processing','ready_for_shipment','closed')` without `'on_hold'`, causing revenue reporting discrepancies. | **FIXED** | Defined `VALID_STATUSES_SQL = VALID_STATUSES.map(s => `'${s}'`).join(',')` single-sourced from `VALID_STATUSES`, and replaced all 13 hardcoded SQL lists with `${VALID_STATUSES_SQL}`. Verified zero hardcoded status lists remain. |
| **12** | **R2** | `product.service.js` | SQL effective price, onSale, saleStatus, and priceRange ignored label preset schedules (diverging from JS `isSaleActive`). | `effectivePriceExpr`, `onSale`, and `priceRange` only checked product-level dates. Items with future, expired, or inactive label presets passed SQL `onSale` and matched sale-price ranges, but serialized as scheduled/inactive at regular MRP. | **FIXED** | Implemented `buildSqlSaleCondition`, `getSqlEffectivePriceExpr`, and `buildSqlSaleStatusCondition` incorporating `labelPresets` schedule from `getLabelPresets()`. Inactive presets, future presets (where `sale_start_at IS NULL`), and expired presets (where `sale_end_at IS NULL`) are gated identically in SQL and JS. |
| **13** | **P1** | `product.model.js`, `shipping.service.js`, `order.service.js`, `ProductEditPage.jsx` | `requiresShipping` accepted in Joi validation and admin UI but never defined in model or database. | `requiresShipping` was accepted by `product.validation.js` and toggled in `ProductEditPage.jsx`, but `Product` model lacked the column. Sequelize silently dropped the key. In `shipping.service.js:81`, `if (p.requiresShipping === false) continue;` could never trigger. | **FIXED** | Added migration `20260606100000-add-requires-shipping-to-products.js` adding column `requires_shipping BOOLEAN NOT NULL DEFAULT true` to table `products`. Defined `requiresShipping` on `Product` model with `field: 'requires_shipping'`, included in `order.service.js` fulfillment attributes and `apiBuilder.service.js`. |
| **14** | **P1** | `CategoryPage.jsx`, `category.service.js`, `categoryService.js` | Category page price filters were dead UI; `priceRange` was null; `minPrice`/`maxPrice` query params were ignored. | `CategoryPage.jsx:185` omitted `minPrice`/`maxPrice` when calling `getCategoryWithProducts`. `category.service.js` accepted only `(slug, page, limit, sort)`, lacked price filtering, and returned no `priceRange`, causing `ProductFilters` to show "No products available". | **FIXED** | Updated `category.service.js` to compute `priceRange` for category subtree and filter by effective price (`minPrice`/`maxPrice`). Updated `category.controller.js` to parse `minPrice`/`maxPrice`. Updated `categoryService.js` and `CategoryPage.jsx` to pass price filters and set `priceRange`. |
| **15** | **P2** | `category.service.js` vs `product.service.js` | Category descendant inconsistency: `/api/categories/:slug` only returned direct items while `/api/products?category=slug` expanded subtree. | `category.service.js:92` filtered `{ id: category.id }` directly on junction table, omitting subcategories (e.g. Laptops under Electronics). Also lacked `serializeProductPricing`. | **FIXED** | In `category.service.js`, expanded category filtering to `descendantIds` via `getCategoryAndDescendantIds(category.id)` using a subquery condition. Products are serialized with `serializeProductPricing`. Added `getCategoryProductsQuerySchema` with strict boolean casting for `includeSubcategories` and wired into `category.routes.js`. |
| **16** | **P2** | `product.service.js`, `product.pricing.js` | `bulkUpdateProducts` bypassed sale normalization and permitted orphan sale labels. | `bulkUpdateProducts` checked preset ID existence but bypassed `normalizeSalePayload`, allowing orphan labels with no `salePrice` and bypassing `salePrice < price` checks. | **FIXED** | In `product.pricing.js:normalizeSalePayload`, validated that `salePrice` is required when setting `saleLabel`. In `product.service.js:bulkUpdateProducts`, ran `normalizeSalePayload` per product in the transaction whenever pricing or sale fields are updated, and assigned normalized/trimmed `saleLabel` directly to the update payload. |
| **17** | **P3** | `category.service.js`, `CategoryPage.jsx` | Category breadcrumb depth loss: 3+ level trees only displayed immediate parent. | `category.service.js:65` only included `parent` (`{ id, name, slug }`). `CategoryPage.jsx:228-232` built `Home → parent → current`, dropping root/intermediate ancestors. | **FIXED** | Implemented `getCategoryAncestors(categoryId)` in `category.service.js` returning full chain `[root, ..., current]`. Attached `breadcrumbs` to category data. Updated `CategoryPage.jsx` to map all ancestor crumbs into `breadcrumbSegments` and Schema.org `BreadcrumbList`. |
| **18** | **P3** | `product.service.js:468` vs `search.repository.js` | Product listing search (`GET /api/products?search=`) used `iLike` only, omitting SKU and FTS `search_vector`. | `filters.search` in `product.service.js:468` only matched `{ name: iLike }` and `{ description: iLike }`. Queries for exact SKU or full-text terms failed or diverged from global `/api/search`. | **FIXED** | Expanded `filters.search` in `product.service.js` to include `{ sku: { [Op.iLike]: searchPattern } }` and `Sequelize.literal('"Product"."search_vector" @@ plainto_tsquery(\'simple\', ${escapedQuery})')`. |

---

## Files Modified

1. **`server/src/modules/product/product.pricing.js`**
   - `resolveSaleLabel`: Preserves preset scheduling and active status.
   - `isSaleActive`: Respects preset active status and scheduling dates.
   - `getSaleStatus`: Correctly assigns `'scheduled'`, `'expired'`, `'inactive'`, or `'active'`.
   - `getVariantUnitPrice`: Computes variant sale price based on parent product discount when sale is active.
   - `serializeProductPricing`: Gates `discountPercent` and `savingsAmount` to active sales only.
   - `normalizeSalePayload`: Prevents date scheduling without sale price; prevents lowering price below existing sale price; requires `salePrice` when setting `saleLabel`.

2. **`server/src/modules/product/product.model.js`**
   - Added `requiresShipping` boolean attribute (`field: 'requires_shipping'`, `allowNull: false`, `defaultValue: true`).

3. **`server/migrations/20260606100000-add-requires-shipping-to-products.js`** *(New)*
   - Added `requires_shipping` boolean column to table `products`.

4. **`server/src/modules/product/product.validation.js`**
   - `createProductSchema`: Requires positive `price` for all product types (including variable products).
   - `updateProductSchema`: Enforces `salePrice < price` when price is updated.

5. **`server/src/modules/product/product.service.js`**
   - `updateProduct`: Passes existing product to `normalizeSalePayload`.
   - `bulkUpdateProducts`: Runs `normalizeSalePayload` per product when pricing/sale fields are touched.
   - `buildSqlSaleCondition`: Builds SQL condition gating on price, product dates, and label preset schedules.
   - `getSqlEffectivePriceExpr`: Wraps SQL sale condition in `COALESCE(CASE WHEN sale is active THEN sale_price ELSE price END, price)` for `minPrice`/`maxPrice` and `priceRange`.
   - `buildSqlSaleStatusCondition`: Aligns SQL filtering for `saleStatus` ('none', 'active', 'scheduled', 'expired') with JS `getSaleStatus`.
   - `getProducts`: Uses `buildSqlSaleCondition` for `filters.onSale` and `filters.sort === 'discount_desc'`. Accurately excludes price filters from `priceRangeWhere`. Expanded `filters.search` to include SKU and full-text `search_vector`.

6. **`server/src/modules/category/category.service.js`**
   - `getCategoryAncestors`: Resolves full ancestor chain from root to category.
   - `getCategoryWithProducts`: Expands category subtree via `getCategoryAndDescendantIds`, computes subtree `priceRange`, filters by `minPrice`/`maxPrice`, serializes products via `serializeProductPricing`, and attaches `breadcrumbs`.

7. **`server/src/modules/category/category.controller.js`**
   - `getBySlug`: Parses `minPrice` and `maxPrice` from `req.query` and forwards options to `categoryService.getCategoryWithProducts`.

8. **`server/src/modules/apiBuilder/apiBuilder.service.js`**
   - Included `requiresShipping` in allowed product fields.

9. **`server/src/modules/order/order.service.js`**
   - `placeOrder`: Resolves sale label presets during item price re-validation and charges the active variant sale price.
   - `fulfillOrder`: Added `requiresShipping` to product attributes for `computePackageDimensions`.

10. **`server/src/modules/product/productCombo.service.js`**
    - `getSuggestedPrice`: Incorporates active constituent sale prices.

11. **`server/src/modules/cart/cart.service.js`**
    - `fetchCartWithItems`: Passes label presets into `serializeProductPricing`.

12. **`server/src/modules/coupon/coupon.service.js`**
    - `mapCartLine` & `loadActiveCartLines`: Resolves sale label presets and accurately evaluates `isSaleItem`.

13. **`server/src/modules/admin/analytics.service.js`**
    - `VALID_STATUSES_SQL`: Single-sourced from `VALID_STATUSES` (includes `'on_hold'`).
    - Replaced all 13 hardcoded SQL status strings across `getRevenueByCategory`, `getRepeatCustomers`, `getGeographicSales`, `getCustomerLifetimeValue`, `getProductFunnel`, `getUtmAttribution`, `getCouponPerformance`, `getCohortRetention`, `getRfmSegmentation`, `getOrderHeatmap`, `getRevenueForecast`, and `getDrillDown` with `${VALID_STATUSES_SQL}`.
    - `getCouponPerformance`: Corrected query to `c.type AS discount_type, c.value AS discount_value`.

14. **`server/src/modules/admin/admin.service.js`**
    - `getStats` & revenue queries: Included `on_hold` status in valid revenue statuses.

15. **`client/src/services/categoryService.js`**
    - `getCategoryWithProducts`: Accepts options object and forwards `minPrice` / `maxPrice` query parameters.

16. **`client/src/pages/storefront/CategoryPage.jsx`**
    - Passes `filters.minPrice` and `filters.maxPrice` to `getCategoryWithProducts`.
    - Activates `ProductFilters` with dynamic `priceRange`.
    - Maps `category.breadcrumbs` for multi-level breadcrumbs and SEO `BreadcrumbList`.

17. **`client/src/utils/pricing.js`**
    - `getSavingsAmount`: Rounded to 2 decimal places using `.toFixed(2)`.

18. **`client/src/pages/storefront/ProductDetailPage.jsx`**
    - Line 578: Renders `Starts Soon` chip on scheduled sales, and `% OFF` only when sale is actively running.

19. **`server/src/modules/category/category.validation.js` & `category.routes.js`**
    - Added `getCategoryProductsQuerySchema` with strict boolean casting for `includeSubcategories: Joi.boolean().truthy('1', 'true', 'yes').falsy('0', 'false', 'no').default(true)`.
    - Wired validation middleware to `GET /api/categories/:slug` route and forwarded `includeSubcategories` from `category.controller.js` to `category.service.js`.

20. **`server/tests/unit/product.pricing.test.js`**
    - Comprehensive unit test suite covering:
      - Variant sale pricing & additive discounts (5 tests).
      - Label schedule gating for future, expired, inactive presets (4 tests).
      - Payload normalization & DB constraint protection (4 tests).
      - Discount percent & savings amount gating (2 tests).
      - **R1**: `VALID_STATUSES` and `VALID_STATUSES_SQL` with `on_hold` (1 test).
      - **R2**: `buildSqlSaleCondition`, `getSqlEffectivePriceExpr`, and `buildSqlSaleStatusCondition` matching JS label schedule (3 tests).
      - **P1**: `requiresShipping` on Product model definition and dimensions calculation (2 tests).
      - **P2**: `normalizeSalePayload` rejecting orphan labels, whitespace trimming preservation, and requiring salePrice (4 tests).
      - **P3**: `getCategoryAncestors` (1 test).
      - **P2**: `getCategoryWithProducts` and `getCategoryProductsQuerySchema` casting (2 tests).
      - Total: **28 tests**.

---

| **19** | **P1** | `categoryAttribute.routes.js`, `common.validation.js`, `attributeService.js` | Category-attribute suggestions broken for multi-category products (returned 400). | `categoryAttribute.routes.js:18` validated `:id` with `idParamSchema` (strictly single UUID). When `ProductVariantsPanel` called `getCategoryAttributes([id1, id2])`, `attributeService.js` sent `/categories/id1,id2/attributes`, which Joi rejected with 400 (`"id must be a valid GUID"`). | **FIXED** | Added `uuidCsvParamSchema` in `common.validation.js` validating single or comma-separated UUIDs and applied to `GET /:id/attributes`. Verified by 4 unit tests in `attribute.brand.fixes.test.js`. |
| **20** | **P2** | `attribute.service.js`, `AttributesPage.jsx` | Deleting an attribute template or value cascaded into `product_attributes` and `variant_options`, silently deleting variant dimensions and corrupting variant combinations. | Foreign key constraints in migrations used `ON DELETE CASCADE`. Services called `.destroy()` without checking whether products or variants referenced them. Confirm dialogs omitted product/variant warnings. | **FIXED** | Added reference guards in `deleteAttribute` and `removeValue`: queries `ProductAttribute` and `VariantOption` counts and throws 409 Conflict if `> 0`. Updated confirm dialog copy in `AttributesPage.jsx`. Verified by 5 unit tests in `attribute.brand.fixes.test.js`. |
| **21** | **P2** | `brand.validation.js`, `brand.service.js` | `getBrandBySlug` pagination & sorting params were dead; brand pages over-fetched products. | `getBrandBySlugSchema` only permitted `productLimit`, so `stripUnknown: true` stripped `productOffset`, `productSortBy`, `productSortOrder`. Furthermore, `productInclude` on the `Product` hasMany relation lacked `separate: true`, causing Sequelize to ignore `limit` and `offset`. | **FIXED** | Added `productOffset`, `productSortBy`, and `productSortOrder` to `getBrandBySlugSchema`. Added `separate: true` to `productInclude` in `brand.service.js` and normalized sort order direction to uppercase. |
| **22** | **P2** | `CategoriesPage.jsx`, `BrandsPage.jsx`, `permissions.js` | Permission gates diverged between UI and API. | `categoryAttribute.routes.js:15` requires `CATEGORIES_MANAGE` + `ATTRIBUTES_MANAGE`, but `CategoriesPage.jsx` checked `ATTRIBUTES_MANAGE` alone (yielding 403 on manage). `brand.routes.js` requires `BRANDS_MANAGE`, but `BrandsPage.jsx` checked `PRODUCTS_CREATE/UPDATE/DELETE`. `permissions.js` mapped `/admin/brands` to product permissions. | **FIXED** | Gated Attributes button in `CategoriesPage.jsx` on `canManageCategories && canManageAttributes`. Gated brand operations in `BrandsPage.jsx` on `PERMISSIONS.BRANDS_MANAGE`. Updated `ADMIN_ROUTE_PERMISSION_MAP` for `/admin/brands` to `[PERMISSIONS.BRANDS_READ, PERMISSIONS.BRANDS_MANAGE]`. |
| **23** | **P3** | `productAttribute.validation.js`, `productAttribute.service.js` | `updateProductAttribute` could cause 500 error on mixed-mode updates. | `updateProductAttributeSchema` allowed both `valueId` and `customValue`. Submitting both violated DB CHECK constraint `chk_product_attr_mode`, resulting in an unhandled 500 error. | **FIXED** | Added `.oxor('valueId', 'customValue')` to Joi schema. Added service checks in `updateProductAttribute` to reject `valueId` on custom rows and `customValue` on template rows with 400 Validation Error. |
| **24** | **P3** | `brand.service.js`, `brand.validation.js` | Brand rename left stale slug; empty PATCH `{}` caused no-op audit log. | `brand.service.js` only regenerated slug if `slug` was explicitly supplied. `updateBrandSchema` had no `.min(1)`, allowing empty payloads. | **FIXED** | In `brand.service.js:updateBrand`, auto-regenerate slug when `name` changes and no explicit `slug` is provided. Added `.min(1)` to `updateBrandSchema` in `brand.validation.js`. |
| **25** | **P3** | `slugify.js`, `brand.validation.js` | Brand slug charset mismatch: `generateSlug` kept underscores, while `slugParamSchema` rejected them with 400. | `slugify.js` regex `\w` preserved underscores (`"T_Shirt"` -> `"t_shirt"`), but `brand.validation.js:slugParamSchema` strictly required hyphens (`/^[a-z0-9]+(?:-[a-z0-9]+)*$/`). | **FIXED** | In `slugify.js`, normalized `[_\s]+` to `-` to convert underscores to hyphens. In `brand.validation.js`, relaxed `slugParamSchema` to accept both hyphens and underscores for full backward compatibility. |
| **26** | **P3** | `slugify.js`, `attribute.service.js` | Attribute value slugs were globally unique across all attributes instead of scoped per attribute. | `AttributeValue` unique index is `(attribute_id, slug)`, but `generateSlug` checked uniqueness globally across the entire table without scoping by `attributeId`. | **FIXED** | Added support for `options.where` in `slugify.js`. Passed `{ where: { attributeId } }` to `generateSlug` in `addValue` and `updateValue` in `attribute.service.js`. |

---

## Files Modified

1. **`server/src/utils/common.validation.js`**
   - Added `uuidCsvParamSchema` and `uuidCsvSchema` supporting single or comma-separated UUIDs.

2. **`server/src/modules/attribute/categoryAttribute.routes.js`**
   - Applied `uuidCsvParamSchema` on `GET /:id/attributes`.

3. **`server/src/modules/attribute/attribute.service.js`**
   - `deleteAttribute`: Added reference check against `ProductAttribute` and `VariantOption` rows; throws 409 Conflict if in use.
   - `removeValue`: Added reference check against `ProductAttribute` and `VariantOption` rows; throws 409 Conflict if in use.
   - `addValue` & `updateValue`: Pass `{ where: { attributeId } }` to `generateSlug` for per-attribute uniqueness.

4. **`server/src/modules/brand/brand.validation.js`**
   - `getBrandBySlugSchema`: Added `productOffset`, `productSortBy`, `productSortOrder`.
   - `updateBrandSchema`: Added `.min(1)`.
   - `slugParamSchema`: Allowed both hyphens and underscores (`/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/`).

5. **`server/src/modules/brand/brand.service.js`**
   - `getBrandBySlug`: Added `separate: true` to `productInclude` for true Sequelize hasMany pagination; uppercase sort order.
   - `updateBrand`: Auto-regenerates slug when brand `name` changes and no explicit `slug` is provided.

6. **`server/src/modules/attribute/productAttribute.validation.js`**
   - `updateProductAttributeSchema`: Added `.oxor('valueId', 'customValue')`.

7. **`server/src/modules/attribute/productAttribute.service.js`**
   - `updateProductAttribute`: Rejects setting `valueId` on custom rows and `customValue` on template rows with 400.

8. **`server/src/utils/slugify.js`**
   - Normalized `[_\s]+` to `-` to convert underscores into hyphens.
   - Added `options.where` support for collision queries.

9. **`client/src/pages/admin/CategoriesPage.jsx`**
   - Defined `canManageCategoryAttributes = canManageCategories && canManageAttributes` and gated the Attributes button accordingly.

10. **`client/src/pages/admin/BrandsPage.jsx`**
    - Gated create, update, and delete actions on `PERMISSIONS.BRANDS_MANAGE`.

11. **`client/src/utils/permissions.js`**
    - Updated `/admin/brands` route permission mapping to `[PERMISSIONS.BRANDS_READ, PERMISSIONS.BRANDS_MANAGE]`.

12. **`client/src/pages/admin/AttributesPage.jsx`**
    - Updated deletion confirmation dialog copy to state that values or templates in use by products or variants cannot be deleted.

13. **`server/tests/unit/attribute.brand.fixes.test.js`** *(New)*
    - Comprehensive 19-test suite validating CSV UUID parsing, deletion guards, brand pagination/sorting/slug generation/charset, product attribute mode exclusivity, and scoped slugification.

---

---

## Phase 4: User Authentication, Authorization, Session & Access Control Audit (Findings C1 – C8)

| # | Code | Components / Files | Vulnerability / Bug Identified | Root Cause | Status | Resolution Summary |
|---|---|---|---|---|---|---|
| **27** | **C1** | `admin.service.js` | Staff accounts created by admin were left unverified when `emailVerification` was enabled. | `admin.service.js:createStaffUser` set `isEmailVerified: true` (typo), whereas the `User` model defines the column as `emailVerified`. Sequelize silently dropped the key. | **FIXED** | Corrected property to `emailVerified: true`. Verified by inspection and unit test. |
| **28** | **C2** | `AdminLoginPage.jsx` | Over-broad customer redirect and role-shape mismatch in admin login. | Line 35 redirected any logged-in user if `user.roles.length > 0`, routing customers (`['customer']`) into `/admin`. Lines 98/128 checked `r.name === 'admin'`, but server returns roles as string array `['admin']`, blocking genuine admins. | **FIXED** | Replaced naive checks with `getFirstAccessibleAdminPath(user)`, correctly evaluating string array roles and blocking customer-only accounts from admin paths. |
| **29** | **C3** | `auth.service.js`, `oauth.service.js`, `user.service.js` | Session `isCurrent` was pseudo-logic (`idx === 0`); `revokeAllOtherSessions` ignored access token and could revoke caller session. | Access tokens did not record which `RefreshToken` session they originated from. `getSessions` set `isCurrent: idx === 0`. `revokeAllOtherSessions` simply kept index 0. | **FIXED** | Added `sid: sessionId` to access token JWT payload across `login`, `register`, `refreshToken`, 2FA, backup code, and OAuth flows. Updated `getSessions` and `revokeAllOtherSessions` to match `decoded.sid`. |
| **30** | **C4** | `user.service.js` | TOCTOU race on email change confirm + pending registration token destruction. | `confirmEmailChange` didn't re-check email uniqueness inside the transaction (500 error on duplicate). `requestEmailChange` unconditionally destroyed existing tokens, wiping out pending email verification tokens for unverified users. | **FIXED** | In `confirmEmailChange`, wrapped in transaction and checked `User.findOne({ where: { email: newEmail } })`, throwing 409 Conflict. In `requestEmailChange`, only destroy old tokens when `user.emailVerified` is true. |
| **31** | **C5** | `user.service.js` | Phone bypass via `updateMe` and post-OTP TOCTOU uniqueness check in `confirmPhoneChange`. | `updateMe` wrote `phone` directly without checking whether another account already used it, causing unhandled 500 error on duplicate constraint. `confirmPhoneChange` lacked a post-OTP uniqueness check inside its transaction. | **FIXED** | Added uniqueness check in `updateMe` against `UserProfile` (throws 409 Conflict). Wrapped `confirmPhoneChange` in a transaction and re-verified phone uniqueness before updating. |
| **32** | **C6** | `admin.controller.js`, `admin.service.js` | Role grant and role update without permission subset check (privilege escalation). | Acting admin could create custom roles with `baseRole: 'super_admin'` or grant permissions they did not possess. Could also assign super_admin roles to other users. | **FIXED** | Passed `actingUser` to `createAccessRole`, `updateAccessRole`, and `updateUserRole`. Enforced that non-super admins cannot set/assign `baseRole: 'super_admin'` and cannot grant or assign permissions outside `actingUser.permissions` (throws 403 Forbidden). |
| **33** | **C7** | `admin.service.js`, `user.service.js`, `user.validation.js`, `user.routes.js` | Filtering on legacy column `users.role` ignored custom roles in `user_roles`; unvalidated `GET /users` query params. | Filtering `where.role = role` only checked enum column on `users`, missing users assigned custom roles in `user_roles`. `GET /users` lacked query validation schema. | **FIXED** | Added `listUsersQuerySchema` and wired to `GET /users`. Updated `listAll` and `listAccessUsers` to check `users.role` OR subquery existence in `user_roles`. Added `distinct: true`. |
| **34** | **C8** | `user.service.js` | Deactivating/banning a user did not revoke active refresh tokens; no protection against deactivating last active super admin. | `updateStatus` only updated `status`, leaving refresh tokens valid (sessions resurrected on un-ban). No check prevented deactivating or banning the last active super admin. | **FIXED** | Added guard blocking status change if target is last active super admin (throws 400). Added immediate revocation of all active refresh tokens in transaction when `status !== 'active'`. |
| **35** | **P2** | `BrandsPage.jsx` | `isFeatured` had no UI control in admin panel despite backend model, service, and validation supporting it. | `BrandsPage.jsx` omitted `isFeatured` from `formData`, dialog switch controls, table columns, and filter dropdowns. Admins could neither view nor set brand featured status. | **FIXED** | Added `isFeatured` switch control with explanatory caption in Brand Add/Edit dialog, added `Featured` column with `StarIcon` chip in DataGrid, added `Featured` dropdown filter in the filter bar, and passed `isFeatured` in query parameters. Tested in `attribute.brand.fixes.test.js`. |

---

## Verification & Test Results

- **Database**:
  - PostgreSQL schema and check constraints verified intact.
- **Backend Unit Tests**:
  - `server/tests/unit/user.auth.fixes.test.js`: **15/15 passed**.
  - `server/tests/unit/attribute.brand.fixes.test.js`: **22/22 passed**.
  - `server/tests/unit/product.pricing.test.js`: **28/28 passed**.
  - Full server test suite: **18/18 test files passed, 168/168 tests passed**.
- **Client Unit Tests**:
  - Full client test suite: **11/11 test files passed, 34/34 tests passed**.
- **Client Production Build**:
  - `npm run build`: **Built in 15.00s with 0 errors**.



