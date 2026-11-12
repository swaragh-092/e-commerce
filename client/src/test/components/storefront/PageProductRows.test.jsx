import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getProducts } from '../../../services/productService';
import PageProductRows from '../../../components/storefront/sections/PageProductRows';

vi.mock('../../../services/productService', () => ({ getProducts: vi.fn() }));

describe('page product rows', () => {
  beforeEach(() => {
    getProducts.mockResolvedValue({ data: [] });
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
