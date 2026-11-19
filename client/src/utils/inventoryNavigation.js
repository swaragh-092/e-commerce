export const getInventoryEditPath = (productId, variantId) => (
  `/admin/products/${encodeURIComponent(productId)}/edit${variantId ? `?variantId=${encodeURIComponent(variantId)}` : ''}`
);
