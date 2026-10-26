'use strict';

const AppError = require('./AppError');

/**
 * Brand visibility is derived from the server-resolved feature map.
 * Staff/admin views always keep brand data so existing records remain manageable.
 *
 * @param {Record<string, boolean>} features - Resolved feature map
 * @param {{ adminView?: boolean }} options
 * @returns {boolean}
 */
const isBrandVisible = (features = {}, { adminView = false } = {}) =>
  adminView || !features || features.brands !== false;

/**
 * Recursively removes brand identity (`brand`, `brandId`) from a public payload.
 * Returns a new value; the input is never mutated.
 *
 * @param {*} value
 * @returns {*}
 */
const stripBrandFields = (value) => {
  if (Array.isArray(value)) return value.map(stripBrandFields);
  if (!value || typeof value !== 'object') return value;

  const copy = { ...value };
  delete copy.brand;
  delete copy.brandId;

  Object.keys(copy).forEach((key) => {
    if (copy[key] && typeof copy[key] === 'object') {
      copy[key] = stripBrandFields(copy[key]);
    }
  });

  return copy;
};

/**
 * Throws FEATURE_DISABLED when a customer-facing brand action is attempted
 * while the brands feature is OFF.
 */
const assertBrandFilterAllowed = (features, { adminView = false } = {}) => {
  if (!isBrandVisible(features, { adminView })) {
    throw new AppError('FEATURE_DISABLED', 403, 'Brand filtering is disabled for this storefront.');
  }
};

module.exports = {
  isBrandVisible,
  stripBrandFields,
  assertBrandFilterAllowed,
};
