import React, { useEffect, useState } from 'react';
import { Box, Button } from '@mui/material';
import { getProducts } from '../../../services/productService';
import ProductRowSection from './ProductRowSection';

const STORAGE_KEY = 'recently_viewed_products';
const MAX_ITEMS = 12;
const HISTORY_AGE = 30 * 24 * 60 * 60 * 1000;

export const getRecentlyViewed = () => {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const now = Date.now();
    const recent = history.filter((entry) => entry?.id && (!entry.viewedAt || entry.viewedAt >= now - HISTORY_AGE))
      .slice(0, MAX_ITEMS).map(({ id, viewedAt }) => ({ id, viewedAt: viewedAt || now }));
    if (history.some((entry) => entry?.id && !entry.viewedAt)) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recent)); } catch { /* Storage unavailable. */ }
    }
    return recent;
  } catch {
    return [];
  }
};

export const trackRecentlyViewed = (product) => {
  if (!product?.id) return;
  try {
    const previous = getRecentlyViewed().filter(({ id }) => id !== product.id);
    const history = [{ id: product.id, viewedAt: Date.now() }, ...previous].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // The storefront still works when browser storage is unavailable.
  }
};

const RecentlyViewedSection = ({ section = {}, mode = 'live', excludeProductId, ...editorProps }) => {
  const [products, setProducts] = useState([]);
  const [cleared, setCleared] = useState(false);
  const count = Math.min(MAX_ITEMS, Math.max(1, Number(section.count) || 8));
  const row = { ...section, title: section.title || 'Recently Viewed', variant: section.variant || section.layout || 'carousel', count };

  useEffect(() => {
    if (mode === 'preview' || cleared) return;
    const ids = getRecentlyViewed().map(({ id }) => id).filter((id) => id !== excludeProductId);
    if (!ids.length) return;
    let active = true;
    const params = new URLSearchParams({ limit: String(ids.length) });
    ids.forEach((id) => params.append('ids', id));

    getProducts(params).then(({ data }) => {
      if (!active) return;
      const byId = new Map((data || []).map((product) => [product.id, product]));
      setProducts(ids.map((id) => byId.get(id)).filter(Boolean));
    }).catch(() => {
      if (active) setProducts([]);
    });
    return () => { active = false; };
  }, [mode, excludeProductId, cleared]);

  if (mode === 'preview') return <ProductRowSection section={row} mode={mode} {...editorProps} />;
  if (!products.length || cleared) return null;

  const clearHistory = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* Storage unavailable. */ }
    setCleared(true);
  };

  return (
    <Box>
      <ProductRowSection section={row} products={products.slice(0, count)} count={count} />
      <Button size="small" onClick={clearHistory}>Clear history</Button>
    </Box>
  );
};

export default React.memo(RecentlyViewedSection);
