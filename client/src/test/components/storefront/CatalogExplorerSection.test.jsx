import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import CatalogExplorerSection from '../../../components/storefront/sections/CatalogExplorerSection';
import { getProducts } from '../../../services/productService';
import api from '../../../services/api';
import { useFeature } from '../../../hooks/useSettings';

vi.mock('../../../components/product/ProductCard', () => ({
  default: ({ product }) => <span>{product.name}</span>,
}));
vi.mock('../../../hooks/useHeroCategories', () => ({
  default: () => ({ categories: [{ label: 'Grocery', slug: 'grocery' }] }),
}));
vi.mock('../../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../../hooks/useSettings', () => ({
  useFeatureVisible: () => false,
  useFeature: vi.fn(() => false),
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

it('includes eligible brands from later API pages in the storefront filter', async () => {
  useFeature.mockReturnValueOnce(true).mockReturnValue(true);
  api.get.mockImplementation(async (_, { params }) => ({ data: {
    data: [{ slug: `brand-${params.page}`, name: `Brand ${params.page}` }],
    meta: { totalPages: 2 },
  } }));
  getProducts.mockResolvedValue({ data: [], meta: { total: 0 } });
  render(<CatalogExplorerSection />);
  const filter = screen.getByRole('combobox', { name: 'Brand' });
  await waitFor(() => expect(filter).not.toHaveAttribute('aria-disabled', 'true'));
  fireEvent.mouseDown(filter);
  fireEvent.click(await screen.findByRole('option', { name: 'Brand 2' }));
  expect(api.get).toHaveBeenCalledWith('/brands', { params: { isActive: true, withPublishedProducts: true, page: 2, limit: 1000 } });
  expect(getProducts).toHaveBeenLastCalledWith(expect.objectContaining({ brand: 'brand-2' }));
});
