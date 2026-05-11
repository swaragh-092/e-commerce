'use strict';

/**
 * Search Service — business logic for global search.
 *
 * WHY a service layer:
 * - Owns pagination logic and response shaping.
 * - Applies product pricing serialization (sale prices, labels).
 * - Runs product, brand, and category searches in parallel for
 *   a single-response multi-entity search (Amazon-style).
 * - Caches search responses to reduce database load on repeated queries.
 */

const { getPagination, getPagingData } = require('../../utils/pagination');
const { serializeProductPricing } = require('../product/product.pricing');
const { getSaleLabels } = require('../settings/saleLabel.service');
const SettingsService = require('../settings/settings.service');
const SearchRepository = require('./search.repository');
const { events, PRODUCT_EVENTS } = require('../../utils/events');

// ── Search response cache ────────────────────────────────────────────────
// Follows the same 60s TTL pattern used by saleLabelCache and featureCache.
// Avoids hitting PostgreSQL for identical searches within the TTL window —
// common when users paginate, re-submit, or type variations that debounce
// to the same query.
const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 200;
const _cache = new Map();

const buildCacheKey = (query, page, limit) =>
  `${query.trim().toLowerCase()}:${page}:${limit}`;

const cacheGet = (key) => {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  // LRU-ish: re-insert to move to end of iteration order
  _cache.delete(key);
  _cache.set(key, entry);
  return entry.data;
};

const cacheSet = (key, data) => {
  if (_cache.size >= MAX_CACHE_ENTRIES) {
    // Evict oldest entry (Map preserves insertion / re-insertion order)
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
  _cache.set(key, { data, cachedAt: Date.now() });
};

// ── Cache invalidation ────────────────────────────────────────────────────
// Clear the entire cache when any product is mutated. We could be more
// surgical (clear only keys that match affected product names), but the
// cache is small and 60s TTL means full-clear is cheap and safe.

const invalidateCache = () => {
  _cache.clear();
};

// Subscribe to product mutation events so the cache stays fresh.
// Brands and categories don't emit events yet, but their TTL handles them.
events.on(PRODUCT_EVENTS.CREATED, invalidateCache);
events.on(PRODUCT_EVENTS.UPDATED, invalidateCache);
events.on(PRODUCT_EVENTS.DELETED, invalidateCache);
events.on(PRODUCT_EVENTS.BULK_UPDATED, invalidateCache);
events.on(PRODUCT_EVENTS.BULK_DELETED, invalidateCache);
// ──────────────────────────────────────────────────────────────────────────

/**
 * Global search across products, brands, and categories.
 *
 * Responses are cached for 60s. Cache is automatically invalidated
 * when any product is created, updated, or deleted.
 *
 * @param {string} query - Search query text
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {object} { products, brands, categories, suggestion?, fromCache }
 */
const search = async (query, page = 1, limit = 20) => {
  const cacheKey = buildCacheKey(query, page, limit);

  // Serve from cache if available (hot path)
  const cached = cacheGet(cacheKey);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const { limit: queryLimit, offset } = getPagination(page, limit);

  // Run product, brand, and category searches in parallel
  const [productResults, brands, categories, labelPresets, { features }] =
    await Promise.all([
      SearchRepository.searchProducts(query, queryLimit, offset),
      SearchRepository.searchBrands(query, 5),
      SearchRepository.searchCategories(query, 5),
      getSaleLabels().catch(() => []),
      SettingsService.getFeatures(),
    ]);

  // Apply pricing serialization so sale prices and labels are consistent
  const serialized = productResults.rows.map((product) =>
    serializeProductPricing(product, { adminView: false, features }, labelPresets)
  );

  const productsPaged = getPagingData(serialized, productResults.count, page, queryLimit);

  // If everything came back empty, suggest a spelling correction
  const isEmpty =
    productResults.count === 0 && brands.length === 0 && categories.length === 0;

  const suggestion = isEmpty ? await SearchRepository.suggestCorrection(query) : null;

  const result = {
    products: productsPaged,
    brands,
    categories,
    ...(suggestion && { suggestion }),
    fromCache: false,
  };

  // Cache the response (but not zero-result typo queries — they're unique)
  if (!isEmpty || suggestion) {
    cacheSet(cacheKey, result);
  }

  return result;
};

module.exports = { search, invalidateSearchCache: invalidateCache };
