# Review Module — Complete A-Z Audit Report

> **Audit Date:** May 7, 2026  
> **Scope:** Full stack — frontend, backend, DB schema, security, architecture  
> **Files Audited:** 16 files across server, client, shared, config, and migrations

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Files Audited](#2-files-audited)
3. [Critical Issues](#3-critical-issues)
4. [High Issues](#4-high-issues)
5. [Medium Issues](#5-medium-issues)
6. [Low Issues](#6-low-issues)
7. [Already Done Well](#7-already-done-well)
8. [Database Schema Validation](#8-database-schema-validation)
9. [Security Review](#9-security-review)
10. [Permission Matrix](#10-permission-matrix)
11. [Recommendations](#11-recommendations)

---

## 1. System Overview

The Review module provides product review functionality with the following workflow:

1. **Customer** submits a review → status = `pending`
2. **Admin** moderates via dashboard → status = `approved` or `rejected`
3. **Storefront** displays only `approved` reviews
4. **Product** model caches `avgRating` and `reviewCount` (refreshed on moderate/approve)

Optional feature: `requirePurchaseForReview` — only allows reviews from customers with a delivered order.

| Layer | Technology |
|---|---|
| Backend | Express.js + Sequelize (PostgreSQL) |
| Frontend | React + MUI |
| Validation | Joi (backend) |
| Authorization | RBAC via `shared/authorization.json` |
| Rate Limiting | express-rate-limit (5 reviews/day per IP) |
| Sanitization | sanitize-html (XSS prevention) |
| Audit | Sequelize-based audit log |

### Data Flow

```
Customer → POST /products/:slug/reviews → authenticate → reviewLimiter → validate(createReviewSchema) → create()
  ├─ Check product exists
  ├─ Check unique (user + product)
  ├─ Auto-detect verified purchase (or validate provided orderId)
  ├─ Enforce requirePurchaseForReview (if enabled)
  ├─ Sanitize title/body
  └─ INSERT review (status: pending)

Admin → PUT /admin/reviews/:id/moderate → authenticate → authorizePermissions → moderate()
  ├─ Update status → approved/rejected
  ├─ Audit log (before/after)
  └─ refreshProductRatingCache()

Admin → DELETE /admin/reviews/:id → authenticate → authorizePermissions → remove()
  ├─ Destroy review
  ├─ Audit log
  └─ ⚠️ Missing: refreshProductRatingCache()

Storefront → GET /products/:slug/reviews → list()
  └─ Returns approved reviews with User info

Admin → GET /reviews → authenticate → authorizePermissions → list()
  └─ Returns reviews filtered by status (default: pending)
```

---

## 2. Files Audited

### Backend (server/src/modules/review/)

| File | Lines | Purpose |
|---|---|---|
| `review.model.js` | 67 | Sequelize model (table: `reviews`) |
| `review.controller.js` | 63 | Express handlers: `create`, `list`, `moderate`, `remove` |
| `review.routes.js` | 32 | Route definitions with middleware chain |
| `review.service.js` | 173 | Business logic + rating cache management |
| `review.validation.js` | 19 | Joi schemas: `createReviewSchema`, `moderateReviewSchema` |

### Frontend (client/)

| File | Lines | Purpose |
|---|---|---|
| `ReviewSection.jsx` | 149 | Storefront review display + submission form |
| `ReviewsPage.jsx` | 212 | Admin moderation dashboard (DataGrid) |
| `reviewService.js` | 23 | API client: `list`, `create`, `moderate`, `remove` |

### Support files

| File | Purpose |
|---|---|
| `adminService.js` (lines 48-54) | Admin API: `getAdminReviews`, `updateReviewStatus`, `deleteReview` |
| `server/src/config/permissions.js` | Backend permission constants |
| `client/src/utils/permissions.js` | Frontend permission constants + route map |
| `shared/authorization.json` | RBAC schema (permissions, roles, mappings) |
| `server/src/config/constants.js` | `ENTITIES.REVIEW` for audit logging |
| `server/src/modules/product/product.model.js` | `avgRating`, `reviewCount` cached fields |

### Migrations

| File | Purpose |
|---|---|
| `20260228100017-create-reviews.js` | Creates `reviews` table with constraints |
| `20260402100008-add-order-id-to-reviews.js` | Adds `order_id` column + FK |
| `20260403100002-add-rating-cache-to-products.js` | Adds `avg_rating`, `review_count` to products |

---

## 3. Critical Issues

### 🔴 C-1: Rating cache not refreshed on review deletion

**File:** `review.service.js:148-166`

**Problem:** The `remove()` function deletes a review but never calls `refreshProductRatingCache(productId)`. After deleting an approved review, `Product.avgRating` and `Product.reviewCount` become permanently stale until the next moderate action on a different review for the same product.

```js
// review.service.js — remove()
const remove = async (id, adminId) => {
  return sequelize.transaction(async (t) => {
    const review = await Review.findByPk(id, { transaction: t });
    if (!review) throw new AppError('NOT_FOUND', 404, 'Review not found');
    await review.destroy({ transaction: t });
    // Audit log...
    // ⚠️ productId is lost here — not captured before destroy
  });
};
```

**Contrast with moderate() which correctly does:**
```js
// review.service.js:119-146
const moderate = async (id, status, adminId) => {
  const productId = await sequelize.transaction(async (t) => {
    // ... update review ...
    return review.productId;  // Captured inside transaction
  });
  await refreshProductRatingCache(productId);  // ✅ Called outside transaction
};
```

**Fix:** Capture `review.productId` before destroy, then call `refreshProductRatingCache()` after the transaction completes.

---

### 🔴 C-2: `REVIEWS_CREATE` permission defined but never enforced

**Files:** `shared/authorization.json:43`, `review.routes.js:24`

**Problem:** The permission `reviews.create` is defined in `authorization.json` and assigned to customers in `customerPermissionKeys`, but the backend route `POST /products/:slug/reviews` only uses `authenticate` middleware — it never calls `authorizePermissions(PERMISSIONS.REVIEWS_CREATE)`.

```js
// review.routes.js:24 — Current (no permission check)
router.post('/products/:slug/reviews',
  authenticate,
  reviewLimiter,
  validate(createReviewSchema),
  reviewController.create
);

// What it should be (with permission check):
router.post('/products/:slug/reviews',
  authenticate,
  authorizePermissions(PERMISSIONS.REVIEWS_CREATE),  // 🟡 Missing
  reviewLimiter,
  validate(createReviewSchema),
  reviewController.create
);
```

**Impact:** The permission key `REVIEWS_CREATE` is dead code. Any authenticated user can create reviews regardless of their assigned permissions. The `customerPermissionKeys` array in `authorization.json` includes `reviews.create` but it has no effect.

---

## 4. High Issues

### 🟠 H-1: No audit trail for review creation

**File:** `review.service.js:31-95`

**Problem:** `create()` performs no audit logging. While `moderate()` and `remove()` record audit events, the creation of a review itself is not recorded. If a user submits abusive or spam reviews, there is no audit event documenting who created what and when.

**Fix:** Add `AuditService.log({ userId, action: ACTIONS.CREATE, entity: ENTITIES.REVIEW, entityId: review.id })` inside the transaction after successful review creation.

---

### 🟠 H-2: Empty reviews allowed (rating-only with no text)

**Files:** `review.validation.js:7-8`, `ReviewSection.jsx:96-104`

**Problem:** Both `title` and `body` accept `null` and `''` simultaneously. A review can be submitted with only a rating and no textual content. There is no validation ensuring at least one text field is present.

```js
// review.validation.js
title: Joi.string().max(255).allow(null, ''),
body: Joi.string().allow(null, ''),
```

**Impact:** The review list may display empty entries with just a star rating and no content, which degrades UX for other shoppers reading reviews.

**Fix:** Add `.min(1)` to at least one field, or require that at least one of title/body is present.

---

### 🟠 H-3: Frontend doesn't enforce title max length

**File:** `ReviewSection.jsx:102`

**Problem:** The `<TextField>` for `title` has no `inputProps={{ maxLength: 255 }}`. The backend enforces `STRING(255)` at the Sequelize level, but truncation happens silently on insert. Users can type more than 255 characters and only find out via silent truncation.

**Fix:** Add `inputProps={{ maxLength: 255 }}` to the title TextField.

---

### 🟠 H-4: Admin route path inconsistency

**Files:** `review.routes.js:21,27,30`, `adminService.js:48-54`

**Problem:** The admin review listing endpoint uses a different path pattern than moderate/delete:

| Endpoint | Path | Purpose |
|---|---|---|
| GET | `/reviews` | Admin list (NO admin prefix) |
| PUT | `/admin/reviews/:id/moderate` | Admin moderate (WITH admin prefix) |
| DELETE | `/admin/reviews/:id` | Admin delete (WITH admin prefix) |

The admin service calls `api.get('/reviews', ...)` for listing (adminService.js:50), which bypasses the `ADMIN_ROUTE_PREFIX` environment variable used for admin URL masking. If URL masking is configured, only moderate/delete paths get masked — the listing endpoint is always at the same predictable path.

---

## 5. Medium Issues

### 🟡 M-1: `ReviewSection` lacks loading states

**File:** `ReviewSection.jsx:21-28`

**Problem:** The `fetchReviews` function has no `loading` state variable. The component displays "No reviews yet" while data is still being fetched, creating a flash of wrong content.

---

### 🟡 M-2: Wrong import source for `getMyOrders`

**File:** `ReviewSection.jsx:5`

```js
import { getMyOrders } from '../../services/adminService';
```

**Problem:** `getMyOrders` is a customer-facing order retrieval function but is imported from `adminService.js`. It logically belongs in `orderService.js`. While it works functionally, it violates the service layer separation of concerns.

---

### 🟡 M-3: No visual indicator that rating is required

**File:** `ReviewSection.jsx:96-101`

**Problem:** The submit button is disabled when `!formData.rating` (rating is 0), but there is no asterisk, "(Required)" label, or other visual cue telling users they must provide a rating. Users may be confused why the form won't submit.

---

### 🟡 M-4: Admin page defaults to 'pending' filter

**File:** `ReviewsPage.jsx:29`

```js
const [statusFilter, setStatusFilter] = useState('pending');
```

**Problem:** Only pending reviews are shown by default. An admin landing on the page may not realize there are approved/rejected reviews unless they manually change the filter. Consider defaulting to `''` (All) or showing a count badge for each status.

---

### 🟡 M-5: Response shape inconsistency between endpoints

**Files:** `ReviewSection.jsx:24`, `ReviewsPage.jsx:43`

```js
// ReviewSection.jsx — handles multiple response shapes
setReviews(res.data || res.rows || []);

// ReviewsPage.jsx — different handling
setRows(res.data.data?.rows || res.data.data || []);
```

**Problem:** The two consumers handle response data differently, suggesting the API response format may not be consistent, or the defensive coding is masking an underlying mismatch.

---

### 🟡 M-6: Review body has no max length on either side

**File:** `review.validation.js:8`

```js
body: Joi.string().allow(null, '')
```

**Problem:** The `body` field has no `.max()` constraint. The DB column is `TEXT` (unbounded). A user could submit a multi-megabyte review body.

**Fix:** Add a reasonable `.max()` limit (e.g., 5000 chars) and enforce on frontend too.

---

### 🟡 M-7: Verified purchase detection only checks first order

**File:** `review.service.js:56-58`

```js
if (orders && orders.length > 0) {
   orderId = orders[0].id;  // Only the first order is used
}
```

**Problem:** If a user has multiple delivered orders containing the same product, only the first one (chronologically) is linked. Minor — all detected orders are delivered, so it doesn't affect the `isVerifiedPurchase` boolean.

---

### 🟡 M-8: `create()` has triple duplicate detection

**Files:** `review.service.js:37-38`, `review.controller.js:11-18`, migration `create-reviews.js:20`

**Problem:** Duplicate review prevention exists at three levels:
1. Application-level findOne check in service (line 37)
2. Controller-level SequelizeUniqueConstraintError catch (line 11)
3. Database unique index on `(user_id, product_id)` (migration)

Redundant but not harmful — defense in depth.

---

## 6. Low Issues

### 🟢 L-1: Silently swallowed audit errors

**Files:** `review.service.js:127-137`, `155-164`

```js
try {
  if (AuditService && AuditService.log) {
    await AuditService.log({ ... });
  }
} catch(err) {}  // 🟢 Silently swallowed
```

**Problem:** If the audit database is unreachable or AuditService.log throws, the error is silently caught and ignored. Moderate/delete operations succeed but the audit trail is lost. At minimum, `logger.error()` should be called.

---

### 🟢 L-2: `avgRating` can be `null`

**File:** `review.service.js:26`

```js
const avgRating = result && result.avgRating
  ? parseFloat(parseFloat(result.avgRating).toFixed(2))
  : null;
```

**Problem:** Products with no approved reviews have `avgRating: null`. Any code rendering the average rating must handle null. The DB default is also `null`.

---

### 🟢 L-3: Migration doesn't backfill existing reviews

**File:** `20260402100008-add-order-id-to-reviews.js`

**Problem:** The migration adding `order_id` does not backfill `isVerifiedPurchase` for existing reviews. Reviews created before this migration won't have verified purchase status even if the user had a delivered order. Non-breaking — existing reviews remain accurate (they were verified at creation time via other means).

---

### 🟢 L-4: No order in default review listing

**File:** `review.controller.js:34`

```js
return paginated(res, result.rows, result.count, page, limit);
```

**Problem:** The admin review listing uses `paginated()` but the service already orders by `createdAt DESC`. This is fine functionally but the controller doesn't expose sort parameters.

---

### 🟢 L-5: No review update endpoint

**File:** `review.routes.js`

**Problem:** Users cannot edit their reviews after submission. This is a design choice (pending/approved/rejected workflow), but worth noting as a limitation. If a user needs to correct their review, they must contact an admin.

---

## 7. Already Done Well

| # | What | Location |
|---|---|---|
| ✅ 1 | **XSS sanitization** — `sanitizePlainText()` strips all HTML tags from title/body before storage | `review.service.js:77-78`, `sanitize.middleware.js:60-63` |
| ✅ 2 | **Rate limiting** — 5 reviews/day per IP via `reviewLimiter` | `rateLimiter.middleware.js:26` |
| ✅ 3 | **DB CHECK constraint** — ensures rating is between 1 and 5 | Migration `20260228100017-create-reviews.js:19` |
| ✅ 4 | **Unique index** — one review per product per user `(user_id, product_id)` | Migration `20260228100017-create-reviews.js:20` |
| ✅ 5 | **Order FK safety** — `order_id` references orders with `ON DELETE SET NULL` | Migration `20260402100008-add-order-id-to-reviews.js:8-9` |
| ✅ 6 | **CASCADE deletes** — user/product deletion cascades to their reviews | Migration `20260228100017-create-reviews.js:8-9` |
| ✅ 7 | **Feature gate** — all review routes wrapped with `featureGate('reviews')` | `review.routes.js:15` |
| ✅ 8 | **Purchase enforcement** — `requirePurchaseForReview` blocks non-purchasers | `review.service.js:72-75` |
| ✅ 9 | **Verified purchase validation** — auto-detects order or validates client-provided orderId | `review.service.js:41-69` |
| ✅ 10 | **Audit logging** on moderate and delete actions (with before/after state) | `review.service.js:127-137, 155-164` |
| ✅ 11 | **Rating cache refresh** on moderate (outside transaction to avoid long locks) | `review.service.js:119-146` |
| ✅ 12 | **Permission-based UI** — admin page conditionally shows approve/reject/delete based on user permissions | `ReviewsPage.jsx:130, 154` |
| ✅ 13 | **Server-side pagination** on admin DataGrid | `ReviewsPage.jsx:202-204` |
| ✅ 14 | **Confirmation dialog** before deleting reviews | `ReviewsPage.jsx:75` |
| ✅ 15 | **Verified purchase badge** displayed on storefront | `ReviewSection.jsx:125-127` |

---

## 8. Database Schema Validation

### `reviews` Table

| Column | Type | Constraints | Status |
|---|---|---|---|
| `id` | UUID | PK, DEFAULT gen_random_uuid() | ✅ |
| `product_id` | UUID | NOT NULL, FK → products(id) ON DELETE CASCADE | ✅ |
| `user_id` | UUID | NOT NULL, FK → users(id) ON DELETE CASCADE | ✅ |
| `order_id` | UUID | FK → orders(id) ON DELETE SET NULL | ✅ |
| `rating` | INTEGER | NOT NULL, CHECK (1-5) | ✅ |
| `title` | VARCHAR(255) | nullable | ✅ |
| `body` | TEXT | nullable | ✅ |
| `is_verified_purchase` | BOOLEAN | DEFAULT false | ✅ |
| `status` | VARCHAR(20) | DEFAULT 'pending', CHECK IN ('pending','approved','rejected') | ✅ |
| `created_at` | DATE | DEFAULT NOW() | ✅ |
| `updated_at` | DATE | DEFAULT NOW() | ✅ |

### Indexes

| Name | Columns | Type | Status |
|---|---|---|---|
| `uniq_user_product_review` | `(user_id, product_id)` | UNIQUE | ✅ |
| `idx_reviews_product` | `(product_id)` | BTREE | ✅ |
| `idx_reviews_status` | `(status)` | BTREE | ✅ |
| `idx_reviews_order` | `(order_id)` | BTREE | ✅ |

### `products` Cached Rating Fields

| Column | Type | Default | Status |
|---|---|---|---|
| `avg_rating` | DECIMAL(3,2) | null | ✅ (fits 0.00–5.00) |
| `review_count` | INTEGER | 0 | ✅ |

---

## 9. Security Review

| Threat | Mitigation | Status |
|---|---|---|
| XSS (stored) | `sanitizePlainText` strips all HTML from title/body | ✅ |
| SQL Injection | Parameterized queries via Sequelize ORM | ✅ |
| Rate Abuse | `reviewLimiter` — 5 reviews/day per IP | ✅ |
| Unauthorized Access | `authenticate` on all non-public routes | ✅ |
| Privilege Escalation | `authorizePermissions` on admin routes | ✅ (except create — see C-2) |
| Duplicate Reviews | Application-level check + DB unique index | ✅ |
| Rating Manipulation | Joi validation + DB CHECK constraint | ✅ |
| Fake Verified Badge | Server-side order validation (not trust client) | ✅ |
| IDOR (view others) | Not applicable — list filters by product slug | ✅ |
| CSRF | JWT-based auth (not cookie-based) | ✅ |
| Mass Assignment | Joi `allow()` restricts fields, no spread/assign | ✅ |

---

## 10. Permission Matrix

Based on `shared/authorization.json`:

| Permission | Key | Customer | Admin | Super Admin | Enforced on Route? |
|---|---|---|---|---|---|
| `REVIEWS_READ` | `reviews.read` | ❌ | ✅ | ✅ | ✅ `GET /reviews` |
| `REVIEWS_MODERATE` | `reviews.moderate` | ❌ | ✅ | ✅ | ✅ `PUT /admin/reviews/:id/moderate` |
| `REVIEWS_DELETE` | `reviews.delete` | ❌ | ✅ | ✅ | ✅ `DELETE /admin/reviews/:id` |
| `REVIEWS_CREATE` | `reviews.create` | ✅ | ❌ | ✅ | ❌ **Not enforced** (see C-2) |

The `REVIEWS_CREATE` permission is assigned to customers but never checked — effectively all authenticated users (regardless of role) can create reviews.

---

## 11. Recommendations

### Immediate (Fix Now)

1. **Fix rating cache on delete** — Capture `review.productId` before `destroy()` in `remove()`, then call `refreshProductRatingCache(productId)` after the transaction.

2. **Add audit logging to `create()`** — Log review creation events so there's accountability for who submitted what.

3. **Add `REVIEWS_CREATE` permission check** to the POST route, OR remove the unused permission key from `authorization.json` to avoid dead code.

### Short-term (Next Sprint)

4. **Add loading states** to `ReviewSection` component (spinner while fetching, disable button while submitting).

5. **Enforce max lengths** on frontend — add `inputProps` to title and body fields.

6. **Add `.max()` to body validation** in both Joi schema and frontend (e.g., 5000 chars).

7. **Require at least one text field** in review creation (title or body must be non-empty).

8. **Move `getMyOrders`** from `adminService.js` to `orderService.js`.

### Long-term (Backlog)

9. **Normalize admin route paths** — move `GET /reviews` to `GET /admin/reviews` for consistency with moderate/delete.

10. **Default admin filter to "All"** or show count badges for each status tab.

11. **Consider review editing** — allow users to edit pending reviews (before moderation).

12. **Add review images** — allow users to attach images to their reviews.

13. **Add sort options** to public review listing (most recent, highest rated, lowest rated).

---

## Summary

| Severity | Count | Key Action |
|---|---|---|
| 🔴 Critical | 2 | Fix cache refresh on delete + permission enforcement |
| 🟠 High | 4 | Add audit trail, text validation, max length, route consistency |
| 🟡 Medium | 8 | Loading states, import hygiene, UX improvements, length limits |
| 🟢 Low | 5 | Error handling, null handling, backfill, sort params |
| ✅ Done Well | 15 | Sanitization, rate limiting, constraints, feature gating, audit |
