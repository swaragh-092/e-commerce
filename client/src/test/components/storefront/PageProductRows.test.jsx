import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getProducts } from '../../../services/productService';
import PageProductRows from '../../../components/storefront/sections/PageProductRows';

vi.mock('../../../services/productService', () => ({ getProducts: vi.fn() }));

describe('page product rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProducts.mockResolvedValue({ data: [] });
  });

  it.each([
    ['featured', '/products?featured=true', { featured: true }],
    ['sale', '/products?onSale=true', { sale: true }],
  ])('preserves %s in the row request and View All link', async (source, href, filter) => {
    render(<MemoryRouter><PageProductRows rows={[{ id: 'row', type: 'product-row', source }]} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'View All' })).toHaveAttribute('href', href);
    await waitFor(() => expect(getProducts).toHaveBeenCalledWith(expect.objectContaining(filter)));
  });

  it('requests the configured most-viewed products with the discovery ranking', async () => {
    render(<MemoryRouter><PageProductRows rows={[{
      id: 'trending',
      type: 'product-row',
      source: 'mostViewed',
      count: 8,
      enabled: true,
    }]} /></MemoryRouter>);

    await waitFor(() => expect(getProducts).toHaveBeenCalledWith({
      sort: 'most-viewed',
      discoveryRow: true,
      limit: 8,
      status: 'published',
    }));
  });
});
