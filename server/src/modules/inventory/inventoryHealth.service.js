'use strict';

const normalizeInventoryThreshold = (threshold) => {
  if (threshold === undefined || threshold === null || threshold === '') return 10;
  const parsed = Number(threshold);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
};

const getAvailableQuantity = (quantity, reservedQty) => Math.max(
  Math.max(Number(quantity) || 0, 0) - Math.max(Number(reservedQty) || 0, 0),
  0,
);

const getInventoryStatus = (availableQty, threshold) => {
  if (availableQty <= 0) return 'out_of_stock';
  if (availableQty <= normalizeInventoryThreshold(threshold)) return 'low_stock';
  return 'healthy';
};

const getProductInventoryValues = (product) => {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const activeVariants = variants.filter((variant) => variant?.isActive !== false);
  const hasVariantRows = variants.length > 0 || product?.type === 'variable';
  const quantity = hasVariantRows
    ? activeVariants.reduce((sum, variant) => sum + Math.max(Number(variant?.stockQty) || 0, 0), 0)
    : Math.max(Number(product?.quantity) || 0, 0);
  const reservedQty = hasVariantRows
    ? activeVariants.reduce((sum, variant) => sum + Math.max(Number(variant?.reservedQty) || 0, 0), 0)
    : Math.max(Number(product?.reservedQty) || 0, 0);

  return {
    quantity,
    reservedQty,
    availableQty: getAvailableQuantity(quantity, reservedQty),
  };
};

const buildInventorySummary = (products, threshold = 10) => {
  const normalizedThreshold = normalizeInventoryThreshold(threshold);
  const rows = [];
  for (const product of Array.isArray(products) ? products : []) {
    if (product?.status !== 'published' || product?.isEnabled === false) continue;
    const variants = Array.isArray(product.variants) ? product.variants : [];
    const hasVariantInventory = variants.length > 0 || product.type === 'variable';

    if (hasVariantInventory) {
      for (const variant of variants) {
        if (variant?.isActive === false) continue;
        const quantity = Math.max(Number(variant?.stockQty) || 0, 0);
        const reservedQty = Math.max(Number(variant?.reservedQty) || 0, 0);
        const availableQty = getAvailableQuantity(quantity, reservedQty);
        rows.push({
          id: product.id,
          inventoryKey: `variant:${variant.id}`,
          variantId: variant.id,
          name: product.name,
          sku: variant.sku || product.sku || '',
          quantity,
          reservedQty,
          availableQty,
          threshold: normalizedThreshold,
          status: getInventoryStatus(availableQty, normalizedThreshold),
        });
      }
      continue;
    }

    const values = getProductInventoryValues(product);
    rows.push({
      id: product.id,
      inventoryKey: `product:${product.id}`,
      variantId: null,
      name: product.name,
      sku: product.sku || '',
      ...values,
      threshold: normalizedThreshold,
      status: getInventoryStatus(values.availableQty, normalizedThreshold),
    });
  }

  const atRiskRows = rows
    .filter((row) => row.status !== 'healthy')
    .sort((a, b) => (
      (a.status === 'out_of_stock' ? 0 : 1) - (b.status === 'out_of_stock' ? 0 : 1)
      || a.availableQty - b.availableQty
      || String(a.name || '').localeCompare(String(b.name || ''))
    ));
  const outOfStockCount = atRiskRows.filter((row) => row.status === 'out_of_stock').length;
  const lowStockCount = atRiskRows.length - outOfStockCount;

  return {
    rows: atRiskRows,
    totalAtRisk: atRiskRows.length,
    lowStockCount,
    outOfStockCount,
    threshold: normalizedThreshold,
    health: atRiskRows.length === 0 ? 'healthy' : outOfStockCount > 0 ? 'out_of_stock' : 'low_stock',
  };
};

module.exports = {
  normalizeInventoryThreshold,
  getAvailableQuantity,
  getInventoryStatus,
  getProductInventoryValues,
  buildInventorySummary,
};
