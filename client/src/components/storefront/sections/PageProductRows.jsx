import React, { useEffect, useState } from 'react';
import { getProducts } from '../../../services/productService';
import ProductRow from '../../product/ProductRow';

const SOURCE_PARAMS = {
  bestSellers: { sort: 'best-selling', discoveryRow: true },
  mostViewed: { sort: 'most-viewed', discoveryRow: true },
  featured: { featured: true },
  newest: { sort: 'arrivals', discoveryRow: true },
  sale: { sale: true },
};

const DiscoveryRow = ({ row }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const count = Math.min(24, Math.max(1, Number.parseInt(row.count, 10) || 8));
  const source = row.source || 'featured';
  useEffect(() => {
    let active = true;
    const limit = source === 'bestSellers' ? Math.max(4, count) : source === 'mostViewed' ? Math.max(5, count) : count;
    getProducts({ ...(SOURCE_PARAMS[source] || SOURCE_PARAMS.featured), limit, status: 'published' })
      .then(result => { if (active) setProducts((result?.data || []).slice(0, count)); })
      .catch(() => { if (active) setProducts([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [count, source]);

  if (!loading && !products.length) return null;
  const viewAllLink = row.viewAllLink || `/products?sort=${source === 'bestSellers' ? 'best-selling' : source === 'mostViewed' ? 'most-viewed' : source === 'newest' ? 'newest' : source === 'sale' ? 'discount_desc' : 'featured'}`;
  return <ProductRow title={row.title || 'Recommended products'} viewAllLink={viewAllLink} products={products} loading={loading} count={count} layout={row.layout || 'carousel'} compact={row.layout === 'grid-compact'} />;
};

export default function PageProductRows({ rows = [] }) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return <>{rows.filter(row => row?.type === 'product-row' && row.enabled !== false).map(row => <DiscoveryRow key={row.id} row={row} />)}</>;
}
