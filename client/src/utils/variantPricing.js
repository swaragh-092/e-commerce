const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const isSaleActive = (product, referenceDate = new Date()) => {
  if (!product) return false;

  const regularPrice = toFiniteNumber(product.price);
  const salePrice = toFiniteNumber(product.salePrice);
  if (salePrice === null || regularPrice === null || salePrice >= regularPrice) {
    return false;
  }

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(now.getTime())) {
    return false;
  }

  const saleStartAt = product.saleStartAt ? new Date(product.saleStartAt) : null;
  if (saleStartAt && Number.isNaN(saleStartAt.getTime())) {
    return false;
  }

  const saleEndAt = product.saleEndAt ? new Date(product.saleEndAt) : null;
  if (saleEndAt && Number.isNaN(saleEndAt.getTime())) {
    return false;
  }

  if (saleStartAt && saleStartAt > now) return false;
  if (saleEndAt && saleEndAt < now) return false;

  return true;
};

export const getProductBasePrice = (product, referenceDate = new Date()) => {
  const explicitEffectivePrice = toFiniteNumber(product?.effectivePrice);
  if (explicitEffectivePrice !== null) {
    return explicitEffectivePrice;
  }

  const regularPrice = toFiniteNumber(product?.price) ?? 0;
  return isSaleActive(product, referenceDate)
    ? toFiniteNumber(product?.salePrice) ?? regularPrice
    : regularPrice;
};

export const getVariantPriceAdjustment = (product, variant, referenceDate = new Date()) => {
  const explicitUnitPrice = toFiniteNumber(variant?.unitPrice ?? variant?.effectivePrice);
  if (explicitUnitPrice !== null) {
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

export const getVariantRegularPrice = (product, variant, referenceDate = new Date()) => {
  const regularPrice = toFiniteNumber(product?.price) ?? 0;
  return Number((regularPrice + getVariantPriceAdjustment(product, variant, referenceDate)).toFixed(2));
};

export const getVariantSalePrice = (product, variant, referenceDate = new Date()) => {
  const salePrice = toFiniteNumber(product?.salePrice);
  if (salePrice === null) {
    return null;
  }

  return Number((salePrice + getVariantPriceAdjustment(product, variant, referenceDate)).toFixed(2));
};

export const getVariantUnitPrice = (product, variant, referenceDate = new Date()) => {
  return Number((getProductBasePrice(product, referenceDate) + getVariantPriceAdjustment(product, variant, referenceDate)).toFixed(2));
};

export const getCartItemUnitPrice = (item, referenceDate = new Date()) =>
  getVariantUnitPrice(item?.product, item?.variant, referenceDate);

export const getVariantSavingsAmount = (product, variant, referenceDate = new Date()) => {
  const regularPrice = getVariantRegularPrice(product, variant, referenceDate);
  const currentPrice = getVariantUnitPrice(product, variant, referenceDate);

  if (!Number.isFinite(regularPrice) || !Number.isFinite(currentPrice) || currentPrice >= regularPrice) {
    return 0;
  }

  return Number((regularPrice - currentPrice).toFixed(2));
};

export const getVariantDiscountPercent = (product, variant, referenceDate = new Date()) => {
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