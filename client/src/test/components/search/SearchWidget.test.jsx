import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SearchWidget from '../../../components/search/SearchWidget';
import { searchProducts } from '../../../services/searchService';
import { SettingsContext } from '../../../context/ThemeContext';

vi.mock('../../../services/searchService', () => ({
  searchProducts: vi.fn(),
}));
vi.mock('../../../services/categoryService', async (importOriginal) => ({
  ...await importOriginal(),
  getCategories: vi.fn().mockResolvedValue([{ slug: 'fresh-fruit', name: 'Fresh fruit' }]),
}));

const renderSearchWidget = (children, config = { features: { pricing: false } }) => render(
  <MemoryRouter>
    <SettingsContext.Provider value={config}>
      <ThemeProvider theme={createTheme()}>{children}</ThemeProvider>
    </SettingsContext.Provider>
  </MemoryRouter>
);

describe('SearchWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchProducts.mockResolvedValue({
      data: {
        products: {
          data: [{ id: 'product-1', name: 'Demo', slug: 'demo', price: '10.00', images: [] }],
          totalItems: 1,
        },
        brands: [],
        categories: [],
      },
    });
  });

  it('keeps suggestions inside a hidden responsive wrapper', async () => {
    const { container } = renderSearchWidget(
      <div data-testid="hidden-search" style={{ display: 'none' }}>
        <SearchWidget variant="header" />
      </div>
    );

    fireEvent.change(container.querySelector('input'), { target: { value: 'demo' } });

    await waitFor(() => expect(searchProducts).toHaveBeenCalledWith({ q: 'demo', limit: 5 }));
    const suggestion = await screen.findByText('Demo');

    expect(screen.getByTestId('hidden-search')).toContainElement(suggestion);
    expect(screen.queryByText(/10\.00|undefined/)).not.toBeInTheDocument();
  });

  it('submits the query when the search button is clicked', () => {
    const onSearch = vi.fn();
    const { container } = renderSearchWidget(
      <SearchWidget variant="inline" onSearch={onSearch} />
    );

    fireEvent.change(container.querySelector('input'), { target: { value: 'demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(onSearch).toHaveBeenCalledWith('demo');
  });

  it('uses the selected category for suggestions and the submitted search URL', async () => {
    const Location = () => <output>{useLocation().search}</output>;
    const { container } = renderSearchWidget(<><SearchWidget variant="header" showCategoryDropdown /><Location /></>);
    await screen.findByRole('option', { name: 'Fresh fruit' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Search category' }), { target: { value: 'fresh-fruit' } });
    fireEvent.change(container.querySelector('input'), { target: { value: 'apple' } });
    await waitFor(() => expect(searchProducts).toHaveBeenCalledWith({ q: 'apple', limit: 5, category: 'fresh-fruit' }));
    fireEvent.keyDown(container.querySelector('input'), { key: 'Enter' });
    expect(screen.getByText('?q=apple&category=fresh-fruit')).toBeInTheDocument();
  });

  it('formats a zero price and omits missing prices when storefront pricing is enabled', async () => {
    searchProducts.mockResolvedValue({
      data: { products: { data: [
        { id: 'zero', name: 'Demo Zero', slug: 'demo-zero', effectivePrice: 0, price: 10 },
        { id: 'missing', name: 'Demo Missing', slug: 'demo-missing' },
      ], totalItems: 2 } },
    });
    const { container } = renderSearchWidget(<SearchWidget />, {
      features: { pricing: true, showPrice: true },
      visibility: { storefront: { pricing: true } },
    });
    fireEvent.change(container.querySelector('input'), { target: { value: 'demo' } });
    expect(await screen.findByText('$0.00')).toBeInTheDocument();
    expect(screen.getByText('Demo Missing')).toBeInTheDocument();
    expect(screen.queryByText(/undefined|\$10\.00/)).not.toBeInTheDocument();
  });
});
