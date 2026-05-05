'use strict';

const AppError = require('../utils/AppError');
const logger   = require('../utils/logger');
const { buildFeatures } = require('../config/modes');

// ─── In-memory TTL cache ──────────────────────────────────────────────────────
// Stores the fully-resolved (mode + DB) boolean for each feature key.
// TTL: 60 s — balances freshness vs. performance.
// On a cache miss we load ALL feature settings in one DB query and populate
// every key, so subsequent gates in the same window are free.
const CACHE_TTL_MS = 60 * 1000;
const featureCache = new Map(); // key → { value: bool, expiresAt: timestamp }

/**
 * Loads all feature settings from the DB, merges them with the current mode's
 * core features, then stores every resolved key in the cache.
 *
 * @returns {Promise<Record<string, boolean>>} Fully resolved feature map
 */
const loadAndCacheAllFeatures = async () => {
  const { Setting } = require('../modules');
  const rows = await Setting.findAll({ where: { group: 'features' } });

  // Parse raw DB values to booleans
  const dbFeatures = {};
  for (const row of rows) {
    dbFeatures[row.key] = row.value === true || row.value === 'true';
  }

  // Mode-core features always win (spread order in buildFeatures)
  const resolved = buildFeatures(dbFeatures);

  // Populate cache for every key at once
  const expiresAt = Date.now() + CACHE_TTL_MS;
  for (const [key, value] of Object.entries(resolved)) {
    featureCache.set(key, { value, expiresAt });
  }

  return resolved;
};

/**
 * Returns the final resolved boolean for a feature key.
 * Cache hit → immediate return.  Cache miss → full DB reload.
 *
 * @param {string} featureKey
 * @returns {Promise<boolean>}
 */
const getResolvedFeature = async (featureKey) => {
  const now    = Date.now();
  const cached = featureCache.get(featureKey);

  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  // Cache miss or expired — reload everything from DB
  const resolved = await loadAndCacheAllFeatures();

  // If the key is not in DB or mode config, default to false (deny unknown features)
  return resolved[featureKey] ?? false;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Express middleware factory.
 * Guards a route behind a feature flag — uses final resolved value (mode + DB).
 * Returns 403 Forbidden when the feature is disabled; semantically correct because
 * the endpoint exists but access is not permitted in the current mode/config.
 *
 * @param {string} featureKey - Feature key to check (e.g. 'wishlist', 'cart')
 */
const featureGate = (featureKey) => {
  return async (req, res, next) => {
    try {
      const isEnabled = await getResolvedFeature(featureKey);
      if (!isEnabled) {
        return next(
          new AppError(
            'FEATURE_DISABLED',
            403,
            `The feature '${featureKey}' is not available in the current mode`
          )
        );
      }
      next();
    } catch (err) {
      logger.error(`[featureGate] Error resolving feature "${featureKey}":`, err);
      // Fail closed — deny access when we cannot verify
      next(
        new AppError(
          'FEATURE_DISABLED',
          403,
          `The feature '${featureKey}' is not available in the current mode`
        )
      );
    }
  };
};

/**
 * Invalidates a single feature key from the cache.
 * Call this after a feature setting is updated in the DB so the next request
 * immediately re-reads the fresh value instead of waiting for TTL expiry.
 *
 * @param {string} featureKey
 */
const invalidateFeature = (featureKey) => {
  featureCache.delete(featureKey);
};

/**
 * Clears the entire feature cache.
 * Useful in tests and after a bulk settings update.
 */
const clearFeatureCache = () => featureCache.clear();

module.exports = { featureGate, invalidateFeature, clearFeatureCache };
