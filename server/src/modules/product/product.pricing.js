'use strict';

const AppError = require('../../utils/AppError');

// ─── Sale Label Resolution ────────────────────────────────────────────────────

/**
 * Resolves a stored saleLabel id/string against the preset catalog.
 * Returns the full preset object ({ id, name, color, priority, isActive, startDate, endDate })
 * if found, or a minimal fallback object if the id is a raw string not in the catalog,
 * or null if there is no label at all.
 *
 * @param {string|null} labelId     - The value stored on products.sale_label
 * @param {Array}       [presets]   - The current sale label catalog
 */
const resolveSaleLabel = (labelId, presets = []) => {
  if (!labelId) return null;

  const found = presets.find((p) => p.id === labelId);
  if (found) {
    return { ...found };
  }

  // Graceful fallback: raw legacy string — surface it without crashing
  return { id: null, name: labelId, color: null, isActive: true };
};

const parseDateOrNull = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError('VALIDATION_ERROR', 400, 'Invalid sale date provided');
  }
  return parsed;
};

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getVariantOptionLabel = (variant) => {
  if (!Array.isArray(variant?.options) || variant.options.length === 0) {
    return null;
  }

  return variant.options
    .map((option) => {
      const attributeName = option?.attribute?.name;
      const valueLabel = option?.value?.value;
      if (!attributeName || !valueLabel) {
        return null;
      }

      return `${attributeName}: ${valueLabel}`;
    })
    .filter(Boolean)
    .join(', ') || null;
};

const getVariantOptionMap = (variant) => {
  if (!Array.isArray(variant?.options) || variant.options.length === 0) {
    return {};
  }

  return variant.options.reduce((accumulator, option) => {
    const attributeName = option?.attribute?.name;
    const valueLabel = option?.value?.value;

    if (attributeName && valueLabel) {
      accumulator[attributeName] = valueLabel;
    }

    return accumulator;
  }, {});
};

const isSaleActive = (product, referenceDate = new Date()) => {
  if (!product || product.salePrice === null || product.salePrice === undefined || product.salePrice === '') {
    return false;
  }

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(now.getTime())) return false;

  // If the product is linked to a resolved preset that has been explicitly deactivated
  if (product.saleLabelResolved && product.saleLabelResolved.isActive === false) {
    return false;
  }

  const saleStartAt = product.saleStartAt
    ? new Date(product.saleStartAt)
    : (product.saleLabelResolved?.startDate ? new Date(product.saleLabelResolved.startDate) : null);
  const saleEndAt = product.saleEndAt
    ? new Date(product.saleEndAt)
    : (product.saleLabelResolved?.endDate ? new Date(product.saleLabelResolved.endDate) : null);

  if (saleStartAt && !Number.isNaN(saleStartAt.getTime()) && saleStartAt > now) return false;
  if (saleEndAt && !Number.isNaN(saleEndAt.getTime()) && saleEndAt < now) return false;

  const salePrice = Number(product.salePrice);
  const price = Number(product.price);
  return Number.isFinite(salePrice) && Number.isFinite(price) && salePrice < price;
};

const getSaleStatus = (product, referenceDate = new Date()) => {
  if (!product || product.salePrice === null || product.salePrice === undefined || product.salePrice === '') {
    return 'none';
  }

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(now.getTime())) return 'none';

  if (product.saleLabelResolved && product.saleLabelResolved.isActive === false) {
    return 'inactive';
  }

  const saleStartAt = product.saleStartAt
    ? new Date(product.saleStartAt)
    : (product.saleLabelResolved?.startDate ? new Date(product.saleLabelResolved.startDate) : null);
  const saleEndAt = product.saleEndAt
    ? new Date(product.saleEndAt)
    : (product.saleLabelResolved?.endDate ? new Date(product.saleLabelResolved.endDate) : null);

  if (saleStartAt && !Number.isNaN(saleStartAt.getTime()) && saleStartAt > now) return 'scheduled';
  if (saleEndAt && !Number.isNaN(saleEndAt.getTime()) && saleEndAt < now) return 'expired';
  return isSaleActive(product, now) ? 'active' : 'inactive';
};

const getEffectivePrice = (product, referenceDate = new Date()) => {
  return isSaleActive(product, referenceDate) ? Number(product.salePrice) : Number(product.price);
};

