import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('../../../services/orderService', () => ({
  orderService: { claimGuestOrders: vi.fn() },
}));

import { orderService } from '../../../services/orderService';
import LinkGuestOrdersPage from '../../../pages/storefront/LinkGuestOrdersPage';

afterEach(() => vi.clearAllMocks());

describe('LinkGuestOrdersPage', () => {
  it('requires explicit confirmation before consuming the emailed claim link', async () => {
    orderService.claimGuestOrders.mockResolvedValue({ data: { linkedCount: 2 } });
    render(
      <MemoryRouter initialEntries={['/account/orders/link-guest?token=' + 'a'.repeat(64)]}>
        <Routes>
          <Route path="/account/orders/link-guest" element={<LinkGuestOrdersPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /confirm and link orders/i })).toBeInTheDocument();
    expect(orderService.claimGuestOrders).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /confirm and link orders/i }));
    expect(await screen.findByText(/2 guest orders linked/i)).toBeInTheDocument();
    expect(orderService.claimGuestOrders).toHaveBeenCalledWith('a'.repeat(64));
  });
});
