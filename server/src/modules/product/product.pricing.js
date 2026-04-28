'use strict';

const AppError = require('../../utils/AppError');

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
  const saleStartAt = product.saleStartAt ? new Date(product.saleStartAt) : null;
  const saleEndAt = product.saleEndAt ? new Date(product.saleEndAt) : null;

  if (saleStartAt && saleStartAt > now) return false;
  if (saleEndAt && saleEndAt < now) return false;

  return Number(product.salePrice) < Number(product.price);
};

const getSaleStatus = (product, referenceDate = new Date()) => {
  if (!product || product.salePrice === null || product.salePrice === undefined || product.salePrice === '') {
    return 'none';
  }

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const saleStartAt = product.saleStartAt ? new Date(product.saleStartAt) : null;
  const saleEndAt = product.saleEndAt ? new Date(product.saleEndAt) : null;

  if (saleStartAt && saleStartAt > now) return 'scheduled';
  if (saleEndAt && saleEndAt < now) return 'expired';
  return isSaleActive(product, now) ? 'active' : 'inactive';
};

const getEffectivePrice = (product, referenceDate = new Date()) => {
  return isSaleActive(product, referenceDate) ? Number(product.salePrice) : Number(product.price);
};

const getVariantUnitPrice = (product, variant, referenceDate = new Date()) => {
  const explicitUnitPrice = toFiniteNumber(
    variant?.unitPrice ?? variant?.effectivePrice ?? variant?.price
  );

  if (explicitUnitPrice !== null) {
    return Number(explicitUnitPrice.toFixed(2));
  }

  return Number(getEffectivePrice(product, referenceDate).toFixed(2));
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

const getActivePromotion = (product, referenceDate = new Date()) => {
  if (!product?.promotions || !product.promotions.length) return null;

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);

  const activePromotions = product.promotions.filter(promo => {
    if (!promo.isActive) return false;
    const start = promo.startDate ? new Date(promo.startDate) : null;
    const end = promo.endDate ? new Date(promo.endDate) : null;
    if (start && start > now) return false;
    if (end && end < now) return false;
    return true;
  });

  if (!activePromotions.length) return null;

  // Sort by priority (descending)
  return activePromotions.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0];
};

const serializeProductPricing = (product, { adminView = false } = {}) => {
  if (!product) return product;

  const plain = typeof product.toJSON === 'function' ? product.toJSON() : { ...product };
  const saleStatus = getSaleStatus(plain);
  const saleActive = saleStatus === 'active';
  const shouldExposeSaleMeta = adminView || saleStatus === 'active' || saleStatus === 'scheduled';
  
  const activePromotion = getActivePromotion(plain);

  return {
    ...plain,
    variants: Array.isArray(plain.variants)
      ? plain.variants.map((variant) => serializeVariantPricing(plain, variant))
      : plain.variants,
    effectivePrice: getEffectivePrice(plain),
    isSaleActive: saleActive,
    saleStatus,
    discountPercent: getDiscountPercent(plain),
    savingsAmount: getSavingsAmount(plain),
    ...(adminView
      ? { activePromotion }
      : {
          salePrice: shouldExposeSaleMeta ? plain.salePrice : null,
          saleStartAt: shouldExposeSaleMeta ? plain.saleStartAt : null,
          saleEndAt: shouldExposeSaleMeta ? plain.saleEndAt : null,
          saleLabel: shouldExposeSaleMeta 
            ? (activePromotion ? activePromotion.label : plain.saleLabel) 
            : null,
          activePromotion,
        }),
  };
};

const normalizeSalePayload = (payload, currentPrice = null) => {
  const normalized = { ...payload };
  const effectivePrice = normalized.price !== undefined && normalized.price !== null && normalized.price !== ''
    ? Number(normalized.price)
    : currentPrice !== null && currentPrice !== undefined
      ? Number(currentPrice)
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
  }

  if ('saleLabel' in normalized) {
    normalized.saleLabel = normalized.saleLabel ? String(normalized.saleLabel).trim() : null;
  }

  if ('saleStartAt' in normalized) {
    normalized.saleStartAt = parseDateOrNull(normalized.saleStartAt);
  }

  if ('saleEndAt' in normalized) {
    normalized.saleEndAt = parseDateOrNull(normalized.saleEndAt);
  }

  const start = normalized.saleStartAt;
  const end = normalized.saleEndAt;

  if (start && end && end <= start) {
    throw new AppError('VALIDATION_ERROR', 400, 'Sale end date must be after the sale start date');
  }

  if ('salePrice' in normalized && normalized.salePrice === null) {
    normalized.saleStartAt = null;
    normalized.saleEndAt = null;
    normalized.saleLabel = null;
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
  serializeVariantPricing,
  serializeProductPricing,
  getActivePromotion,
};
