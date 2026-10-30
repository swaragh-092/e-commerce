import { useEffect, useState } from 'react';
import { getProducts } from '../services/productService';
import { getCategoryTree } from '../services/categoryService';

const findCategorySlug = (categories) => {
  for (const category of categories) {
    if (category.slug) return category.slug;
    const childSlug = findCategorySlug(category.children || []);
    if (childSlug) return childSlug;
  }
  return null;
};

export const useDesignerPreviewPath = (activePage, fallbackPath) => {
  const [result, setResult] = useState({ page: null, path: null, loading: true, error: null });
  const needsRecord = activePage === 'product' || activePage === 'category';

  useEffect(() => {
    if (!needsRecord) return undefined;
    let cancelled = false;
    setResult({ page: activePage, path: null, loading: true, error: null });
    const request = activePage === 'product'
      ? getProducts({ limit: 1, status: 'published' })
      : getCategoryTree();
    request.then((response) => {
      if (cancelled) return;
      const records = Array.isArray(response?.data) ? response.data : [];
      const slug = activePage === 'product' ? records[0]?.slug : findCategorySlug(records);
      const error = slug ? null : activePage === 'product'
        ? 'Add a published product to preview a product page.'
        : 'Add a category to preview a category page.';
      setResult({
        page: activePage,
        path: slug ? `/${activePage === 'product' ? 'products' : 'category'}/${encodeURIComponent(slug)}` : null,
        loading: false,
        error,
      });
    }).catch(() => {
      if (!cancelled) setResult({
        page: activePage, path: null, loading: false,
        error: `Could not load a ${activePage} for preview. Switch pages and try again.`,
      });
    });
    return () => { cancelled = true; };
  }, [activePage, needsRecord]);

  if (!needsRecord) return { path: fallbackPath, loading: false, error: null };
  if (result.page !== activePage) return { path: null, loading: true, error: null };
  return { path: result.path, loading: result.loading, error: result.error };
};

export default useDesignerPreviewPath;
