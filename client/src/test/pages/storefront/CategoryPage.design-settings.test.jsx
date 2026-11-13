import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CategoryPage from '../../../pages/storefront/CategoryPage';
import { getCategoryWithProducts } from '../../../services/categoryService';

const state = vi.hoisted(() => ({ settings: { catalog: {}, categoryPage: {} } }));
const gridSpy = vi.hoisted(() => vi.fn());

vi.mock('../../../services/categoryService', () => ({ getCategoryWithProducts: vi.fn() }));
vi.mock('../../../components/common/PageSEO', () => ({ default: () => null }));
vi.mock('../../../components/product/ProductGrid', () => ({ default: (props) => { gridSpy(props); return <div data-testid="product-grid" />; } }));
vi.mock('../../../components/product/ProductFilters', () => ({ default: ({ categoryDepth, categoryExpandMode }) => <div data-testid="category-filter-settings" data-depth={categoryDepth} data-expand-mode={categoryExpandMode} /> }));
vi.mock('../../../components/layout/StorefrontSidebarMenu', () => ({ default: () => null }));
vi.mock('../../../components/storefront/sections/CategorySection', () => ({ default: () => null }));
vi.mock('../../../hooks/useSettings', () => ({ useSettings: () => ({ settings: state.settings }), useFeature: () => true, useFeatureVisible: () => true }));

const renderPage = () => render(
  <MemoryRouter initialEntries={['/category/flowers']}>
    <Routes><Route path="/category/:categorySlug" element={<CategoryPage />} /></Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  vi.clearAllMocks();
  state.settings = { catalog: { defaultPageSize: 12, gridColumns: 3 }, categoryPage: {} };
  getCategoryWithProducts.mockResolvedValue({
    data: { category: { name: 'Flowers', slug: 'flowers' }, products: [], subcategories: [], pagination: { totalPages: 1, page: 1 } },
  });
});

describe('Category listing design settings', () => {
  it('uses category overrides for fetch limit and desktop grid columns', async () => {
    state.settings.categoryPage = { defaultPageSize: 7, gridColumns: 5, categoryDepth: 4, categoryExpandMode: 'collapsed' };
    renderPage();
    await waitFor(() => expect(getCategoryWithProducts).toHaveBeenCalledWith('flowers', expect.objectContaining({ limit: 7 })));
    expect(gridSpy).toHaveBeenLastCalledWith(expect.objectContaining({ gridCols: 5 }));
    expect(screen.getByTestId('category-filter-settings')).toHaveAttribute('data-depth', '4');
    expect(screen.getByTestId('category-filter-settings')).toHaveAttribute('data-expand-mode', 'collapsed');
  });

  it('reacts to settings changes and falls back to catalog values when category overrides are removed', async () => {
    const view = renderPage();
    await waitFor(() => expect(getCategoryWithProducts).toHaveBeenCalledWith('flowers', expect.objectContaining({ limit: 12 })));
    expect(gridSpy).toHaveBeenLastCalledWith(expect.objectContaining({ gridCols: 3 }));

    state.settings = { catalog: { defaultPageSize: 18, gridColumns: 6 }, categoryPage: { defaultPageSize: 150, gridColumns: 6 } };
    view.rerender(
      <MemoryRouter initialEntries={['/category/flowers']}>
        <Routes><Route path="/category/:categorySlug" element={<CategoryPage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(getCategoryWithProducts).toHaveBeenLastCalledWith('flowers', expect.objectContaining({ limit: 100 })));
    expect(gridSpy).toHaveBeenLastCalledWith(expect.objectContaining({ gridCols: 6 }));

    state.settings = { catalog: { defaultPageSize: 18, gridColumns: 4 }, categoryPage: {} };
    view.rerender(
      <MemoryRouter initialEntries={['/category/flowers']}>
        <Routes><Route path="/category/:categorySlug" element={<CategoryPage />} /></Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(getCategoryWithProducts).toHaveBeenLastCalledWith('flowers', expect.objectContaining({ limit: 18 })));
    expect(gridSpy).toHaveBeenLastCalledWith(expect.objectContaining({ gridCols: 4 }));
  });
});
