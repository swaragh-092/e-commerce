import { useParams } from 'react-router-dom';
import { Container } from '@mui/material';
import { useFeatureVisible, useSettings } from '../../../hooks/useSettings';
import { getPageProductRows } from '../../../utils/designerSections';
import { fetchStaffPicks, PRODUCT_SOURCE_PARAMS } from '../../../utils/productRowSources';
import React, { useEffect, useState } from 'react';
import { getProducts } from '../../../services/productService';
import ProductRow from '../../product/ProductRow';

const DiscoveryRow = ({ row, category }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const count = row.source === 'staffPicks' ? row.productIds?.length || 0 : Math.min(24, Math.max(1, Number.parseInt(row.count, 10) || 8));
  const source = row.source || 'featured';
  useEffect(() => {
    let active = true;
    const limit = source === 'bestSellers' ? Math.max(4, count) : source === 'mostViewed' ? Math.max(5, count) : count;
    const request = source === 'staffPicks' ? fetchStaffPicks(row, getProducts) : getProducts({
      ...(PRODUCT_SOURCE_PARAMS[source] || PRODUCT_SOURCE_PARAMS.featured),
      ...(category && { category }),
      limit,
      status: 'published',
    });
    request
      .then(result => { if (active) setProducts((result?.data || []).slice(0, count)); })
      .catch(() => { if (active) setProducts([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [count, source, category, row]);

  if (!loading && !products.length) return null;
  const sourceLinks = {
    bestSellers: '/products?sort=best-selling',
    mostViewed: '/products?sort=most-viewed',
    trending: '/products?sort=trending',
    newest: '/products?sort=newest',
    sale: '/products?onSale=true',
    featured: '/products?featured=true',
  };
  const defaultLink = sourceLinks[source];
  const scopedLink = defaultLink && category
    ? `${defaultLink}&category=${encodeURIComponent(category)}`
    : defaultLink;
  const viewAllLink = row.viewAllLink || scopedLink;
  return <ProductRow title={row.title || 'Recommended products'} viewAllLink={viewAllLink} products={products} loading={loading} count={count} layout={row.layout || 'carousel'} compact={row.layout === 'grid-compact'} />;
};

export default function PageProductRows({ rows = [], category }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return <>{rows.filter(row => row?.type === 'product-row' && row.enabled !== false).map(row => <DiscoveryRow key={row.id} row={row} category={row.productScope === 'store' ? undefined : category} />)}</>;
}

export function RoutedProductRows({ page, children }) {
  const { settings } = useSettings();
  const pricingEnabled = useFeatureVisible('pricing', 'storefront');
  const { categorySlug } = useParams();
  const rows = getPageProductRows(settings, page)
    .filter((row) => row?.type === 'product-row' && row.enabled !== false && (row.source !== 'sale' || pricingEnabled));
  const category = page === 'category' ? categorySlug : undefined;
  const above = rows.filter(({ pagePosition }) => pagePosition === 'above');
  const below = rows.filter(({ pagePosition }) => pagePosition !== 'above');
  return <>
    {above.length > 0 && <Container maxWidth="lg"><PageProductRows rows={above} category={category} /></Container>}
    {children}
    {below.length > 0 && <Container maxWidth="lg"><PageProductRows rows={below} category={category} /></Container>}
  </>;
}
