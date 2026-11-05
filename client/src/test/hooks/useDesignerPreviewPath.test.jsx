import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useDesignerPreviewPath } from '../../hooks/useDesignerPreviewPath';
import { getProducts } from '../../services/productService';
import { getCategoryTree } from '../../services/categoryService';
vi.mock('../../services/productService', () => ({ getProducts: vi.fn() }));
vi.mock('../../services/categoryService', () => ({ getCategoryTree: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe('useDesignerPreviewPath', () => {
  it('returns static page routes without fetching records', () => {
    const { result } = renderHook(() => useDesignerPreviewPath('home', '/'));
    expect(result.current).toEqual({ path: '/', loading: false, error: null });
    expect(getProducts).not.toHaveBeenCalled();
    expect(getCategoryTree).not.toHaveBeenCalled();
  });

  it('resolves a published product detail route', async () => {
    getProducts.mockResolvedValue({ data: [{ slug: 'fresh seeds' }] });
    const { result } = renderHook(() => useDesignerPreviewPath('product', '/products'));
    expect(result.current.path).toBeNull();
    await waitFor(() => expect(result.current.path).toBe('/products/fresh%20seeds'));
    expect(getProducts).toHaveBeenCalledWith({ limit: 1, status: 'published' });
  });

  it('finds a category slug in the category tree', async () => {
    getCategoryTree.mockResolvedValue({ data: [{ children: [{ slug: 'fruit' }] }] });
    const { result } = renderHook(() => useDesignerPreviewPath('category', '/category/all'));
    await waitFor(() => expect(result.current.path).toBe('/category/fruit'));
  });

  it.each(['product', 'category'])('explains missing %s records without using the fallback', async (page) => {
    getProducts.mockResolvedValue({ data: [] });
    getCategoryTree.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => useDesignerPreviewPath(page, '/wrong-page'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.path).toBeNull();
    expect(result.current.error).toMatch(page === 'product' ? /Add a published product/ : /Add a category/);
  });

  it('reports request failure', async () => {
    getProducts.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useDesignerPreviewPath('product', '/products'));
    await waitFor(() => expect(result.current.error).toMatch(/Could not load/));
    expect(result.current.path).toBeNull();
  });

  it('ignores an old lookup after changing pages', async () => {
    let finishProduct;
    getProducts.mockReturnValue(new Promise((resolve) => { finishProduct = resolve; }));
    getCategoryTree.mockResolvedValue({ data: [{ slug: 'vegetables' }] });
    const { result, rerender } = renderHook(({ page }) => useDesignerPreviewPath(page, '/'), { initialProps: { page: 'product' } });
    rerender({ page: 'category' });
    await waitFor(() => expect(result.current.path).toBe('/category/vegetables'));
    finishProduct({ data: [{ slug: 'old-product' }] });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.path).toBe('/category/vegetables');
  });
});