const getVariantUnitPrice = (product, variant, referenceDate = new Date()) => {
  if (!variant) {
    return Number(getEffectivePrice(product, referenceDate).toFixed(2));
  }

  // If the variant already has a pre-calculated unitPrice or effectivePrice, respect it
  const precalculatedPrice = toFiniteNumber(variant.unitPrice ?? variant.effectivePrice);
  if (precalculatedPrice !== null) {
    return Number(precalculatedPrice.toFixed(2));
  }

  const rawVariantPrice = toFiniteNumber(variant.price);
  if (rawVariantPrice === null) {
    return Number(getEffectivePrice(product, referenceDate).toFixed(2));
  }

  // If a sale is active on the parent product, apply the discount to the variant
  if (isSaleActive(product, referenceDate)) {
    const productPrice = toFiniteNumber(product?.price);
    const productSalePrice = toFiniteNumber(product?.salePrice);

    if (productPrice !== null && productSalePrice !== null && productSalePrice < productPrice) {
      const discountAmount = productPrice - productSalePrice;
      const variantSalePrice = Math.max(0, rawVariantPrice - discountAmount);
      return Number(variantSalePrice.toFixed(2));
    }
  }

  return Number(rawVariantPrice.toFixed(2));
};

const getDiscountPercent = (product) => {
  const regularPrice = Number(product?.price);
  const salePrice = Number(product?.salePrice);

  if (!Number.isFinite(regularPrice) || !Number.isFinite(salePrice) || regularPrice <= 0 || salePrice >= regularPrice) {
    return 0;
  }

  return Math.round(((regularPrice - salePrice) / regularPrice) * 100);
};

const getSavingsAmount = (product) => {
  const regularPrice = Number(product?.price);
  const salePrice = Number(product?.salePrice);

  if (!Number.isFinite(regularPrice) || !Number.isFinite(salePrice) || salePrice >= regularPrice) {
    return 0;
  }

  return Number((regularPrice - salePrice).toFixed(2));
};

const serializeVariantPricing = (product, variant, referenceDate = new Date()) => {
  if (!variant) return variant;

  const plainVariant = typeof variant.toJSON === 'function' ? variant.toJSON() : { ...variant };

  return {
    ...plainVariant,
    unitPrice: getVariantUnitPrice(product, plainVariant, referenceDate),
    optionLabel: plainVariant.optionLabel || getVariantOptionLabel(plainVariant),
    optionMap: plainVariant.optionMap || getVariantOptionMap(plainVariant),
  };
};

/**
 * Serializes a product for API output.
 *
 * @param {object}  product
 * @param {object}  [options]
 * @param {boolean} [options.adminView=false]
 * @param {Array}   [labelPresets=[]]  - Pass the sale label catalog so the
 *                                        label id is resolved to a full object.
 */
const serializeProductPricing = (product, { adminView = false, features = {} } = {}, labelPresets = []) => {
  if (!product) return product;

  const plain = typeof product.toJSON === 'function' ? product.toJSON() : { ...product };

  // Strip internal fields that should never appear in API responses
  delete plain.searchVector;
  delete plain.search_vector;
  delete plain.relevance;
  
  // Resolve label first because status/active checks depend on it for date fallback.
  const saleLabelResolved = resolveSaleLabel(plain.saleLabel, labelPresets);
  plain.saleLabelResolved = saleLabelResolved;

  const saleStatus = getSaleStatus(plain);
  const saleActive = saleStatus === 'active';
  const shouldExposeSaleMeta = adminView || saleStatus === 'active' || saleStatus === 'scheduled';

  // Effective dates for storefront — product override wins, label global dates as fallback.
  const effectiveStartAt = plain.saleStartAt
    || (saleLabelResolved?.startDate || null);
  const effectiveEndAt = plain.saleEndAt
    || (saleLabelResolved?.endDate || null);

  // Enforce server-side price-stripping if pricing is disabled (Mode-locked) or showPrice is disabled (Admin)
  if (!adminView && (features.pricing === false || features.showPrice === false)) {
      delete plain.price;
      delete plain.salePrice;
      if (Array.isArray(plain.variants)) {
          plain.variants = plain.variants.map((variant) => {
              const v = serializeVariantPricing(product, variant);
              delete v.price;
              delete v.salePrice;
              delete v.unitPrice;
              return v;
          });
      }
      return {
          ...plain,
          effectivePrice: null,
          isSaleActive: false,
          saleStatus: 'none',
          discountPercent: 0,
          savingsAmount: 0,
          saleLabelResolved: null,
          salePrice: null,
          saleStartAt: null,
          saleEndAt: null,
          saleLabel: null,
      };
  }

  return {
    ...plain,
    variants: Array.isArray(plain.variants)
      ? plain.variants.map((variant) => serializeVariantPricing(plain, variant))
      : plain.variants,
    effectivePrice: getEffectivePrice(plain),
    isSaleActive: saleActive,
    saleStatus,
    discountPercent: saleActive ? getDiscountPercent(plain) : 0,
    savingsAmount: saleActive ? getSavingsAmount(plain) : 0,
    saleLabelResolved: shouldExposeSaleMeta ? saleLabelResolved : null,
    ...(adminView
      ? {}
      : {
          salePrice:  shouldExposeSaleMeta ? plain.salePrice  : null,
          saleStartAt: shouldExposeSaleMeta ? effectiveStartAt : null,
          saleEndAt:  shouldExposeSaleMeta ? effectiveEndAt : null,
          saleLabel:  shouldExposeSaleMeta ? plain.saleLabel  : null,
        }),
  };
};

