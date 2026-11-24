export function getProductShareImage(product) {
  if (product?.ogImage) return product.ogImage;
  const images = (product?.images || [])
    .filter((image) => !image.variantId && (image.url || image.media?.url))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const primary = images.find((image) => image.isPrimary) || images[0];
  return primary?.url || primary?.media?.url || '';
}
