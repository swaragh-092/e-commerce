import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import CatalogExplorerSection from '../../../components/storefront/sections/CatalogExplorerSection';
import { getProducts } from '../../../services/productService';

vi.mock('../../../components/product/ProductCard', () => ({
  default: ({ product }) => <span>{product.name}</span>,
}));
vi.mock('../../../hooks/useHeroCategories', () => ({
  default: () => ({ categories: [{ label: 'Grocery', slug: 'grocery' }] }),
}));
vi.mock('../../../context/BrandContext', () => ({ useBrands: () => ({ brands: [] }) }));
vi.mock('../../../hooks/useSettings', () => ({
  useFeatureVisible: () => false,
  useFeature: () => false,
}));
vi.mock('../../../services/productService', () => ({ getProducts: vi.fn() }));

it('filters and clears the results, with price sorting disabled in catalog mode', async () => {
  getProducts.mockImplementation(async ({ category }) => category
    ? { data: [], meta: { total: 0 } }
    : { data: [{ id: '1', name: 'Olive oil' }], meta: { total: 1 } });
  render(<CatalogExplorerSection section={{ catalogFilters: { defaultSort: 'price_desc' } }} />);
  expect(await screen.findByText('Olive oil')).toBeInTheDocument();
  expect(getProducts).toHaveBeenLastCalledWith({ discoveryRow: true, limit: 8, page: 1, sort: 'newest' });

  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Category' }));
  fireEvent.click(await screen.findByRole('option', { name: 'Grocery' }));
  expect(await screen.findByText('No products match these filters.')).toBeInTheDocument();
  expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'grocery', page: 1 }));
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(await screen.findByText('Olive oil')).toBeInTheDocument();

  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Sort products' }));
  expect(screen.queryByRole('option', { name: /price/i })).not.toBeInTheDocument();
});
