import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SearchWidget from '../../../components/search/SearchWidget';
import { searchProducts } from '../../../services/searchService';
import { SettingsContext } from '../../../context/ThemeContext';

vi.mock('../../../services/searchService', () => ({
  searchProducts: vi.fn(),
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
