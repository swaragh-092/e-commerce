export const PRODUCT_SOURCE_PARAMS = {
  newest: { sort: 'arrivals', discoveryRow: true },
  featured: { featured: true },
  bestSellers: { sort: 'best-selling', discoveryRow: true },
  trending: { sort: 'trending', discoveryRow: true },
  mostViewed: { sort: 'most-viewed', discoveryRow: true },
  sale: { sale: true },
  recommended: { sort: 'recommended' },
};

export const usesProductRowSource = (section) =>
  !section.dataSourceSlug || ['staffPicks', 'trending'].includes(section.source)
  || (section.source === 'sale' && Boolean(section.saleLabel));

export const fetchStaffPicks = async (section, getProducts) => {
  const ids = section.productIds || [];
  if (!ids.length) return { data: [] };

  const params = new URLSearchParams({ limit: String(ids.length) });
  ids.forEach((id) => params.append('ids', id));
  const response = await getProducts(params);
  const products = new Map((response.data || []).map((product) => [product.id, product]));
  return { data: ids.map((id) => products.get(id)).filter(Boolean) };
};
