import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SearchResultsPage from '../../../pages/storefront/SearchResultsPage';
import { searchProducts } from '../../../services/searchService';
const state = vi.hoisted(() => ({ settings: { searchPage: {} } }));
vi.mock('../../../services/searchService', () => ({ searchProducts: vi.fn() }));
vi.mock('../../../components/common/PageSEO', () => ({ default: () => null }));
vi.mock('../../../components/search/SearchWidget', () => ({ default: ({ placeholder, initialValue, onSearch }) => <div><input aria-label="Search query" placeholder={placeholder} defaultValue={initialValue} /><button onClick={() => onSearch('rose')}>Search now</button></div> }));
vi.mock('../../../components/product/ProductGrid', () => ({ default: ({ products = [], gridCols, loading }) => <div data-testid="product-grid" data-columns={gridCols} data-count={products.length} data-loading={loading} /> }));
vi.mock('../../../hooks/useSettings', () => ({ useSettings: () => ({ settings: state.settings }) }));
beforeEach(() => { vi.clearAllMocks(); state.settings = { searchPage: {} }; searchProducts.mockResolvedValue({ data: { products: { data: [], currentPage: 1, totalPages: 1, totalItems: 0 }, brands: [], categories: [] } }); });
const mount = path => render(<MemoryRouter initialEntries={[path]}><SearchResultsPage /></MemoryRouter>);

describe('search page designer controls', () => {
  it('applies result page size, visibility toggles, text, and grid columns', async () => {
    state.settings = { searchPage: { gridColumns: 5, resultsPerPage: 12, showMatchingBrands: false, showMatchingCategories: false, showResultCount: false, searchTitle: 'Find your next flower', searchPlaceholder: 'Type flowers', noResultsTitle: 'No match', noResultsMessage: 'Try another flower.' } };
    mount('/search?q=rose');
    await waitFor(() => expect(searchProducts).toHaveBeenCalledWith(expect.objectContaining({ limit: 12, q: 'rose' })));
    expect(await screen.findByRole('heading', { name: 'Search results for "rose"' })).toBeInTheDocument();
    expect(screen.getByLabelText('Search query')).toHaveAttribute('placeholder', 'Type flowers');
    expect(screen.getByRole('heading', { name: 'No match' })).toBeInTheDocument();
    expect(screen.getByText('Try another flower.')).toBeInTheDocument();
    expect(screen.queryByText('0 product results')).not.toBeInTheDocument();
  });

  it('uses configured result columns and can hide matching brand/category chips', async () => {
    state.settings = { searchPage: { gridColumns: 6, resultsPerPage: 12, showMatchingBrands: false, showMatchingCategories: false, showResultCount: false } };
    searchProducts.mockResolvedValueOnce({ data: { products: { data: [{ id: 'p1', name: 'Rose' }], currentPage: 1, totalPages: 1, totalItems: 1 }, brands: [{ id: 'b', name: 'Rose Brand', slug: 'rose-brand' }], categories: [{ id: 'c', name: 'Roses', slug: 'roses' }] } });
    mount('/search?q=rose');
    await waitFor(() => expect(searchProducts).toHaveBeenCalledWith(expect.objectContaining({ limit: 12 })));
    expect(await screen.findByTestId('product-grid')).toHaveAttribute('data-columns', '6');
    expect(screen.queryByText('Rose Brand')).not.toBeInTheDocument();
    expect(screen.queryByText('Roses')).not.toBeInTheDocument();
  });

  it('customizes the initial search prompt without firing a query before input', async () => {
    state.settings = { searchPage: { searchTitle: 'Search the garden', initialPromptTitle: 'What do you need?', initialPromptMessage: 'Enter two letters to begin.' } };
    mount('/search');
    expect(await screen.findByRole('heading', { name: 'Search the garden' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What do you need?' })).toBeInTheDocument();
    expect(screen.getByText('Enter two letters to begin.')).toBeInTheDocument();
    expect(searchProducts).not.toHaveBeenCalled();
  });
});
