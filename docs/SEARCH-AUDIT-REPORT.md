# Global Search Module — A-to-Z Audit Report

> **Audit Date:** May 11, 2026
> **Scope:** Full-stack — client search components, server module, DB migrations, security, performance
> **Files Reviewed:** 15 source files across `client/`, `server/`, and `server/migrations/`

---

## Table of Contents

1. [Module Overview](#1-module-overview)
2. [Architecture & Data Flow](#2-architecture--data-flow)
3. [Database & Migrations](#3-database--migrations)
4. [Backend Audit](#4-backend-audit)
5. [Frontend Audit](#5-frontend-audit)
6. [Security Audit](#6-security-audit)
7. [Performance Audit](#7-performance-audit)
8. [Edge Cases](#8-edge-cases)
9. [Bugs Found](#9-bugs-found)
10. [Missing Features](#10-missing-features)
11. [Final Verdict](#11-final-verdict)

---

## 1. Module Overview

The Global Search module provides a multi-entity search across **products**, **brands**, and **categories** simultaneously (Amazon-style). It powers two frontend surfaces:

| Surface | File | Purpose |
|---------|------|---------|
| `GlobalSearchBar` | `client/src/components/search/GlobalSearchBar.jsx` | Live dropdown in store header — debounced, keyboard-navigable, shows top 5 products + 3 brands + 3 categories |
| `SearchResultsPage` | `client/src/pages/storefront/SearchResultsPage.jsx` | Full paginated results page at `/search?q=...` |

**Backend search strategy:** Two-tier PostgreSQL search — primary `tsvector`/GIN Full-Text Search with `pg_trgm` trigram similarity fallback for typo tolerance.

### Files Reviewed

| Layer | File Path | Lines |
|-------|-----------|-------|
| **Routes** | `server/src/modules/search/search.routes.js` | 33 |
| **Validation** | `server/src/modules/search/search.validation.js` | 28 |
| **Controller** | `server/src/modules/search/search.controller.js` | 23 |
| **Service** | `server/src/modules/search/search.service.js` | 52 |
| **Repository** | `server/src/modules/search/search.repository.js` | 206 |
| **Rate Limiter** | `server/src/middleware/rateLimiter.middleware.js` | 49 |
| **Migration 1** | `server/migrations/20260511120000-add-product-search-vector.js` | 67 |
| **Migration 2** | `server/migrations/20260511130000-enable-pg-trgm.js` | 33 |
| **Migration 3** | `server/migrations/20260511140000-add-trigram-indexes.js` | 41 |
| **Product Model** | `server/src/modules/product/product.model.js` | 161 |
| **GlobalSearchBar** | `client/src/components/search/GlobalSearchBar.jsx` | 416 |
| **SearchResultsPage** | `client/src/pages/storefront/SearchResultsPage.jsx` | 285 |
| **searchService** | `client/src/services/searchService.js` | 17 |
| **useDebounce** | `client/src/hooks/useDebounce.js` | 33 |
| **API client** | `client/src/services/api.js` | 99 |
| **Store Layout** | `client/src/layouts/StoreLayout.jsx` | 535 |

---

## 2. Architecture & Data Flow

```
User types in GlobalSearchBar
        │
        ▼ (debounce 300ms)
searchService.searchProducts({ q, limit: 5 })
        │
        ▼
Axios GET → http://localhost:5000/api/search?q=...&limit=5
        │
        ▼
Express Router → searchLimiter (30 req/min) → Joi validation
        │
        ▼
SearchController.search(req, res)
        │
        ▼
SearchService.search(query, page, limit)
        │
        ├─► SearchRepository.searchProducts(query, limit, offset)
        │       ├─ PostgreSQL FTS (tsvector @@ plainto_tsquery + ts_rank)
        │       └─ Fallback: pg_trgm similarity (if ≤ 3 FTS results)
        │
        ├─► SearchRepository.searchBrands(query, 5)  [trigram similarity]
        │
        └─► SearchRepository.searchCategories(query, 5)  [trigram similarity]
        │
        ▼
Response: { products: { data, pagination }, brands: [...], categories: [...] }
        │
        ▼
GlobalSearchBar renders rich dropdown with sections
  OR
SearchResultsPage renders paginated ProductGrid
```

### ✅ Architecture Strengths

- **Clean layered separation**: Routes → Middleware → Controller → Service → Repository. Each layer has a single responsibility.
- **Parallel execution**: `Promise.all` runs product, brand, category, sale labels, and feature flags concurrently.
- **Public endpoint**: No auth required — correct for a search feature.
- **Repository isolation**: Raw SQL is confined to the repository layer, making it easy to swap search backends (e.g., Elasticsearch) without touching business logic.

---

## 3. Database & Migrations

### Migration 1: `20260511120000-add-product-search-vector.js`

Adds `search_vector tsvector` column to `products` with:
- **Trigger function** `products_search_vector_update()` — fires on `INSERT` or `UPDATE of name, short_description`
- **Weighting**: `name` = A (highest), `short_description` = B
- **Language config**: `'simple'` — tokenizes without stemming (better for product names)
- **GIN index** `idx_products_search_vector` for sub-millisecond `@@` lookups

### Migration 2: `20260511130000-enable-pg-trgm.js`

Enables PostgreSQL `pg_trgm` extension for fuzzy/typo-tolerant search.

### Migration 3: `20260511140000-add-trigram-indexes.js`

Creates GIN trigram indexes on:

| Index | Column | Purpose |
|-------|--------|---------|
| `idx_products_name_trgm` | `products.name` | Fuzzy product name matching |
| `idx_products_sku_trgm` | `products.sku` | Partial SKU / typo search |
| `idx_brands_name_trgm` | `brands.name` | Brand name fuzzy search |
| `idx_categories_name_trgm` | `categories.name` | Category name fuzzy search |

### ✅ What's Correct

- Trigger-based `search_vector` maintenance guarantees consistency even with raw SQL, migrations, or seeders — zero app code needed.
- `'simple'` language config is appropriate for e-commerce product names (English stemmer would be too aggressive).
- GIN indexes on both tsvector and trigram ensure query performance at scale.

### ⚠️ Concerns

- **Backfill lock risk**: The `UPDATE products SET search_vector = ...` statement in migration 1 locks the `products` table. Fine for dev/staging; for production with 100K+ rows, batch the update in chunks of 1000.
- **No `long_description` in search vector**: Only `name` and `short_description` are indexed. Rich product descriptions won't be searchable. Consider adding `long_description` with weight C.

---

## 4. Backend Audit

### 4a. Routes (`search.routes.js`) ✅

```
GET /api/search?q=iphone&page=1&limit=20
Middleware chain: searchLimiter → validate(searchQuerySchema, 'query') → SearchController.search
```

Rate-limited (30 req/min), Joi-validated, no auth. Clean and correct.

### 4b. Validation (`search.validation.js`) ✅

| Field | Rule | Rationale |
|-------|------|-----------|
| `q` | string, trimmed, min 2, max 100, required | Prevents irrelevant results and DoS via oversized queries |
| `page` | integer, min 1, default 1 | Standard pagination |
| `limit` | integer, min 1, max 50, default 20 | Caps page size to prevent catalog scraping |

### 4c. Controller (`search.controller.js`) ✅

Thin HTTP adapter — zero business logic, zero DB calls. Delegates to service, catches errors via `next(err)`.

### 4d. Service (`search.service.js`)

```js
const search = async (query, page = 1, limit = 20) => {
  const { limit: queryLimit, offset } = getPagination(page, limit);

  const [productResults, brands, categories, labelPresets, { features }] =
    await Promise.all([
      SearchRepository.searchProducts(query, queryLimit, offset),
      SearchRepository.searchBrands(query, 5),
      SearchRepository.searchCategories(query, 5),
      getSaleLabels().catch(() => []),
      SettingsService.getFeatures(),
    ]);

  const serialized = productResults.rows.map((product) =>
    serializeProductPricing(product, { adminView: false, features }, labelPresets)
  );

  return {
    products: getPagingData(serialized, productResults.count, page, queryLimit),
    brands,
    categories,
  };
};
```

#### ✅ Correct

- Pagination uses shared `getPagination`/`getPagingData` utilities consistent with the rest of the app.
- `serializeProductPricing` ensures sale prices and labels are consistent with product detail pages.
- `getSaleLabels()` has a `.catch(() => [])` guard.

#### 🐛 Bug: `SettingsService.getFeatures()` has no error guard

If `getFeatures()` throws, the entire `Promise.all` rejects — no search results are returned even though product/brand/category data is available. `getSaleLabels()` has a `.catch()` but features does not.

**Fix:** Add `.catch(() => ({ features: {} }))`.

### 4e. Repository (`search.repository.js`)

#### Two-Tier Search Strategy

**Tier 1 — PostgreSQL Full-Text Search:**
```sql
WHERE "Product"."search_vector" @@ plainto_tsquery('simple', $queryText)
ORDER BY ts_rank("Product"."search_vector", plainto_tsquery('simple', $queryText)) DESC
```

**Tier 2 — Trigram Similarity Fallback** (activated when FTS returns ≤ 3 results):
```sql
WHERE similarity("Product"."name", $queryText) > 0.2
   OR similarity("Product"."sku", $queryText) > 0.3
ORDER BY GREATEST(similarity("Product"."name", $queryText),
                  similarity("Product"."sku", $queryText)) DESC
```

#### ✅ Correct

- SQL injection safe: All user input through Sequelize bind parameters (`$queryText`).
- `plainto_tsquery()` is inherently safe — treats input as plain text.
- Graceful `pg_trgm` degradation: If the extension is not installed, the try/catch returns FTS results.
- `subQuery: false` prevents unnecessary wrapping. `distinct: true` prevents join-based duplication.
- `search_vector` excluded from attributes in API responses.

#### 🐛 BUG: Incorrect merged count in trigram fallback (Line 156)

```js
const merged = [
  ...ftsResults.rows,
  ...trigramResults.rows.filter((r) => !ftsIds.has(r.id)),
];

return {
  rows: merged.slice(0, limit),
  count: ftsResults.count + trigramResults.count - ftsResults.rows.length, // ❌ BUG
};
```

`ftsResults.count` = **total** FTS matches across all pages. `ftsResults.rows.length` = items on the **current page only**. The subtraction mixes page-level and total-level values, producing a meaningless count.

**Impact:** When trigram fallback activates:
- GlobalSearchBar's "See all N results" link shows an incorrect total
- SearchResultsPage pagination shows wrong `totalPages`
- The result count chip shows the wrong number

**Fix:** Since a true deduplicated union count is expensive, use a practical approximation:
```js
count: Math.max(ftsResults.count, trigramResults.count)
```

#### 🐛 BUG: No status/visibility filters on brand and category search (Lines 171-204)

Product search filters `status: 'published', isEnabled: true, deletedAt: null`. Brand and category searches have **none** of these filters:

```js
const searchBrands = async (queryText, limit = 5) => {
  return await Brand.findAll({
    where: Sequelize.literal(`name % $queryText`),
    // ❌ No status/isEnabled/deletedAt filter
  });
};
```

**Impact:** Disabled, soft-deleted, or unpublished brands and categories can appear in the search dropdown.

---

## 5. Frontend Audit

### 5a. GlobalSearchBar (`GlobalSearchBar.jsx`)

| Feature | Status | Notes |
|---------|--------|-------|
| Debounce (300ms) | ✅ | Uses shared `useDebounce` hook |
| Min query length (2) | ✅ | Checked before fetch |
| Cancellation flag | ✅ | Prevents stale responses on rapid typing |
| Keyboard navigation | ✅ | ArrowUp/Down/Enter/Escape |
| Loading spinner | ✅ | `CircularProgress` replaces search icon |
| No results state | ✅ | `SearchOffIcon` with "No results for ..." |
| "See all" link | ✅ | When totalItems > PRODUCT_LIMIT (5) |
| ClickAwayListener | ✅ | Closes dropdown on outside click |
| Rich sections | ✅ | Products (thumbnail + price), Brands (logo), Categories (image) |

#### ⚠️ Minor Issues

- **`allItems` recomputed on every render**: `buildItemList(results)` is called inline on render (line 48). Should use `useMemo`.
- **`setQuery('')` not in `closeDropdown`**: The `closeDropdown` callback only sets `open` and `selectedIndex`. Each navigation handler (`handleItemClick`, `handleSeeAll`, Enter key) manually calls `setQuery('')`. Works but inconsistent abstraction.

### 5b. SearchResultsPage (`SearchResultsPage.jsx`)

| Feature | Status | Notes |
|---------|--------|-------|
| URL-driven state | ✅ | Reads `q` and `page` from URL search params |
| Back/forward sync | ✅ | URL → local input via separate `useEffect` |
| Debounced input → URL | ✅ | Two-way sync pattern |
| Pagination | ✅ | MUI `<Pagination>` with first/last buttons |
| Loading skeleton | ✅ | Via `ProductGrid loading={true}` |
| No results state | ✅ | "Browse all products" fallback |
| SEO metadata | ✅ | `<PageSEO>` component |

#### ⚠️ Fragile Two-Way URL Sync

The page uses two `useEffect` hooks for bidirectional URL ↔ state synchronization:

```js
// Effect 1: debouncedInput → URL params
useEffect(() => {
  if (debouncedInput !== urlQuery) {
    if (debouncedInput.length >= 2) {
      setSearchParams({ q: debouncedInput, page: '1' });
    } else if (debouncedInput.length === 0 && urlQuery) {
      setSearchParams({});
    }
  }
}, [debouncedInput]);

// Effect 2: URL → local input (browser back/forward)
useEffect(() => {
  setSearchInput(urlQuery);
}, [urlQuery]);
```

**Issues:**
1. If `debouncedInput` is between 0 and 2 chars (e.g., 1 character after backspace), the URL is not cleared — the stale query remains in the URL bar.
2. `eslint-disable react-hooks/exhaustive-deps` on line 64 — intentional but fragile.
3. Works in practice but is a known anti-pattern. A single-source-of-truth approach (the URL) would be more predictable.

### 5c. searchService.js ✅

```js
export const searchProducts = async (params) => {
  const response = await api.get('/search', { params });
  return response.data;
};
```

Clean and minimal. Correctly unwraps the Axios envelope.

### 5d. API Client (`api.js`) ⚠️

The Axios interceptor attaches the `Authorization: Bearer` header to every request, including public search. Harmless but unnecessary. On 401, the refresh token flow could fire for search requests — wasted effort.

---

## 6. Security Audit

| Category | Status | Details |
|----------|--------|---------|
| SQL injection | ✅ Safe | All input via Sequelize bind params (`$queryText`). `plainto_tsquery()` treats input as plain text — no operator injection |
| Rate limiting | ✅ | 30 req/min per IP via `express-rate-limit` |
| Input validation | ✅ | Joi: `q` min 2 / max 100, trimmed, `page` min 1, `limit` 1-50. Unknown params stripped |
| Auth | ✅ Not required | Public GET endpoint |
| CORS | ✅ | Restricted to allowed origins |
| Helmet | ✅ | Security headers applied globally |
| `search_vector` exposure | ✅ No | Excluded from default scope + repository `attributes: { exclude: ['search_vector'] }` |
| CSRF | ✅ N/A | GET endpoint — CSRF not relevant |
| Auth token on search | ⚠️ Low | `Authorization` header attached unnecessarily for public requests |
| Disabled entities in results | 🐛 | Brand/category search missing status/isEnabled/deletedAt filters |

---

## 7. Performance Audit

| Item | Status | Details |
|------|--------|---------|
| GIN index on `search_vector` | ✅ | Sub-millisecond `@@` lookups |
| GIN trigram indexes | ✅ | On `name`, `sku`, `brands.name`, `categories.name` |
| `ts_rank` relevance | ✅ | Proper weighting: name (A) > description (B) |
| Parallel `Promise.all` | ✅ | 5 queries run concurrently |
| `subQuery: false` | ✅ | Prevents unnecessary subquery wrapping |
| `distinct: true` | ✅ | Prevents join-based duplication |
| Debounced input (300ms) | ✅ | Reduces API calls on rapid typing |
| Cancellation flag | ✅ | Prevents stale response processing |
| **Two-tier query overhead** | ⚠️ | When FTS returns ≤ 3 results, a second trigram query runs. Acceptable trade-off for typo tolerance |

---

## 8. Edge Cases

| Scenario | Expected Behavior | Actual Behavior | Verdict |
|----------|-------------------|-----------------|---------|
| Empty query string | 400 validation error | 400 — "Search query is required" | ✅ |
| 1-char query | 400 validation error | 400 — "min 2 characters" | ✅ |
| 101-char query | 400 validation error | 400 — "max 100 characters" | ✅ |
| Special chars (`!@#$%`) | `plainto_tsquery` strips them | Safe — no injection | ✅ |
| Unicode / emoji | Tokenized by `simple` config | Should match as-is | ✅ |
| Negative page number | Joi `min(1)` catches it | 400 validation error | ✅ |
| `page` as string ("abc") | Joi validates as integer | 400 validation error | ✅ |
| `limit` > 50 | Joi caps at 50 | 400 validation error | ✅ |
| No `pg_trgm` extension | Fallback to FTS | Try/catch returns FTS results gracefully | ✅ |
| DB connection lost | Propagates to error handler | `next(err)` → global error handler | ✅ |
| Sale labels service down | Products shown without sale info | `.catch(() => [])` — acceptable fallback | ⚠️ |
| Features service down | **Entire search breaks** | No `.catch()` — `Promise.all` rejects | 🐛 |
| Exact SKU search | Trigram on `sku` at 0.3 threshold | Matches correctly | ✅ |
| DebouncedInput = 1 char (SearchResultsPage) | Should clear URL | **Stale query remains in URL** | ⚠️ |

---

## 9. Bugs Found

### 🐛 CRITICAL — Incorrect merged count in trigram fallback

**File:** `server/src/modules/search/search.repository.js:156`

```js
count: ftsResults.count + trigramResults.count - ftsResults.rows.length
```

Mixes total-level counts with page-level row length. Produces incorrect pagination metadata when trigram fallback activates. Affects both GlobalSearchBar's "See all N results" count and SearchResultsPage's pagination.

**Fix:**
```js
count: Math.max(ftsResults.count, trigramResults.count)
```

### 🐛 MEDIUM — Brand/category search missing status/visibility filters

**File:** `server/src/modules/search/search.repository.js:171-204`

Brand and category searches use raw trigram matching without filtering on `isEnabled`, `status`, or `deletedAt`. Disabled or soft-deleted entities can appear in search results.

**Fix:** Add `{ isEnabled: true, deletedAt: null }` (and `status: 'active'` if applicable) to brand and category `findAll` queries.

### 🐛 MEDIUM — `getFeatures()` failure crashes entire search

**File:** `server/src/modules/search/search.service.js:37`

```js
SettingsService.getFeatures()  // No .catch() — can reject the entire Promise.all
```

Unlike `getSaleLabels()` which has `.catch(() => [])`, feature loading has no error guard.

**Fix:** Replace with `SettingsService.getFeatures().catch(() => ({ features: {} }))`.

### ⚠️ LOW — Fragile two-way URL sync in SearchResultsPage

**File:** `client/src/pages/storefront/SearchResultsPage.jsx:55-70`

Two `useEffect` hooks bidirectionally sync URL params and local state. When `debouncedInput` is 1 character, the stale query remains in the URL. Pattern uses `eslint-disable` to suppress exhaustive-deps warnings.

**Suggestion:** Use URL as single source of truth — read from URL for fetches, write only on debounced input.

---

## 10. Missing Features

| Feature | Priority | Suggestion |
|---------|----------|-----------|
| `long_description` in search vector | Medium | Add to tsvector with weight C for full-content searchability |
| Search analytics / trending | Low | Track popular and zero-result queries for merchandising insights |
| Category/brand facet filtering | Medium | Allow users to filter search results by category on SearchResultsPage |
| Search result highlighting | Low | Show matched terms in product name/description in search results |
| "Did you mean?" suggestions | Low | Use `pg_trgm` to suggest corrections for zero-result queries |
| Response caching | Medium | Cache frequent/repeated queries to reduce DB load |
| Sorting options on search page | Low | Add price/sort controls alongside relevance-based ordering |
| Mobile search overlay | Low | Mobile search navigates away from page — a drawer/overlay would be less disruptive |

---

## 11. Final Verdict

### Score: 7.5 / 10

### Strengths

- Clean layered architecture with proper separation of concerns
- Sophisticated two-tier PostgreSQL search (FTS + trigram fallback)
- SQL-injection-safe via bind parameters throughout
- Proper rate limiting, input validation, and response shaping
- Excellent frontend UX — debounced, keyboard-navigable, rich multi-entity dropdown
- Consistent pricing serialization with product detail pages
- Trigger-maintained search vector guarantees consistency

### Must Fix

| # | Issue | File | Severity |
|---|-------|------|----------|
| 1 | Incorrect merged count in trigram fallback | `search.repository.js:156` | 🔴 Critical |
| 2 | Brand/category search missing status/visibility filters | `search.repository.js:171-204` | 🟠 High |
| 3 | `getFeatures()` crash kills entire search | `search.service.js:37` | 🟠 High |

### Should Fix

| # | Issue | File | Severity |
|---|-------|------|----------|
| 4 | Migration backfill locks products table | `20260511120000-add-product-search-vector.js` | 🟡 Medium |
| 5 | Two-way URL sync is fragile | `SearchResultsPage.jsx:55-70` | 🟡 Medium |
| 6 | `allItems` recomputed on every render | `GlobalSearchBar.jsx:48` | 🟢 Low |
| 7 | Auth token sent on public search requests | `api.js` | 🟢 Low |

### Nice to Have

- Add `long_description` to search vector
- Add response caching for repeated queries
- Add search analytics tracking
- Add "Did you mean?" suggestions for zero-result queries
- Add category/brand facet filtering on search results page
