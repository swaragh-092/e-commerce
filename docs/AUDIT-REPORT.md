# 🔬 Complete System-Level Audit Report
## eCommerce Application — React + Node.js + Sequelize + PostgreSQL

> **Audit Date:** April 3, 2026 | **Scope:** Full stack — frontend, backend, DB schema, security, architecture

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Category Modeling](#2-category-modeling)
3. [Variant & Attribute System](#3-variant--attribute-system--deep-analysis)
4. [Feature Analysis by Module](#4-feature-analysis-by-module)
5. [Frontend vs Backend Alignment](#5-frontend-vs-backend-alignment)
6. [Admin Experience](#6-admin-experience)
7. [Functional Flow Validation](#7-functional-flow-validation)
8. [Database Design Validation](#8-database-design-validation)
9. [Code Quality](#9-code-quality)
10. [Performance](#10-performance)
11. [Security](#11-security)
12. [Scalability](#12-scalability)
13. [Final Verdict](#14-final-verdict)

---

## 1. 🏗️ SYSTEM OVERVIEW

**Architecture Pattern:** Modular monolith (domain-driven module layout). Each domain (`auth`, `product`, `cart`, `order`, etc.) owns its own `model`, `service`, `controller`, `routes`, and `validation` files. This is clean and production-appropriate.

| Layer | Technology | Quality |
|---|---|---|
| Frontend | React + Vite + MUI | ✅ Clean |
| Backend | Node.js + Express | ✅ Well-structured |
| ORM | Sequelize | ✅ Proper |
| DB | PostgreSQL | ✅ |
| Auth | JWT + Refresh Tokens | ✅ |
| Jobs | node-cron | ✅ |
| Containerization | Docker + Compose | ✅ |

---

## 2. 📂 CATEGORY MODELING

### ✅ What's Correct

The `category.model.js` uses a **self-referential adjacency list**:

```
parentId → Category.id (nullable for root nodes)
```

This supports unlimited depth: `Vegetables → Leafy → Spinach`.

The `category.service.js` builds the full nested tree recursively in-memory via `buildTree()`, which is clean and works well.

Deletion is guarded — categories with children cannot be deleted.

---

### 🔴 Issues

**Issue 1 — No circular reference guard:**
`updateCategory` checks `data.parentId === id` (direct self-loop) but does NOT prevent deeper circular chains like `A → B → C → A`.

**Issue 2 — Parent category products not inherited in filters:**
In `product.service.js`, category filtering does:
```javascript
where: { slug: filters.category }, required: true  // INNER JOIN on exact slug
```
When a user browses "Vegetables", products assigned **only** to "Leafy" (a child) **do not appear**. This breaks the expected browsing behavior for any tree depth > 1.

**Issue 3 — `deleteCategory` does not check for assigned products:**
Products linked via the `product_categories` junction table are orphaned or left attached silently when a category is deleted.

---

## 3. 🔥 VARIANT & ATTRIBUTE SYSTEM — DEEP ANALYSIS

This is the most architecturally significant area. It has **both good infrastructure and critical disconnections**.

---

### 3a. Current Variant Model

```
product_variants: { id, productId, name (string), value (string), priceModifier, quantity, sku }
```

**`name` and `value` are plain free-form strings.** There is NO foreign key to `attribute_values`. Examples:
- `name = "Color"`, `value = "Red"`
- `name = "Weight"`, `value = "500g"`

---

### 3b. The Attribute System That Exists But Is Disconnected

The backend has a well-designed attribute system:

| Table | Purpose |
|---|---|
| `attribute_templates` | Reusable attribute types: Color, Size, Weight |
| `attribute_values` | Reusable values: Red, Large, 500g |
| `category_attributes` | Links attributes to categories (with inheritance!) |

The `attribute.service.js` has:
- `getCategoryAttributes(id, inherit=true)` — walks the full parent chain collecting inherited attributes ✅
- `bulkGenerateVariants(productId, attributes)` — generates cartesian product variants ✅
- `cloneVariants(targetId, sourceId)` — copies variant structure ✅

**This is sophisticated, well-thought-out infrastructure.**

---

### 3c. 🔴 CRITICAL: Attribute System Is Completely Disconnected from Variants

Despite the above infrastructure existing:

1. **The `product_variants` table has zero FK to `attribute_values`**. Variants store `name`/`value` as raw strings — the attribute system is not enforced.

2. **The admin UI (`ProductEditPage.jsx`)** presents variants as raw text boxes:
   ```
   TextField: "Attribute" → e.g. "Color"  (free text)
   TextField: "Value"     → e.g. "Red"    (free text)
   ```
   Admin IS typing "Red", "Large", "500g" again and again. The exact problem you wanted to avoid.

3. **No `attributeService.js` exists in the frontend** (`client/src/services/`). The frontend cannot talk to the attribute system at all.

4. **The `bulkGenerateVariants` and `cloneVariants` endpoints** have NO UI — they are dead endpoints from the frontend's perspective.

---

### 3d. 🔴 CRITICAL: Multi-Dimensional Variants Are Architecturally Broken

The current model cannot represent a **combined** variant (e.g., `Color=Red AND Size=Large` as one SKU). The table is flat — one attribute dimension per row:

| id | productId | name | value |
|---|---|---|---|
| abc | tomato-id | "Color" | "Red" |
| def | tomato-id | "Size" | "Large" |

These are **two separate `variantId`s**. The `cart_items` table has a single `variantId` FK. You can never have a cart item that is "Red + Large" — it can only be one of them.

**The correct schema should be:**

```sql
-- Variants as SKU combinations
product_variants (
  id UUID PK,
  productId UUID FK,
  sku VARCHAR,
  priceModifier DECIMAL,
  quantity INT
)

-- Junction: which attribute values define this variant
product_variant_attribute_values (
  variantId     UUID FK → product_variants.id,
  attributeValueId UUID FK → attribute_values.id
  PRIMARY KEY (variantId, attributeValueId)
)
```

This lets `TOM-RL` be one variant row with two linked `attribute_value` rows (Red + Large).

---

### 3e. VariantSelector UI — Partially Correct

The `VariantSelector.jsx` groups variants by `name` and shows `value` as buttons. This UI assumes the flat single-dimension model and works for it — but the cross-group selection tracking **never resolves to a single combined variantId** because no such combined entity exists in the DB. Selecting Color=Red then Size=Large calls `onSelect(opt)` with only the last-clicked variant, silently losing the other dimension.

---

## 4. 📋 FEATURE ANALYSIS BY MODULE

### 🔐 Auth

| Item | Status |
|---|---|
| Register + Login + JWT | ✅ Fully implemented |
| Refresh token rotation | ✅ |
| Password reset (token-based) | ✅ |
| Email verification | ✅ |
| DB-backed RBAC access (system/custom roles + permissions) | ✅ |
| Account status guard (banned/inactive) | ✅ |
| Rate limiting (login, register, forgot) | ✅ |
| Token blacklisting on logout | ✅ |
| 2FA / MFA | ❌ Not implemented |
| OAuth (Google/Facebook login) | ❌ Not implemented |

---

### 📦 Products

| Item | Status |
|---|---|
| CRUD with Sequelize transactions | ✅ |
| Soft delete (`paranoid: true`) | ✅ |
| Slug generation (collision-safe) | ✅ |
| HTML sanitization for description | ✅ (via `sanitize-html`) |
| Tags (many-to-many) | ✅ |
| Images (via media system) | ✅ |
| Search + filter + sort + pagination | ✅ |
| Audit logging on CRUD | ✅ |
| Variant-level stock ignored in cart | 🔴 |
| `status: 'published'` not enforced on public list endpoint | 🟡 |
| No cached average rating on product | 🟡 |

---

### 🎨 Variants

| Item | Status |
|---|---|
| `product_variants` table exists | ✅ |
| Per-variant `quantity`, `sku`, `priceModifier` | ✅ |
| Soft delete on variants | ✅ |
| Attribute templates infrastructure | ✅ |
| Attribute values infrastructure | ✅ |
| Category-attribute linking | ✅ |
| Variants disconnected from attribute system | 🔴 |
| Multi-dimensional variant SKU not supported | 🔴 |
| Admin UI uses free-text (no attribute picker) | 🔴 |
| No `attributeService.js` in frontend | 🔴 |
| `bulkGenerateVariants` API never called by UI | 🔴 |

---

### 🛒 Cart

| Item | Status |
|---|---|
| Guest cart (sessionId) | ✅ |
| Authenticated cart (userId) | ✅ |
| Guest → auth cart merge on login | ✅ |
| Variant-aware cart items | ✅ (FK exists) |
| Stock check on add | ✅ |
| Stock check uses **product-level** quantity, not variant quantity | 🔴 |
| Cleanup job for abandoned carts | ✅ |
| Price snapshot at cart time | ❌ (price re-fetched at order time, not locked at cart add) |

---

### 📃 Orders

| Item | Status |
|---|---|
| Full transactional order creation | ✅ |
| Snapshot of product name/price at order time | ✅ |
| `variantInfo` as JSONB snapshot in order_items | ✅ |
| Coupon validation + usage tracking | ✅ |
| Tax calculation (per-product or global rate) | ✅ |
| Shipping calculation (flat or threshold-free) | ✅ |
| Inventory reservation (`reservedQty`) | ✅ |
| Reservation released on cancel | ✅ |
| Cancel only allowed for `pending_payment` | 🟡 (should also allow `processing`) |
| **Dead code: PaymentIntent creation after `return`** | 🔴 |
| `reservationTimeout.job` references `item.variantId` which doesn't exist on OrderItem | 🔴 |
| OrderItem has no `variantId` FK — only JSONB snapshot | 🟡 |

---

### 💳 Payments

| Item | Status |
|---|---|
| Stripe PaymentIntent integration | ✅ |
| Webhook signature verification | ✅ |
| Idempotent webhook processing (WebhookEvent table) | ✅ |
| Order status update on webhook | ✅ |
| No refund UI in frontend | ❌ |
| `refundOrder` service stub exists but unimplemented | 🟡 |

---

### 🎟️ Coupons

| Item | Status |
|---|---|
| Percentage + fixed-amount types | ✅ |
| Per-user usage limits | ✅ |
| Global usage limits | ✅ |
| Date-range validity | ✅ |
| `applicableTo: 'category' \| 'product' \| 'all'` | ✅ |
| Coupon expiry background job | ✅ |
| Rate-limited coupon validation endpoint | ✅ |
| DB-level constraint: percentage ≤ 100 (migration exists) | ✅ |
| No frontend UI for admin to assign coupon to specific product/category | 🟡 |

---

### ❤️ Wishlist

| Item | Status |
|---|---|
| User wishlist (product-level) | ✅ |
| WishlistButton component | ✅ |
| WishlistItem has `variantId` FK | ✅ (schema level) |
| Frontend `WishlistButton` only passes `productId`, not `variantId` | 🟡 |
| Move from wishlist to cart | ❌ Not implemented |

---

### ⭐ Reviews

| Item | Status |
|---|---|
| Rating 1–5 with validation | ✅ |
| Verified purchase flag | ✅ |
| Admin moderation workflow | ✅ |
| One review per user per product (unique index) | ✅ |
| Rate limiting (5/day) | ✅ |
| No cached `avg_rating` / `review_count` on Product | 🔴 (N+1 risk) |

---

## 5. 🖥️ FRONTEND vs BACKEND ALIGNMENT

| Area | Issue |
|---|---|
| Attribute system APIs | Backend has full CRUD for attributes — **zero frontend service file exists** |
| Bulk variant generation | Backend endpoint exists — **no UI** |
| Variant clone | Backend endpoint exists — **no UI** |
| Category attribute inheritance | Backend supports it — **not used by frontend** |
| Variant multi-dimension selection | VariantSelector only calls `onSelect` with the last selected dimension, ignoring others |
| Product list public guard | Backend conditionally sets `status` filter — frontend never passes it, meaning draft products could appear |
| Admin attribute management | No page at all (`/admin/attributes` doesn't exist) |
| Cart stock uses product qty | Backend bug not caught by frontend |

---

## 6. 👨‍💼 ADMIN EXPERIENCE

| Capability | Available |
|---|---|
| Create/edit products | ✅ (`ProductEditPage.jsx`) |
| Manage categories | ✅ (`CategoriesPage.jsx`) |
| Order management | ✅ |
| Customer management | ✅ |
| Coupon management | ✅ |
| Audit logs | ✅ |
| Media library | ✅ |
| Dashboard + charts | ✅ |
| **Create reusable attribute templates** | ❌ No page |
| **Assign attributes to categories** | ❌ No UI |
| **Bulk generate variants from attributes** | ❌ No UI |
| **Clone variants between products** | ❌ No UI |
| **Attribute-based variant picker during product creation** | ❌ Free-text fields only |
| Manage review visibility | ✅ (`ReviewsPage.jsx`) |

---

## 7. 🔄 FUNCTIONAL FLOW VALIDATION

```
Category → Product → Variant → Cart → Order
```

| Step | Status |
|---|---|
| Category browsing | ✅ (but subcategory products not inherited in parent view) |
| Product list & detail | ✅ |
| Variant selection UI | ✅ (single dimension only) |
| Correct price: `base + priceModifier` | ✅ |
| Stock check at cart add | ✅ but uses **product-level** stock, not variant stock |
| Correct variant passed to cart | ✅ (if single-dimension) |
| Order price: re-fetches current price at placement | ✅ (protects against price changes) |
| Stock reserved atomically | ✅ |
| Stock released on cancel | ✅ |
| Payment intent creation inside placeOrder | 🔴 **Dead code — unreachable after `return`** |

---

## 8. 🗄️ DATABASE DESIGN VALIDATION

### Normalization

- Products, categories, users, orders, carts — properly normalized ✅
- Tags: many-to-many via `product_tags` ✅
- Images: linked to `media` table (not just raw URL) ✅

### Constraint Issues

| Issue | Location |
|---|---|
| `product_variants.name` / `.value` are unvalidated strings — no FK to attribute system | `product_variants` |
| `order_items.productId` is nullable (correct for soft-deleted products) | `order_items` |
| `category.parentId` has no depth or cycle constraint | `categories` |
| `reservedQty` tracked on Product but variants have their own `quantity` — two inventory sources | `products` + `product_variants` |
| `order_items` has `variantInfo JSONB` but no `variantId` FK | `order_items` |

### Missing Indexes

| Index | Reason |
|---|---|
| `products.status` | Every public API call filters on this |
| `products.is_featured` | Used in featured product queries |
| `cart_items.(cartId, productId, variantId)` | Composite lookup on every cart operation |
| `orders.(userId, status)` | Frequent combination query |
| `attribute_values.attributeId` | Every attribute join |

---

## 9. 🧹 CODE QUALITY

### ✅ Strengths

- Consistent `service → controller` separation
- All mutations wrapped in Sequelize transactions
- Centralized `AppError` class with codes
- Unified `success()`/`error()` response shape
- Joi validation on all mutating endpoints
- `sanitize-html` on product HTML content
- Audit logging on sensitive operations

### 🟡 Issues

| Issue | File | Detail |
|---|---|---|
| `sanitizeBody` is a no-op | `sanitize.middleware.js` | Just calls `next()` — no actual sanitization |
| Dead code after `return` | `order.service.js` | Payment intent creation is unreachable |
| `useEffect` after conditional return | `VariantSelector.jsx` | Violates React Rules of Hooks (suppressed with eslint-disable) |
| Job references non-existent model fields | `reservationTimeout.job.js` | `order.cartId` and `item.variantId` don't exist |
| No `attributeService.js` in frontend | `client/src/services/` | Backend attribute APIs are complete but unreachable from frontend |

---

## 10. ⚡ PERFORMANCE

| Issue | Impact |
|---|---|
| `getCategoryTree` loads ALL categories into memory on every request | Medium — needs Redis cache or materialized path |
| `getAllAttributes` has no pagination | Low now, high at scale |
| Products list: no `status:'published'` default filter | Security + correctness concern |
| No cached `avgRating` / `reviewCount` on Product | High — aggregation required per product card |
| `buildTree()` is O(n²) nested filter | Breaks at ~10k categories |
| Category filter does exact slug match — no recursive subcategory query | High UX impact |
| Variant-level queries in `lowStockAlert.job` — no `include` limit | Low |

---

## 11. 🔐 SECURITY

### ✅ Correct

- Helmet.js security headers
- CORS whitelist with env config
- JWT verify + user existence check on every request
- Stripe webhook signature verification
- Rate limiting on auth, reviews, coupons, global
- Request ID header (`X-Request-Id`) for traceability
- Soft deletes (no hard data loss)

### 🔴 Risks

**Risk 1 — Attribute routes have no auth guards:**

`attribute.routes.js`, `categoryAttribute.routes.js`, and `productVariant.routes.js` all contain:
```javascript
// NOTE: When auth middleware is ready, add authenticate + authorize('admin', 'super_admin')
// For now, routes are open for development/testing.
```
These are **fully open admin-only mutation endpoints**.

**Risk 2 — Attribute routes not mounted in `app.js`:**
`/api/attributes` is missing from the route registration entirely. The attribute system endpoints are currently inaccessible (accidental security through obscurity — but still broken functionality).

**Risk 3 — `sanitizeBody` is a no-op:**
The global body sanitizer does nothing — request bodies are unsanitized before reaching controllers (relying solely on Joi validation and per-field `sanitizeHtml` calls).

**Risk 4 — Product list can expose drafts:**
`getProducts` only filters by status if `filters.status` is provided. The public route at `GET /api/products` does not enforce `status: 'published'` by default.

---

## 12. 📈 SCALABILITY

| Concern | Assessment |
|---|---|
| 100k products | Schema OK; needs proper indexes + query optimization |
| Deep category trees | In-memory `buildTree` breaks at ~10k categories |
| Complex multi-attribute variants | Current schema **CANNOT support it** |
| Image storage | File system — needs CDN |
| Background jobs | Single-process cron — not distributed; cannot scale horizontally |
| Sessions / Cart for anonymous users | SessionId-based — works but no TTL cleanup beyond the job |
| Notification system | Template-based ✅; no queue (synchronous send) |

---

## 14. 📊 FINAL VERDICT

---

### 🔴 CRITICAL ISSUES (Fix Immediately)

1. **Variant ↔ Attribute disconnect:** `product_variants.name/value` are free strings — no FK to attribute system. Admin re-types everything manually.
2. **Multi-dimensional variants unsupported:** No `product_variant_attribute_values` junction table — a single variant cannot represent `Color=Red AND Size=Large`.
3. **Stock check uses product-level quantity, not variant quantity:** Buying "Red" reduces total product stock, not just the "Red" variant stock.
4. **Dead code in `placeOrder`:** Payment intent creation is unreachable (after a `return` inside the transaction block). Payment flow is broken.
5. **`reservationTimeout.job` references non-existent fields:** `order.cartId` and `item.variantId` don't exist on their models — the job silently does nothing useful.
6. **Attribute system routes not mounted in `app.js`:** `/api/attributes`, bulk-generate, clone variants — all inaccessible.
7. **`useEffect` after conditional return** in `VariantSelector.jsx` violates React's Rules of Hooks.

---

### 🟡 IMPROVEMENTS (High Priority)

1. Add `status: 'published'` default filter to the public product list API.
2. Add `avg_rating` and `review_count` cached fields to the `Product` model.
3. Recursive category product filtering — products in subcategories should appear when browsing parent.
4. Circular category parent chain prevention (full depth check, not just direct self-reference).
5. `sanitizeBody` middleware is a no-op — implement it or remove it entirely.
6. Add `variantId` FK to `order_items` (in addition to the JSONB snapshot).
7. Allow order cancellation for `processing` status (not just `pending_payment`).
8. Add pagination to `getAllAttributes`.

---

### 🟢 STRENGTHS (What's Built Well)

1. **Full modular architecture** — clean domain separation, easy to extend or split into microservices.
2. **Attribute infrastructure (backend)** — `attribute_templates`, `attribute_values`, `category_attributes`, category inheritance, bulk generate, clone variants — genuinely well-designed.
3. **Transactional integrity everywhere** — every mutation is wrapped in a DB transaction.
4. **Complete auth system** — JWT, refresh tokens, email verification, password reset, rate limiting, role guards.
5. **Order snapshot pattern** — `snapshotName`, `snapshotPrice`, `variantInfo JSONB` in `order_items` protects historical order integrity.
6. **Idempotent Stripe webhook processing** via `WebhookEvent` deduplication table.
7. **Coupon system** — complete with per-user limits, date ranges, category/product scoping, DB-level percentage constraint.
8. **Background jobs** — coupon expiry, cart cleanup, reservation timeout, low-stock alerts.
9. **Audit logging** on all sensitive operations.
10. **SEO** — `PageSEO` component + `/sitemap` + `/robots.txt`.

---

### ❌ MISSING FEATURES

1. Admin UI for attribute template management (`/admin/attributes` page)
2. Admin UI for category-attribute linking
3. Admin UI for bulk variant generation from attributes
4. Admin UI for variant clone
5. Attribute-picker dropdown in `ProductEditPage` (replace free-text fields)
6. `attributeService.js` in frontend (`client/src/services/`)
7. "Move to cart" from wishlist
8. Wishlist awareness of variant (currently product-only)
9. Refund UI and backend implementation
10. Subcategory-aware product browsing
11. Multi-dimensional variant SKU support

---

### ⚡ PERFORMANCE ISSUES

1. No Redis/cache for category tree (rebuilt on every API call)
2. No `avg_rating` cached on products — requires aggregation per product card
3. `buildTree()` is O(n²) — replace with materialized path or PostgreSQL LTREE at scale
4. Category filter does exact slug match — misses child category products
5. No default `status: 'published'` filter — potential full table scan

---

### 🔐 SECURITY RISKS

1. **All attribute CRUD routes are unprotected** (noted in code comments but never fixed)
2. **Attribute routes not mounted** (accidentally inaccessible now — will become a live risk when mounted)
3. Draft products can appear in public product listings
4. `sanitizeBody` no-op gives false confidence in input sanitization

---

### 🧠 ARCHITECTURE FIXES

#### Fix 1 — Proper Variant Schema

The most critical fix: connect variants to the attribute system properly.

```sql
-- Step 1: Remove free-text columns from product_variants
ALTER TABLE product_variants DROP COLUMN name;
ALTER TABLE product_variants DROP COLUMN value;

-- Step 2: Add reservedQty to product_variants (for per-SKU inventory)
ALTER TABLE product_variants ADD COLUMN reserved_qty INTEGER NOT NULL DEFAULT 0;

-- Step 3: Create the junction table
CREATE TABLE product_variant_attribute_values (
  variant_id      UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attr_value_id   UUID NOT NULL REFERENCES attribute_values(id) ON DELETE RESTRICT,
  PRIMARY KEY (variant_id, attr_value_id)
);
```

**Admin workflow becomes:**
1. Define `Size` → Small, Medium, Large in `/admin/attributes`
2. Link `Size` to "Clothing" category
3. Create a product → attribute picker auto-loads Size options from the linked category
4. Click "Bulk Generate" → system creates all SKU combinations (cartesian product)
5. Admin sets price modifier and quantity per SKU

---

#### Fix 2 — Dead Code in `placeOrder`

```javascript
// BEFORE (broken — code after return is unreachable)
return sequelize.transaction(async (t) => {
    // ...
    return order;
});
let clientSecret = null;  // ← NEVER REACHED

// AFTER (correct)
const order = await sequelize.transaction(async (t) => {
    // ...
    return order;
});

let clientSecret = null;
try {
    const intent = await PaymentService.createIntent(order.userId, order.id);
    clientSecret = intent.clientSecret;
} catch (err) {
    // Log but don't fail — the order is saved; frontend can retry payment
    clientSecret = null;
}

return { order, clientSecret };
```

---

#### Fix 3 — Variant-Level Stock Checks

```javascript
// In cart.service.js addItem — use variant stock when a variant is selected
let availableStock;
if (variantId) {
    const variant = await ProductVariant.findByPk(variantId, { transaction: t });
    if (!variant) throw new AppError('NOT_FOUND', 404, 'Variant not found');
    availableStock = variant.quantity - (variant.reservedQty || 0);
} else {
    availableStock = product.quantity - (product.reservedQty || 0);
}
```

---

#### Fix 4 — Mount Attribute Routes in `app.js`

```javascript
// server/src/app.js
const attributeRoutes = require('./modules/attribute/attribute.routes');
const categoryAttributeRoutes = require('./modules/attribute/categoryAttribute.routes');
const productVariantRoutes = require('./modules/attribute/productVariant.routes');

app.use('/api/attributes', attributeRoutes);
app.use('/api/categories', categoryAttributeRoutes);   // /:id/attributes
app.use('/api/products', productVariantRoutes);         // /:id/variants/bulk-generate, clone
```

---

### 🚀 SCALABILITY IMPROVEMENTS

1. Add **Redis** for category tree caching (TTL: 5 min)
2. Switch category tree to **PostgreSQL LTREE extension** or closure table at > 5k categories
3. Add `avg_rating` (FLOAT) and `review_count` (INT) to `products` — update via trigger or post-review hook
4. Add a **message queue** (BullMQ/Redis) for notifications — current synchronous send blocks the request cycle
5. Add **CDN** in front of `/uploads` — currently served directly from Express static
6. Add composite DB indexes:
   - `(userId, status)` on `orders`
   - `(productId, status)` on `reviews`
   - `(cartId, productId, variantId)` on `cart_items`
   - `(attributeId)` on `attribute_values`
7. Add `reservedQty` to `product_variants` (not just `products`) for proper per-SKU inventory tracking

---

### 🌟 UNIQUE STRENGTHS

1. **Attribute inheritance system** — walking up the category tree to collect all parent attributes is genuinely elegant. Most systems don't do this.
2. **Bulk variant cartesian product generator** — if wired to the UI, this would be a standout admin feature.
3. **Full order snapshot** (`name`, `price`, `variant JSON`) — correct historical record keeping that most junior projects skip.
4. **Idempotent webhooks** — `WebhookEvent` deduplication table is production-grade.
5. **Modular domain structure** — the codebase is architecturally ready to be split into microservices.

---

### 📈 PRODUCT SUGGESTIONS

1. **Attribute-to-variant visual builder UI** — drag-and-drop matrix showing all combinations (Color × Size grid)
2. **Inventory import/export (CSV)** — critical for bulk catalog management
3. **Product bundles** — sell multiple products together at a discount
4. **Recently viewed** — local storage + analytics
5. **Faceted search by attribute value** — "Show all products with Weight: 500g" (requires attribute FK on variants)
6. **Price history tracking** — log price changes for transparency
7. **Variant image linking** — specific image per variant (e.g., show Red image when Red is selected)
8. **Backorder support** — allow purchase with expected restock date when stock = 0

---

## Summary Scorecard

| Domain | Score |
|---|---|
| Architecture & Code Quality | 8 / 10 |
| Category Modeling | 7 / 10 |
| Variant & Attribute System | 4 / 10 |
| Cart & Order Flow | 6 / 10 |
| Auth & Security | 7 / 10 |
| Admin UX | 5 / 10 |
| Frontend–Backend Alignment | 5 / 10 |
| Performance Readiness | 6 / 10 |
| **Overall** | **6 / 10** |

---

> The backend infrastructure is genuinely strong — the attribute system, transaction handling, and modular architecture are production-grade. The critical gap is the **disconnection between the attribute system and the actual variant storage**, the **missing admin UI for attributes**, and a few **hard bugs** in the order service and background jobs.
