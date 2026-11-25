import { useEffect, useState } from 'react';
import { Box, Button, MenuItem, Pagination, Stack, TextField, Typography } from '@mui/material';
import ProductCard from '../../product/ProductCard';
import useHeroCategories from '../../../hooks/useHeroCategories';
import { useFeature, useFeatureVisible } from '../../../hooks/useSettings';
import { getProducts } from '../../../services/productService';
import { getEligibleBrands } from '../../../services/brandService';
import { SECTION_DEFINITIONS } from './sectionRegistry';

const sortLabels = { newest: 'Newest', name_asc: 'Name A–Z', price_asc: 'Price low to high', price_desc: 'Price high to low' };
const defaults = Object.fromEntries(Object.entries(SECTION_DEFINITIONS['catalog-explorer'].settings)
  .map(([key, field]) => [key, field.default]));

export default function CatalogExplorerSection({ section = {} }) {
  const config = { ...defaults, ...section.catalogFilters };
  const pricing = useFeatureVisible('pricing');
  const brandsEnabled = useFeature('brands') && config.showBrand !== false;
  const categoriesEnabled = config.showCategory !== false;
  const { categories } = useHeroCategories(categoriesEnabled);
  const [brandOptions, setBrandOptions] = useState(null);
  const [brandError, setBrandError] = useState(false);
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const limit = config.pageSize;
  const category = categoriesEnabled ? filters.category || '' : '';
  const brand = brandsEnabled ? filters.brand || '' : '';
  const requestedSort = (config.showSort && filters.sort) || config.defaultSort;
  const sort = !pricing && requestedSort.startsWith('price_') ? 'newest' : requestedSort;
  const requestKey = JSON.stringify([category, brand, sort, page, limit]);
  const current = result?.key === requestKey ? result : null;

  useEffect(() => {
    if (!brandsEnabled) return undefined;
    let active = true;
    getEligibleBrands().then((brands) => {
      if (active) { setBrandOptions(brands); setBrandError(false); }
    }).catch(() => {
      if (active) setBrandError(true);
    });
    return () => { active = false; };
  }, [brandsEnabled]);

  useEffect(() => {
    let active = true;
    getProducts({ page, limit, sort, discoveryRow: true, ...(category && { category }), ...(brand && { brand }) })
      .then((response) => {
        if (active) setResult({ key: requestKey, products: response.data || [], total: response.meta?.total || 0, pages: response.meta?.totalPages || 1 });
      })
      .catch(() => {
        if (active) setResult({ key: requestKey, error: true });
      });
    return () => { active = false; };
  }, [category, brand, sort, page, limit, requestKey]);

  const updateFilter = (key, value) => {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5" component="h2" fontWeight={800}>{section.title || 'Explore products'}</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
        {categoriesEnabled && <TextField select size="small" label="Category" value={category}
          onChange={(event) => updateFilter('category', event.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">All categories</MenuItem>
          {categories.map((item) => <MenuItem key={item.slug} value={item.slug}>{item.label}</MenuItem>)}
        </TextField>}
        {brandsEnabled && <TextField select size="small" label="Brand" value={brand} disabled={!brandOptions}
          helperText={brandError ? 'Brands could not be loaded.' : undefined}
          onChange={(event) => updateFilter('brand', event.target.value)} sx={{ minWidth: 150 }}>
          <MenuItem value="">All brands</MenuItem>
          {brand && !brandOptions?.some(({ slug }) => slug === brand) && <MenuItem value={brand} disabled>{brand}</MenuItem>}
          {brandOptions?.map((item) => <MenuItem key={item.slug} value={item.slug}>{item.name}</MenuItem>)}
        </TextField>}
        {config.showSort !== false && <TextField select size="small" label="Sort products" value={sort}
          onChange={(event) => updateFilter('sort', event.target.value)} sx={{ minWidth: 150 }}>
          {Object.entries(sortLabels).filter(([value]) => pricing || !value.startsWith('price_'))
            .map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>}
        {(category || brand || filters.sort) && <Button onClick={() => { setFilters({}); setPage(1); }}>Clear filters</Button>}
      </Stack>
      <Typography role="status" color="text.secondary">
        {!current ? 'Loading products…' : current.error ? 'Could not load products.' :
          current.total ? `${current.total} products` : 'No products match these filters.'}
      </Typography>
      {!!current?.products?.length && <Box sx={{
        display: 'grid', gap: 2,
        gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: `repeat(${config.columnsDesktop}, minmax(0, 1fr))` },
      }}>
        {current.products.map((product) => <ProductCard key={product.id} product={product} />)}
      </Box>}
      {current?.pages > 1 && <Pagination page={page} count={current.pages} onChange={(_, nextPage) => setPage(nextPage)} />}
    </Stack>
  );
}