/**
 * Normalises and validates sale-related fields on a product payload.
 *
 * @param {object} payload
 * @param {object|number|null} [currentProductOrPrice] - Existing product or regular price.
 * @param {object} [options]
 * @param {Array}  [options.labelPresets] - If supplied, saleLabel must be one of the active preset ids.
 */
const normalizeSalePayload = (payload, currentProductOrPrice = null, options = {}) => {
  const normalized = { ...payload };

  const existingProduct = (currentProductOrPrice && typeof currentProductOrPrice === 'object')
    ? (typeof currentProductOrPrice.toJSON === 'function' ? currentProductOrPrice.toJSON() : currentProductOrPrice)
    : null;
  const fallbackPrice = existingProduct ? existingProduct.price : currentProductOrPrice;
  const fallbackSalePrice = existingProduct ? existingProduct.salePrice : null;

  const effectivePrice = normalized.price !== undefined && normalized.price !== null && normalized.price !== ''
    ? Number(normalized.price)
    : fallbackPrice !== null && fallbackPrice !== undefined
      ? Number(fallbackPrice)
      : null;

  if ('salePrice' in normalized) {
    normalized.salePrice = normalized.salePrice === '' || normalized.salePrice === null || normalized.salePrice === undefined
      ? null
      : Number(normalized.salePrice);

    if (normalized.salePrice !== null) {
      if (!Number.isFinite(normalized.salePrice) || normalized.salePrice <= 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Sale price must be a positive number');
      }
      if (effectivePrice !== null && normalized.salePrice >= effectivePrice) {
        throw new AppError('VALIDATION_ERROR', 400, 'Sale price must be less than the regular price');
      }
    }
  } else if (normalized.price !== undefined && normalized.price !== null && fallbackSalePrice !== null && fallbackSalePrice !== undefined) {
    const existingSale = Number(fallbackSalePrice);
    if (effectivePrice !== null && existingSale >= effectivePrice) {
      throw new AppError('VALIDATION_ERROR', 400, 'Sale price must be less than the regular price');
    }
  }

  if ('saleLabel' in normalized) {
    normalized.saleLabel = normalized.saleLabel ? String(normalized.saleLabel).trim() : null;

    // Strict enforcement: when the caller provides the preset catalog, the stored
    // value MUST match one of the active preset ids (or be null to clear the label).
    if (normalized.saleLabel !== null && Array.isArray(options?.labelPresets) && options.labelPresets.length > 0) {
      const match = options.labelPresets.find((p) => p.id === normalized.saleLabel && p.isActive !== false);
      if (!match) {
        throw new AppError(
          'VALIDATION_ERROR',
          400,
          `"${normalized.saleLabel}" is not a valid sale label. Please select a label from the configured list.`
        );
      }
    }
  }

  if ('saleStartAt' in normalized) {
    normalized.saleStartAt = parseDateOrNull(normalized.saleStartAt);
  }

  if ('saleEndAt' in normalized) {
    normalized.saleEndAt = parseDateOrNull(normalized.saleEndAt);
  }

  if ('salePrice' in normalized && normalized.salePrice === null) {
    normalized.saleStartAt = null;
    normalized.saleEndAt = null;
    normalized.saleLabel = null;
  }

  const start = normalized.saleStartAt;
  const end = normalized.saleEndAt;

  if (start && end && end <= start) {
    throw new AppError('VALIDATION_ERROR', 400, 'Sale end date must be after the sale start date');
  }

  const resultingSalePrice = 'salePrice' in normalized ? normalized.salePrice : fallbackSalePrice;
  if ((start || end) && (resultingSalePrice === null || resultingSalePrice === undefined)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Sale price is required when scheduling a sale window');
  }

  if (normalized.saleLabel && (resultingSalePrice === null || resultingSalePrice === undefined)) {
    throw new AppError('VALIDATION_ERROR', 400, 'Sale price is required when setting a sale label');
  }

  return normalized;
};

module.exports = {
  getDiscountPercent,
  getEffectivePrice,
  getVariantUnitPrice,
  getSaleStatus,
  getSavingsAmount,
  isSaleActive,
  normalizeSalePayload,
  resolveSaleLabel,
  serializeVariantPricing,
  serializeProductPricing,
};
