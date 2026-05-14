# Search System Audit — Complete A-to-Z

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database & Indexing](#2-database--indexing)
3. [Global Search Module](#3-global-search-module)
4. [Cross-Cutting Admin Search](#4-cross-cutting-admin-search)
5. [Client-Side Search](#5-client-side-search)
6. [Performance & Scalability](#6-performance--scalability)
7. [Bugs & Issues](#7-bugs--issues)
8. [Recommendations](#8-recommendations)

---

## 1. Architecture Overview

```
                        ┌──────────────────────┐
                        │  PostgreSQL 16        │
                        │                       │
                        │  GIN indexes:         │
                        │  ├─ search_vector     │
                        │  ├─ products.name     │
                        │  ├─ products.sku      │
                        │  ├─ brands.name       │
                        │  └─ categories.name   │
                        │                       │
                        │  Extensions:          │
                        │  └─ pg_trgm           │
                        └──────────┬────────────┘
                                   │
                     raw SQL via Sequelize
                                   │
                        ┌──────────▼────────────┐
                        │   Search Repository    │
                        │  (raw queries)         │
                        │                       │
                        │  FTS: tsvector +       │
                        │       plainto_tsquery  │
                        │  + ts_rank             │
                        │                       │
                        │  Trigram: similarity() │
                        │           % operator   │
                        │           word_sim.    │
                        └──────────┬────────────┘
                                   │
                        ┌──────────▼────────────┐
                        │    Search Service      │
                        │                       │
                        │  In-memory cache       │
                        │  (60s TTL, 200 max)    │
                        │                       │
                        │  Event invalidation    │
                        │  (product CRUD)        │
                        │                       │
                        │  Spelling suggestion   │
                        └──────────┬────────────┘
                                   │
                        ┌──────────▼────────────┐
                        │    Search Controller   │
                        └──────────┬────────────┘
                                   │
                        ┌──────────▼────────────┐
                        │  Rate Limiter (30/min) │
                        └──────────┬────────────┘
                                   │
                        ┌──────────▼────────────┐
                        │   GET /api/search      │
                        │   ?q=&page=&limit=     │
                        └────────────────────────┘
```

**There is NO Elasticsearch, MeiliSearch, or Algolia.** All search is PostgreSQL-native.

### Search Strategy Stack (3 tiers)

| Tier | Technology | Purpose | Used By |
|---|---|---|---|
| 1 | `tsvector` + `plainto_tsquery` + `ts_rank` | Primary full-text relevance search | Global search (products) |
| 2 | `pg_trgm` similarity/`%` operator | Fuzzy/typo-tolerant fallback | Global search fallback, brands, categories, spelling correction |
| 3 | `Op.iLike` with `%wildcards%` | Legacy brute-force search | Admin listings (products, orders, brands, pages, reviews, audit logs, users) |

---

## 2. Database & Indexing

### Migrations

| Migration | What it does | Index created |
|---|---|---|
| `20260511120000-add-product-search-vector.js` | Adds `search_vector tsvector` column, trigger, GIN index, backfill | `idx_products_search_vector` (GIN) |
| `20260511130000-enable-pg-trgm.js` | Enables `CREATE EXTENSION pg_trgm` | — |
| `20260511140000-add-trigram-indexes.js` | Creates trigram GIN indexes | `idx_products_name_trgm`, `idx_products_sku_trgm`, `idx_brands_name_trgm`, `idx_categories_name_trgm` |

### Search Vector Trigger

```sql
CREATE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('simple', COALESCE(NEW.name, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.short_description, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_search_vector
    BEFORE INSERT OR UPDATE OF name, short_description
    ON products FOR EACH ROW
    EXECUTE FUNCTION products_search_vector_update();
```

**Key points:**
- Only triggers on `name` or `short_description` changes
- Uses `'simple'` language config (no stemming — better for product names/SKUs)
- Name = weight A (highest), Short Description = weight B
- `search_vector` is excluded from API responses via model `defaultScope` + explicit `DELETE`

### Indexes Summary

| Table | Column | Index Type | Purpose |
|---|---|---|---|
| `products` | `search_vector` | GIN | Full-text search |
| `products` | `name` | GIN (`gin_trgm_ops`) | Trigram fuzzy search |
| `products` | `sku` | GIN (`gin_trgm_ops`) | Trigram SKU search |
| `brands` | `name` | GIN (`gin_trgm_ops`) | Trigram brand search |
| `categories` | `name` | GIN (`gin_trgm_ops`) | Trigram category search |

**No indexes exist for:** `products.description`, `orders.*`, `pages.*`, `audit_logs.*` — admin `Op.iLike` search on these will perform sequential scans.

---

## 3. Global Search Module

### Files

| File | Path | Purpose |
|---|---|---|
| Routes | `server/src/modules/search/search.routes.js` | `GET /api/search` |
| Controller | `server/src/modules/search/search.controller.js` | Thin handler |
| Service | `server/src/modules/search/search.service.js` | Cache + orchestration |
| Repository | `server/src/modules/search/search.repository.js` | **Raw SQL queries** |
| Validation | `server/src/modules/search/search.validation.js` | Joi: `q` (2-100), `page`, `limit` (1-50) |

### Endpoint

```
GET /api/search?q=iphone&page=1&limit=20
```

**Response shape:**
```json
{
  "success": true,
  "data": {
    "products": {
      "data": [{ "id", "name", "slug", "price", ... }],
      "totalItems": 42,
      "totalPages": 3,
      "currentPage": 1,
      "limit": 20
    },
    "brands": [{ "id", "name", "slug", "image" }],
    "categories": [{ "id", "name", "slug", "image" }],
    "suggestion": "iphone"  // or null
  },
  "message": "Search results"
}
```

### Rate Limiting

- **30 requests per minute** per IP
- Applied via `searchLimiter` middleware

### Query Execution

The search service runs **5 parallel queries**:

```
Promise.all([
  searchProducts(query, limit, offset),    // paginated, 2-strategy
  searchBrands(query, 5),                  // top 5
  searchCategories(query, 5),              // top 5
  getSaleLabels(),                         // active sale labels
  getFeatures(),                           // feature flags
])
```

### searchProducts() — Dual Strategy

**Strategy 1 — Full-Text Search (FTS):**
```sql
WHERE "Product"."search_vector" @@ plainto_tsquery('simple', $queryText)
ORDER BY ts_rank("Product"."search_vector", plainto_tsquery('simple', $queryText)) DESC
```

**Strategy 2 — Trigram fallback (if FTS ≤ 3 results):**
```sql
WHERE similarity("Product"."name", $queryText) > 0.2
   OR similarity("Product"."sku", $queryText) > 0.3
ORDER BY GREATEST(similarity(name, $queryText), similarity(sku, $queryText)) DESC
```

- Results are **merged & deduplicated** — FTS results keep their rank order, trigram results appended
- Count = `Math.max(ftsCount, trigramCount)` (upper-bound approximation)
- If `pg_trgm` extension is missing, silently falls back to FTS-only

### searchBrands() & searchCategories()

Trigram-only:
```sql
WHERE name % $queryText  -- trigram similarity operator
ORDER BY similarity(name, $queryText) DESC
```

**Brands** filter `isActive = true`. **Categories** have NO visibility filter.

### Spelling Correction

If all results are empty, `suggestCorrection()` runs:
```sql
SELECT name, word_similarity(LOWER(name), $normalizedQuery) as score
FROM products WHERE ...  -- union across brands, categories
ORDER BY score DESC LIMIT 1
```
Returns best match with score ≥ 0.2.

### Caching

| Property | Value |
|---|---|
| **Type** | In-memory `Map` |
| **TTL** | 60 seconds |
| **Max entries** | 200 |
| **Eviction** | Manual — when full, stops caching new entries |
| **Key** | `"${query}:${page}:${limit}"` (lowercased) |
| **Invalidation** | On product CRUD events (created, updated, deleted, bulk) |
| **Cache headers** | `X-Cache: HIT` or `X-Cache: MISS` |

**Note:** Cache is per-process, NOT shared across instances (no Redis).

---

## 4. Cross-Cutting Admin Search

These use `Op.iLike` with `%` wildcards — separate from the global FTS search.

| Endpoint | File | Fields Searched | Escapes `%_`? |
|---|---|---|---|
| `GET /api/products?search=` | `product.service.js:321` | `name`, `description` | **NO** |
| `GET /api/brands?search=` | `brand.service.js:57` | `name` | **NO** |
| `GET /api/orders?search=` | `order.service.js:1339` | `orderNumber`, `status`, product name, user name/email | **NO** |
| `GET /api/reviews?search=` | `review.service.js:157` | User name, product name, review title | **YES** |
| `GET /api/audit-logs?search=` | `audit.service.js:68` | `entity`, `entityId`, user name/email | **YES** |
| `GET /api/pages?search=` | `page.service.js:23` | `title`, `content` | **NO** |
| `GET /api/admin/access-users?search=` | `admin.service.js:422` | `email`, `firstName`, `lastName` | **NO** |

Only `review.service.js` and `audit.service.js` properly escape `%` and `_` wildcards.

---

## 5. Client-Side Search

### Files

| File | Purpose |
|---|---|
| `client/src/services/searchService.js` | API wrapper → `GET /api/search` |
| `client/src/components/search/SearchWidget.jsx` | Header autocomplete (672 lines) |
| `client/src/pages/storefront/SearchResultsPage.jsx` | Full results page |
| `client/src/hooks/useDebounce.js` | 300ms debounce hook |

### SearchWidget Features

- **5 variants:** `header`, `inline`, `sidebar`, `minimal`, `default`
- 300ms debounced input
- Autocomplete dropdown: product images, brand avatars, category icons
- Recent searches stored in localStorage (max 5)
- Keyboard navigation: ArrowUp/Down, Enter, Escape
- Spelling suggestion chip ("Did you mean...?")
- "See all results" link when > 5 products match
- Navigates to `/products?search=QUERY` or custom `onSearch` callback

### SearchResultsPage

- Route: `/search?q=...&page=...`
- Fetches with `limit: 20`
- Displays in `ProductGrid`
- MUI P̅agination component
- No-results state with spelling suggestion
- `PageSEO` meta tags

---

## 6. Performance & Scalability

### Strengths

| Aspect | Detail |
|---|---|
| **Indexes** | FTS GIN index + 4 trigram GIN indexes cover primary search paths |
| **Bind parameters** | All user input uses Sequelize bind params — no SQL injection |
| **Rate limiting** | 30 req/min prevents catalog enumeration |
| **Pagination cap** | Max 50 results per page (validation), max 1000 (pagination util) |
| **Cache TTL** | 60s reduces repetitive queries |
| **Description excluded from FTS** | Keeps `search_vector` lean (would be huge if full description indexed) |
| **Parallel queries** | Brands, categories, labels fetched concurrently with products |

### Weaknesses

| Aspect | Issue |
|---|---|
| **No Redis** | In-memory cache is per-process, lost on restart, not shared across instances |
| **Cache invalidation incomplete** | Only product events clear cache — brand/category name changes stale until 60s TTL |
| **No description index** | Admin `Op.iLike` on `products.description` is a sequential scan |
| **Count approximation** | `Math.max(ftsCount, trigramCount)` is an upper bound, not exact |
| **No order indexes for search** | Admin searches on `orders.*` have no trigram indexes |
| **Debounce + rate limit** | 300ms debounce + 30/min limit ≈ ~9s of typing hits the limit |

---

## 7. Bugs & Issues

### WILDCARD INJECTION — 5 of 8 admin search endpoints

| # | Severity | File | Lines | Description |
|---|---|---|---|---|
| 1 | **MEDIUM** | `product.service.js` | 321-325 | `Op.iLike` with unescaped `%`/`_` — search for `"100%"` matches everything |
| 2 | **MEDIUM** | `brand.service.js` | 57-58 | Same — search for `"test_"` matches `test1`, `test2`, etc. |
| 3 | **MEDIUM** | `order.service.js` | 1339-1353 | Same — across 6+ fields |
| 4 | **MEDIUM** | `page.service.js` | 23-26 | Same — `title` and `content` |
| 5 | **MEDIUM** | `admin.service.js` | 422-427 | Same — `email`, `firstName`, `lastName` |

Not SQL injection (Sequelize parameterizes), but produces wildly inaccurate results.

### NO VISIBILITY FILTER ON CATEGORY SEARCH

| # | Severity | File | Lines | Description |
|---|---|---|---|---|
| 6 | **LOW** | `search.repository.js` | categories query | No `isActive`/status filter — inactive/deleted categories appear in search results and suggestions |

### BRAND/CATEGORY CHANGES DON'T INVALIDATE CACHE

| # | Severity | File | Lines | Description |
|---|---|---|---|---|
| 7 | **LOW** | `search.service.js` | event subscription | Only product events clear cache. Brand/category name changes stale until 60s TTL expires |

### FTS DOES NOT SEARCH FULL DESCRIPTION

| # | Severity | File | Lines | Description |
|---|---|---|---|---|
| 8 | **LOW** | migration trigger | — | `search_vector` only includes `name` + `short_description`. Keywords only in full `description` are invisible to FTS |

### CATEGORY-ONLY USERS SEE INACTIVE CATEGORIES

| # | Severity | File | Lines | Description |
|---|---|---|---|---|
| 9 | **LOW** | `search.repository.js` | suggestCorrection | Category spelling suggestions don't filter by `isActive` |

### COUNT IS APPROXIMATE WITH LOW FTS RESULTS

| # | Severity | File | Lines | Description |
|---|---|---|---|---|
| 10 | **LOW** | `search.repository.js` | 161 | `Math.max(ftsCount, trigramCount)` — count can be inflated when FTS has few matches |

---

## 8. Recommendations

### Priority 1 — Fix Wildcard Injection (5 files)

Add escaping to all `Op.iLike` search endpoints. Copy the pattern from `review.service.js`:

```javascript
// Before:
{ name: { [Op.iLike]: `%${search}%` } }

// After:
const escaped = search.replace(/[%_]/g, '\\$&');
{ name: { [Op.iLike]: `%${escaped}%` } }
```

Files to fix:
- `product.service.js:321`
- `brand.service.js:57`
- `order.service.js:1339`
- `page.service.js:23`
- `admin.service.js:422`

### Priority 2 — Add Visibility Filter to Category Search

```sql
-- search.repository.js — searchCategories
WHERE isActive = true AND name % $queryText
```

### Priority 3 — Invalidate Cache on Brand/Category Changes

Subscribe to brand and category CRUD events in `search.service.js`:

```javascript
eventBus.on(BRAND_EVENTS.UPDATED, invalidateCache);
eventBus.on(CATEGORY_EVENTS.UPDATED, invalidateCache);
```

### Priority 4 — Consider Including Full Description in FTS

If products frequently have search-relevant keywords only in `description`, update the trigger:

```sql
setweight(to_tsvector('simple', COALESCE(NEW.description, '')), 'C')
```

**Trade-off:** Larger `search_vector`, slower inserts/updates, larger GIN index.

### Priority 5 — Add Trigram Indexes for Admin Search Columns

Admin search on `products.description`, `orders.orderNumber`, `orders.status`, `pages.title`, `pages.content` would benefit from GIN trigram indexes if those searches are frequent.
