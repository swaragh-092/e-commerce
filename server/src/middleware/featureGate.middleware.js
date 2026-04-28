'use strict';

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

// In-memory TTL cache to avoid hitting DB on every featureGate'd request
// TTL: 60 seconds — balances freshness vs performance
const CACHE_TTL_MS = 60 * 1000;
const featureCache = new Map(); // key → { value: bool, expiresAt: timestamp }

const getCachedSetting = async (featureKey) => {
    const now = Date.now();
    const cached = featureCache.get(featureKey);

    if (cached && cached.expiresAt > now) {
        return cached.value;
    }

    // Cache miss or expired — query DB
    const { Setting } = require('../modules');
    const featureSetting = await Setting.findOne({ where: { group: 'features', key: featureKey } });
    
    let isEnabled = false;
    if (featureSetting) {
        isEnabled = featureSetting.value === true || featureSetting.value === 'true';
    }

    featureCache.set(featureKey, { value: isEnabled, expiresAt: now + CACHE_TTL_MS });
    return isEnabled;
};

/**
 * Middleware to guard routes behind a feature flag.
 * Results are cached for 60 s to avoid DB round-trips on every request.
 * @param {string} featureKey - DB key in the features group (e.g. 'wishlistEnabled')
 */
const featureGate = (featureKey) => {
    return async (req, res, next) => {
        try {
            const isEnabled = await getCachedSetting(featureKey);
            if (!isEnabled) {
                return next(new AppError('FEATURE_DISABLED', 404, `The feature '${featureKey}' is currently disabled`));
            }
            next();
        } catch (err) {
            logger.error(`Error checking feature gate for ${featureKey}:`, err);
            // Fail closed — deny access when we can't check
            next(new AppError('FEATURE_DISABLED', 404, `The feature '${featureKey}' is currently disabled`));
        }
    };
};

/** Test helper — clears the feature cache (useful in unit tests) */
const clearFeatureCache = () => featureCache.clear();

module.exports = { featureGate, clearFeatureCache };
