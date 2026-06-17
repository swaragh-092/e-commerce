import React, { useState, useEffect } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import ProductRow from '../../product/ProductRow';
import ProductRowSection from './ProductRowSection';

const STORAGE_KEY = 'recently_viewed_products';
const MAX_ITEMS = 12;

// Public API to track a viewed product (call from ProductDetailPage)
export const trackRecentlyViewed = (product) => {
  if (!product?.id) return;
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filtered = stored.filter((p) => p.id !== product.id);
    const entry = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      salePrice: product.salePrice,
      images: product.images?.slice(0, 1) || [],
    };
    const updated = [entry, ...filtered].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch { /* localStorage unavailable */ }
};

export const getRecentlyViewed = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
};

const RecentlyViewedSection = ({ section = {}, mode = 'live', onInlineFieldChange, onInlineFieldCommit, onInlineBlockFocus }) => {
  const [products, setProducts] = useState([]);
  const preview = mode === 'preview';
  const count = section.count || 8;
  const align = section.textAlign || 'left';

  useEffect(() => {
    if (preview) return;
    setProducts(getRecentlyViewed().slice(0, count));
  }, [preview, count]);

  if (preview) {
    return (
      <ProductRowSection
        section={{ ...section, title: section.title || 'Recently Viewed', count, variant: 'carousel', textAlign: align }}
        mode="preview"
        onInlineFieldChange={onInlineFieldChange}
        onInlineFieldCommit={onInlineFieldCommit} onInlineBlockFocus={onInlineBlockFocus}
      />
    );
  }

  if (!products.length) return null;

  return (
    <Box component="section">
      <ProductRow
        title={section.title || 'Recently Viewed'}
        products={products}
        loading={false}
        count={count}
        layout="carousel"
        align={align}
      />
    </Box>
  );
};

export default React.memo(RecentlyViewedSection);
