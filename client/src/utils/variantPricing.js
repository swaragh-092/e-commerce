const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const isSaleActive = (product, referenceDate) => {
  if (!product) return false;

  // Use pre-calculated server flag if available and no specific reference date is provided
  if (product.isSaleActive !== undefined && !referenceDate) {
    return product.isSaleActive;
  }

  if (product.salePrice === null || product.salePrice === undefined || product.salePrice === '') {
    return false;
  }

  const now = referenceDate ? (referenceDate instanceof Date ? referenceDate : new Date(referenceDate)) : new Date();
  if (Number.isNaN(now.getTime())) return false;

  const saleStartAt = product.saleStartAt ? new Date(product.saleStartAt) : null;
  const saleEndAt = product.saleEndAt ? new Date(product.saleEndAt) : null;

  if (saleStartAt && !Number.isNaN(saleStartAt.getTime()) && saleStartAt > now) return false;
  if (saleEndAt && !Number.isNaN(saleEndAt.getTime()) && saleEndAt < now) return false;

  const regularPrice = toFiniteNumber(product.price);
  const salePrice = toFiniteNumber(product.salePrice);

  return regularPrice !== null && salePrice !== null && salePrice < regularPrice;
};

export const getProductBasePrice = (product, referenceDate) => {
  if (!product) return 0;

  // If no override date is provided, trust the server's calculated effectivePrice
  if (!referenceDate && product.effectivePrice !== undefined && product.effectivePrice !== null) {
    return Number(product.effectivePrice);
  }

  const dateToCheck = referenceDate ? (referenceDate instanceof Date ? referenceDate : new Date(referenceDate)) : new Date();
  const regularPrice = toFiniteNumber(product.price) ?? 0;

  return isSaleActive(product, dateToCheck)
    ? toFiniteNumber(product.salePrice) ?? regularPrice
    : regularPrice;
};

export const getVariantPriceAdjustment = (product, variant, referenceDate) => {
  const explicitUnitPrice = toFiniteNumber(variant?.unitPrice ?? variant?.effectivePrice);
  if (explicitUnitPrice !== null && !referenceDate) {
    return Number((explicitUnitPrice - getProductBasePrice(product, referenceDate)).toFixed(2));
  }

  const modifier = toFiniteNumber(variant?.priceModifier);
  if (modifier === null) {
    return 0;
  }

  const basePrice = getProductBasePrice(product, referenceDate);
  const looksLikeLegacyAbsolutePrice = modifier >= 0 && basePrice > 0 && modifier >= basePrice;
  return Number((looksLikeLegacyAbsolutePrice ? modifier - basePrice : modifier).toFixed(2));
};

export const getVariantRegularPrice = (product, variant, referenceDate) => {
  const regularPrice = toFiniteNumber(product?.price) ?? 0;
  return Number((regularPrice + getVariantPriceAdjustment(product, variant, referenceDate)).toFixed(2));
};

export const getVariantSalePrice = (product, variant, referenceDate) => {
  const salePrice = toFiniteNumber(product?.salePrice);
  if (salePrice === null) {
    return null;
  }

  return Number((salePrice + getVariantPriceAdjustment(product, variant, referenceDate)).toFixed(2));
};

export const getVariantUnitPrice = (product, variant, referenceDate) => {
  const explicit = toFiniteNumber(variant?.unitPrice ?? variant?.effectivePrice);
  if (explicit !== null && !referenceDate) {
    return explicit;
  }
  return Number((getProductBasePrice(product, referenceDate) + getVariantPriceAdjustment(product, variant, referenceDate)).toFixed(2));
};

export const getCartItemUnitPrice = (item, referenceDate) =>
  getVariantUnitPrice(item?.product, item?.variant, referenceDate);

export const getVariantSavingsAmount = (product, variant, referenceDate) => {
  const regularPrice = getVariantRegularPrice(product, variant, referenceDate);
  const currentPrice = getVariantUnitPrice(product, variant, referenceDate);

  if (!Number.isFinite(regularPrice) || !Number.isFinite(currentPrice) || currentPrice >= regularPrice) {
    return 0;
  }

  return Number((regularPrice - currentPrice).toFixed(2));
};

export const getVariantDiscountPercent = (product, variant, referenceDate) => {
  const regularPrice = getVariantRegularPrice(product, variant, referenceDate);
  const currentPrice = getVariantUnitPrice(product, variant, referenceDate);

  if (!Number.isFinite(regularPrice) || regularPrice <= 0 || !Number.isFinite(currentPrice) || currentPrice >= regularPrice) {
    return 0;
  }

  return Math.round(((regularPrice - currentPrice) / regularPrice) * 100);
};

export const getVariantPriceModifierFromInput = (basePrice, inputValue) => {
  const enteredPrice = toFiniteNumber(inputValue);
  if (enteredPrice === null) {
    return 0;
  }

  return Number((enteredPrice - (toFiniteNumber(basePrice) ?? 0)).toFixed(2));
};