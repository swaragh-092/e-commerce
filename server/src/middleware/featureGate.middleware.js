'use strict';

const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
// In a real app we'd load the setting dynamically or cache from DB
// For now we'll require the Settings service (can implement loading later)

/**
 * Middleware to guard routes behind a feature flag
 * @param {string} featureKey - The key of the feature in settings (e.g. 'wishlist')
 */
const featureGate = (featureKey) => {
  return async (req, res, next) => {
    try {
      const { Setting } = require('../models');
      const featureSetting = await Setting.findOne({ where: { group: 'features', key: featureKey } });
      
      const isEnabled = featureSetting && featureSetting.value === true;
      if (!isEnabled) {
        return next(new AppError('FEATURE_DISABLED', 404, `The feature '${featureKey}' is currently disabled`));
      }
      next();
    } catch (err) {
      logger.error(`Error checking feature gate for ${featureKey}:`, err);
      // Fail closed
      next(new AppError('FEATURE_DISABLED', 404, `The feature '${featureKey}' is currently disabled`));
    }
  };
};

module.exports = { featureGate };
