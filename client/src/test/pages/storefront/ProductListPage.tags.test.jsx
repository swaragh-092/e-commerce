import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProductListPage from '../../../pages/storefront/ProductListPage';
import { getProducts } from '../../../services/productService';
vi.mock('../../../services/productService', () => ({ getProducts: vi.fn() }));
vi.mock('../../../services/categoryService', () => ({ getCategoryTree: vi.fn().mockResolvedValue({ data: [] }) }));
vi.mock('../../../components/common/PageSEO', () => ({ default: () => null }));
vi.mock('../../../components/product/ProductGrid', () => ({ default: ({ hasActiveFilters, onClearFilters }) => <button onClick={onClearFilters}>Clear filters {String(hasActiveFilters)}</button> }));
vi.mock('../../../components/product/ProductFilters', () => ({ default: () => null }));
vi.mock('../../../components/layout/StorefrontSidebarMenu', () => ({ default: () => null }));
vi.mock('../../../hooks/useSettings', () => ({ useSettings: () => ({ settings: { catalog: { showFilters: false } } }), useFeature: () => true, useFeatureVisible: () => true }));
const mount = () => render(<MemoryRouter initialEntries={['/products?tags=summer&category=seeds']}><ProductListPage /></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); getProducts.mockResolvedValue({ data: [], meta: { page: 1, totalPages: 3 } }); });

describe('storefront tag browsing', () => {
  it('passes the URL tag alongside category, and retains it across pagination', async () => {
    mount();
    await waitFor(() => expect(getProducts).toHaveBeenCalledWith(expect.objectContaining({ tags: 'summer', category: 'seeds' })));
    fireEvent.click(await screen.findByRole('button', { name: 'Go to page 2' }));
    await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ tags: 'summer', category: 'seeds', page: 2 })));
  });
  it('marks tag results as filtered and clears the tag on reset', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Clear filters true' }));
    await waitFor(() => expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ tags: '', category: '' })));
  });
});
