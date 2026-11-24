import productRow from '../../../shared/product-row.json';

export const PRODUCT_SOURCE_PARAMS = Object.fromEntries(Object.entries(productRow.sources)
  .filter(([, source]) => source.params)
  .map(([key, source]) => [key, source.params]));

export const applyProductSourcePreset = (section, source) => ({
  ...section,
  ...productRow.sourcePresetDefaults,
  query: { ...productRow.sourcePresetDefaults.query },
  source,
  title: productRow.sources[source].presetLabel,
  viewAllLink: productRow.sources[source].link || '',
});

export const getProductRowQuery = (section, { source = section.source, limit, category } = {}) => ({
  ...PRODUCT_SOURCE_PARAMS[source],
  ...section.query,
  ...(category && { category }),
  ...(source === 'sale' && section.saleLabel && { saleLabel: section.saleLabel }),
  limit,
  status: productRow.query.status,
});

export const usesProductRowSource = (section) =>
  !section.dataSourceSlug || productRow.sources[section.source]?.ignoresDataSource === true
  || (section.source === 'sale' && Boolean(section.saleLabel));

export const withProductRowCategoryLink = (link, category) => {
  if (!category || !/^\/products(?:[?#]|$)/.test(link || '')) return link;
  const url = new URL(link, 'https://store.invalid');
  url.searchParams.set('category', category);
  return url.pathname + url.search + url.hash;
};

export const fetchStaffPicks = async (section, getProducts) => {
  const ids = section.productIds || [];
  if (!ids.length) return { data: [] };

  const params = new URLSearchParams({ limit: String(ids.length) });
  ids.forEach((id) => params.append('ids', id));
  const response = await getProducts(params);
  const products = new Map((response.data || []).map((product) => [product.id, product]));
  return { data: ids.map((id) => products.get(id)).filter(Boolean) };
};
