# Brand Module — Complete A to Z Audit Report

**Date:** 2026-05-11
**Scope:** Full-stack brand module analysis (backend, frontend admin, storefront, settings, integrations, tests, security)
**Score:** 7.5 / 10

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Backend Module](#2-backend-module)
   - 2.1 Model
   - 2.2 Controller
   - 2.3 Service
   - 2.4 Validation
   - 2.5 Routes
3. [Frontend Admin](#3-frontend-admin)
   - 3.1 BrandsPage
   - 3.2 brandService
4. [Storefront Components](#4-storefront-components)
   - 4.1 BrandStrip
   - 4.2 ProductFilters
   - 4.3 ProductCard
   - 4.4 HomePage Integration
5. [Cross-Module Integrations](#5-cross-module-integrations)
   - 5.1 Product Module
   - 5.2 Order Module
   - 5.3 Shipping Module
6. [Settings & Configuration](#6-settings--configuration)
   - 6.1 Admin Settings
   - 6.2 Feature Flags
   - 6.3 Permissions
7. [Database Schema & Migrations](#7-database-schema--migrations)
8. [Test Coverage](#8-test-coverage)
9. [Security Analysis](#9-security-analysis)
10. [Issues Summary](#10-issues-summary)
11. [Recommendations](#11-recommendations)

---

## 1. Architecture Overview

The brand module follows the standard module pattern used across the platform:

```
server/src/modules/brand/
├── brand.model.js        # Sequelize model
├── brand.controller.js    # Express route handlers (thin)
├── brand.service.js       # Business logic
├── brand.validation.js    # Joi schemas
└── brand.routes.js        # Express router

client/src/
├── pages/admin/BrandsPage.jsx      # Admin CRUD page
├── services/brandService.js        # API client wrapper
├── components/storefront/BrandStrip.jsx  # Homepage brand strip
├── components/product/ProductFilters.jsx  # Sidebar brand filter
└── components/product/ProductCard.jsx     # Brand display on cards
```

**Data Flow:**
```
BrandsPage (admin) → brandService → GET/POST/PATCH/DELETE /api/brands → brand.controller → brand.service → Brand model (Sequelize) → PostgreSQL
BrandStrip (homepage) → brandService → GET /api/brands → brand.controller → brand.service → Brand model → PostgreSQL
ProductFilters (sidebar) → brandService → GET /api/brands?isActive=true → same chain
ProductCard → receives brand data embedded in product API response
```

---

## 2. Backend Module

### 2.1 Model (`brand.model.js`)

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | UUID | PK, `defaultValue: UUIDV4` |
| `name` | STRING(255) | `allowNull: false` |
| `slug` | STRING(255) | `unique: true`, `allowNull: false` |
| `description` | TEXT | optional |
| `image` | STRING(500) | optional |
| `isActive` | BOOLEAN | `defaultValue: true`, mapped to `is_active` |

**Association:** `Brand.hasMany(models.Product, { foreignKey: 'brandId', as: 'products' })`

**Findings:**
- UUID primary key, consistent with platform convention
- `underscored: true` — DB columns use snake_case, model uses camelCase
- `description` TEXT has no max-length enforcement (ok for CMS but could be abused)
- No paranoid/soft delete — brands are hard-deleted

### 2.2 Controller (`brand.controller.js`)

Five standard handlers: `createBrand`, `getBrands`, `getBrandBySlug`, `updateBrand`, `deleteBrand`.

**Pattern:**
```js
const fn = async (req, res, next) => {
    try {
        const result = await service.method(req.validated);
        return success(res, result, 'message', statusCode);
    } catch (err) { next(err); }
};
```

**Findings:**
- Consistently thin — delegates all logic to service
- Uses `req.validated` from validation middleware (correct pattern)
- Proper error propagation via `next(err)`

### 2.3 Service (`brand.service.js`)

#### `createBrand(data)`
- Uses transaction
- Slug auto-generation from provided slug or name with uniqueness guarantee
- Defaults `isActive` to `true` if not provided

#### `getBrands(query)`
- Supports `search` (iLike on name), `isActive` filter, pagination, sorting
- Returns `{ brands, meta: { total, page, limit, totalPages } }`

#### `getBrandBySlug(slug)`
- Includes up to 10 published, enabled products
- Returns 404 `AppError('BRAND_ERROR', ...)` if not found

#### `updateBrand(id, data)`
- Uses transaction
- If slug provided and different from current, generates new unique slug
- If name changes but no slug provided, regenerates slug from new name
- Partial update — only provided fields are changed

#### `deleteBrand(id)`
- Hard delete via `brand.destroy()`
- DB-level `ON DELETE SET NULL` cascade sets `product.brand_id = NULL`
- **No transaction** — differs from create/update pattern

**Issues:**
1. `deleteBrand` has no transaction — inconsistent with create/update
2. No audit logging for any brand operation (create/update/delete)
3. `getBrandBySlug` hardcodes product limit of 10

### 2.4 Validation (`brand.validation.js`)

| Schema | Key Rules |
|--------|-----------|
| `createBrandSchema` | `name`: required, max 255; `slug`: optional, lowercase, max 255; `isActive`: optional boolean |
| `updateBrandSchema` | All fields optional, same constraints as create |
| `queryBrandSchema` | `isActive`: optional boolean; `sortBy`: one of `name`, `created_at`, `updated_at`; `sortOrder`: `ASC`/`DESC`; `page`/`limit`: integers |

**Issues:**
- `sortBy` uses snake_case (`created_at`, `updated_at`) but Sequelize model uses camelCase (`createdAt`, `updatedAt`) — sorting by these fields silently fails
- `isActive` is Joi boolean but the service also handles string `'true'` — validation is stricter than service

### 2.5 Routes (`brand.routes.js`)

| Method | Path | Auth | Permission | Validation |
|--------|------|------|------------|------------|
| GET | `/api/brands` | No | — | `queryBrandSchema` on query |
| GET | `/api/brands/:slug` | No | — | None |
| POST | `/api/brands` | Yes | `PRODUCTS_CREATE` | `createBrandSchema` |
| PATCH | `/api/brands/:id` | Yes | `PRODUCTS_UPDATE` | `idParamSchema` (params) + `updateBrandSchema` (body) |
| DELETE | `/api/brands/:id` | Yes | `PRODUCTS_DELETE` | `idParamSchema` (params) |

**Findings:**
- `GET /:slug` has no validation middleware — no slug format check
- Routes correctly use `authenticate` + `authorizePermissions` for protected endpoints
- Permissions are from `PRODUCTS_*` namespace (brands are treated as a product sub-resource)

---

## 3. Frontend Admin

### 3.1 BrandsPage (`BrandsPage.jsx`)

**Features:**
- DataGrid with server-side pagination, search
- Columns: brand image (avatar), name, slug, status (chip), actions (edit/delete)
- Add/Edit dialog: name (required), slug (auto-generated if empty), description, logo (MediaPicker), active toggle
- Delete confirmation with warning: "Products assigned to this brand will have their brand association removed."
- Permission-gated: `PRODUCTS_CREATE` for add, `PRODUCTS_UPDATE` for edit, `PRODUCTS_DELETE` for delete

**Issues:**
1. No `isActive` filter in the toolbar — backend supports it but UI doesn't expose it
2. No live slug preview when typing name
3. No specific error feedback for slug conflicts
4. Empty slug field sends `''` — backend handles it as "auto-generate from name" but UX is confusing

### 3.2 brandService (`brandService.js`)

Five API methods: `getBrands(params)`, `getBrandBySlug(slug)`, `createBrand(data)`, `updateBrand(id, data)`, `deleteBrand(id)`.

All use standard Axios instance from `services/api.js`. No issues.

---

## 4. Storefront Components

### 4.1 BrandStrip (`BrandStrip.jsx`)

Horizontal chip strip on homepage. Each chip links to `/products?brand={brand.slug}`.

**Props:** `title` (string), `brands` (array), `loading` (boolean, default false)

**Behavior:**
- Returns `null` if not loading and brands array is empty
- Shows 8 skeleton chips during loading
- Hover effect: primary color background + translateY(-2px)

**Issues:**
- No brand logo display — text-only chips
- No max-width/overflow handling for long brand names

### 4.2 ProductFilters (`ProductFilters.jsx`)

Sidebar brand filter on the product listing page.

**Behavior:**
- Fetches active brands on mount with `{ isActive: 'true', limit: 100 }`
- Renders "All Brands" option + clickable brand list
- Setting `filters.brand` to brand slug triggers product re-fetch

**Issues:**
- Brand list is fetched once on mount and never refreshed
- Hardcoded limit of 100 brands
- No loading state for brand list (empty until fetch completes)

### 4.3 ProductCard (`ProductCard.jsx`)

Displays brand name above product title as uppercase primary-color caption.

**Behavior:**
- Shows `product.brand?.name` if available
- Renders empty placeholder box (20px height) to maintain layout consistency when no brand

No issues found.

### 4.4 HomePage Integration (`HomePage.jsx`)

**CRITICAL BUG:** The brands strip will never render due to incorrect response destructuring.

**Current code (line 103):**
```js
showBrands ? getBrands({ limit: brandsCount, isActive: true }).then(r => r.data) : Promise.resolve(null)
```

The `paginated()` response helper returns `{ success: true, data: [...], meta: {...} }`. When wrapped by Axios, `res.data` = `{ success: true, data: [...], meta: {...} }`. So `.then(r => r.data)` extracts `{ success: true, data: [...], meta: {...} }`.

Then (line 114):
```js
brands: brs.status === 'fulfilled' && Array.isArray(brs.value) ? brs.value.slice(0, brandsCount) : [],
```

`brs.value` is an object `{ success: true, data: [...], meta: {...} }`, not an array — so `Array.isArray(brs.value)` is `false`, and brands always resolves to `[]`.

**Settings wired:**
- `homepage.showBrands` — toggle
- `homepage.brandsTitle` — section heading (default: "Shop by Brand")
- `homepage.brandsCount` — max brands to show (default: 12)

---

## 5. Cross-Module Integrations

### 5.1 Product Module (`product.service.js`)

| Operation | Brand Integration |
|-----------|------------------|
| `getProducts` | Brand included in default `include`; filtered by `brand` param (slug or UUID) |
| `getProductBySlug` | Brand included via `{ model: Brand, as: 'brand' }` |
| `getProductById` | Brand included same as above |
| `getRelatedProducts` | Brand included |
| `createProduct` | Brand existence validated via `Brand.findByPk(data.brandId)` |
| `updateProduct` | Brand existence validated if `brandId` changed |

**Filter by brand (lines 247-258):**
```js
if (filters.brand) {
    const isUUID = /^[0-9a-f]{8}-...$/.test(filters.brand);
    if (isUUID) {
        where.brandId = filters.brand;
    } else {
        const b = await Brand.findOne({ where: { slug: filters.brand }, attributes: ['id'] });
        if (b) {
            where.brandId = b.id;
        } else {
            where.id = null; // No products match
        }
    }
}
```

**Issue:** The `Brand.findOne()` call for slug resolution executes on every product listing request with a brand slug filter, adding an extra query.

### 5.2 Order Module (`order.service.js`)

Brand included in product includes during checkout:
- Buy-now flow (line 779): `{ model: Brand, as: 'brand' }`
- Cart flow (line 823): `{ model: Brand, as: 'brand' }`
- Order item snapshot (line 889): `brand: product.brand || null`

No issues found.

### 5.3 Shipping Module (`shipping.service.js`)

Brand included in product includes for shipping calculations (lines 219, 251).

No issues found.

---

## 6. Settings & Configuration

### 6.1 Admin Settings

Settings page (`SettingsPage.jsx`) has three brand-related controls:

| Setting Key | Type | Default | Description |
|-------------|------|---------|-------------|
| `homepage.showBrands` | toggle | — | Show brands strip on homepage |
| `homepage.brandsTitle` | text | "Shop by Brand" | Section heading |
| `homepage.brandsCount` | number | 12 | Max brands to display |

Brands also listed as a homepage section for reordering (line 1213):
```js
['homepage', 'new arrivals', 'categories', 'featured', 'best sellers', 'on sale', 'brands', 'sections']
```

### 6.2 Feature Flags (`shared/features.js`)

```js
brand: true,  // Always enabled, not gated by ECOMMERCE_FUNCTIONALITY
```

Brands are always available regardless of marketplace mode.

### 6.3 Permissions

Brand CRUD uses `PRODUCTS_*` permissions:

| Operation | Permission |
|-----------|------------|
| Create | `PRODUCTS_CREATE` |
| Read (admin) | `PRODUCTS_READ` |
| Update | `PRODUCTS_UPDATE` |
| Delete | `PRODUCTS_DELETE` |

Both frontend and backend permissions derive from the same `shared/authorization.json`, ensuring consistency.

---

## 7. Database Schema & Migrations

### Migration 1: `20260408092050-create-brands.js`

```sql
CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    image VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
```

### Migration 2: `20260408092154-add-brand-id-to-products.js`

```sql
ALTER TABLE products ADD COLUMN brand_id UUID REFERENCES brands(id)
    ON UPDATE CASCADE ON DELETE SET NULL;
```

**FK behavior:**
- `ON UPDATE CASCADE` — brand ID changes propagate to products
- `ON DELETE SET NULL` — deleting a brand sets `products.brand_id = NULL` (products preserved, brand association removed)

---

## 8. Test Coverage

**Status: 0% — No tests exist**

No test files found for:
- `brand.service.js` (unit tests)
- `brand.controller.js` (unit/integration)
- `brand.validation.js` (unit)
- `brand.routes.js` (integration/API)
- `BrandsPage.jsx` (component/unit)
- `BrandStrip.jsx` (component)
- `ProductFilters.jsx` brand section (component)

---

## 9. Security Analysis

| Concern | Status | Notes |
|---------|--------|-------|
| Input validation | ✅ | Joi schemas on all mutating endpoints |
| RBAC | ✅ | `authenticate` + `authorizePermissions` middleware |
| SQL injection | ✅ | Mitigated by Sequelize parameterized queries |
| XSS (brand name/desc) | ❓ | No explicit sanitization on brand description (TEXT), unlike products which use `sanitize-html` |
| IDOR | ✅ | No user-owned brand data; brand CRUD is admin-only |
| Rate limiting | ✅ | Covered by global rate limiter |
| Audit trail | ❌ | No audit logging for brand operations |

---

## 10. Issues Summary

| # | Severity | Issue | Location | Impact |
|---|----------|-------|----------|--------|
| 1 | **CRITICAL** | Homepage brand strip never renders — wrong API response destructuring | `HomePage.jsx:103,114` | Brands not shown on homepage |
| 2 | **HIGH** | No audit logging for brand CRUD | `brand.service.js` | No traceability |
| 3 | **HIGH** | `sortBy` validation uses snake_case, Sequelize expects camelCase | `brand.validation.js:26` | Sorting by date fields silently fails |
| 4 | **MEDIUM** | `deleteBrand` lacks transaction | `brand.service.js:110-121` | Inconsistent state on partial failure |
| 5 | **MEDIUM** | `getBrandBySlug` hardcodes 10 product limit | `brand.service.js:65` | Incomplete product list |
| 6 | **MEDIUM** | No test coverage for brand module | entire module | Regressions undetectable |
| 7 | **MEDIUM** | Admin page lacks `isActive` filter | `BrandsPage.jsx` | Reduced admin usability |
| 8 | **LOW** | Brand slug resolution in product filter adds extra query | `product.service.js:252` | Minor perf overhead per request |
| 9 | **LOW** | BrandStrip shows text-only chips (no logo) | `BrandStrip.jsx` | Visual limitation |
| 10 | **LOW** | ProductFilters brand list never refreshes | `ProductFilters.jsx:56-64` | Shows stale data until page reload |
| 11 | **LOW** | `GET /api/brands/:slug` has no validation middleware | `brand.routes.js:16` | No slug format enforcement |
| 12 | **LOW** | Brand description not sanitized (unlike products) | `brand.service.js` | Potential XSS in rich text |

---

## 11. Recommendations

### Immediate (Critical)
1. **Fix homepage brand bug** — change `HomePage.jsx:103` from `.then(r => r.data)` to `.then(r => r.data?.data?.brands || [])`

### High Priority
2. **Add audit logging** to brand service for create/update/delete operations
3. **Fix `sortBy` values** in `brand.validation.js`: change `'created_at'` → `'createdAt'`, `'updated_at'` → `'updatedAt'`

### Medium Priority
4. **Wrap `deleteBrand` in a transaction** for consistency with create/update
5. **Make product limit configurable** in `getBrandBySlug` (default 10, accept `?productLimit=` query param)
6. **Add test suite** for brand module:
   - Unit tests for `brand.service.js` (slug generation, CRUD, error cases)
   - Integration tests for `brand.routes.js` (all endpoints)
   - Component tests for `BrandsPage.jsx`, `BrandStrip.jsx`
7. **Add `isActive` filter dropdown** to admin BrandsPage toolbar
8. **Add Joi validation middleware** to `GET /api/brands/:slug`

### Low Priority
9. **Show brand logos** in BrandStrip chips alongside brand name
10. **Refresh brand list** in ProductFilters on focus/navigation
11. **Cache brand slug → ID resolution** in product filter to avoid extra query
12. **Add sanitize-html** for brand description field
13. **Add slug preview** in admin form when typing brand name

---

*End of Report*
