export const getDiscountPercent = (product) => {
  const regularPrice = Number(product?.price);
  const salePrice = Number(product?.salePrice);

  if (!Number.isFinite(regularPrice) || !Number.isFinite(salePrice) || regularPrice <= 0 || salePrice >= regularPrice) {
    return 0;
  }

  return Math.round(((regularPrice - salePrice) / regularPrice) * 100);
};

export const getSavingsAmount = (product) => {
  const regularPrice = Number(product?.price);
  const salePrice = Number(product?.salePrice);

  if (!Number.isFinite(regularPrice) || !Number.isFinite(salePrice) || salePrice >= regularPrice) {
    return 0;
  }

  return regularPrice - salePrice;
};

export const formatSaleDateTime = (value) => {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsed);
};

export const getSaleTimingMessage = (product) => {
  if (!product?.saleStatus || product.saleStatus === 'none') return null;

  if (product.saleStatus === 'scheduled' && product.saleStartAt) {
    return `Starts ${formatSaleDateTime(product.saleStartAt)}`;
  }

  if (product.saleStatus === 'active' && product.saleEndAt) {
    return `Ends ${formatSaleDateTime(product.saleEndAt)}`;
  }

  if (product.saleStatus === 'active') {
    return 'Sale is live now';
  }

  return null;
};

export const getCountdownText = (value, prefix = '') => {
  if (!value) return null;

  const target = new Date(value);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (Number.isNaN(target.getTime()) || diffMs <= 0) return null;

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0 && minutes > 0) parts.push(`${minutes}m`);

  if (parts.length === 0) return null;
  return `${prefix}${parts.join(' ')}`.trim();
};

export const isEndingSoon = (value, thresholdHours = 24) => {
  if (!value) return false;

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return false;

  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return false;

  return diffMs <= Number(thresholdHours || 24) * 60 * 60 * 1000;
};
