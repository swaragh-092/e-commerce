import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentSuccessPage from '../../../pages/storefront/PaymentSuccessPage';

const mocks = vi.hoisted(() => ({
  getMyOrderById: vi.fn(),
  fetchCart: vi.fn(),
}));
const { getMyOrderById, fetchCart } = mocks;

vi.mock('../../../services/orderService', () => ({
  orderService: { getMyOrderById: mocks.getMyOrderById },
}));

vi.mock('../../../hooks/useCart', () => ({
  useCart: () => ({ fetchCart: mocks.fetchCart }),
}));

const renderPage = (initialEntry = '/payment/success') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <PaymentSuccessPage />
  </MemoryRouter>
);

describe('PaymentSuccessPage', () => {
  beforeEach(() => {
    getMyOrderById.mockReset();
    fetchCart.mockReset();
  });

  it('does not claim success without an order id', () => {
    renderPage();

    expect(screen.queryByText('Order Placed!')).not.toBeInTheDocument();
    expect(screen.getByText(/order reference is missing/i)).toBeInTheDocument();
    expect(getMyOrderById).not.toHaveBeenCalled();
  });

  it('shows an error when the order cannot be verified', async () => {
    getMyOrderById.mockRejectedValue(new Error('not found'));

    renderPage('/payment/success?orderId=order-1');

    await waitFor(() => expect(screen.getByText(/could not verify this order/i)).toBeInTheDocument());
    expect(screen.queryByText('Order Placed!')).not.toBeInTheDocument();
  });

  it('shows a pending state until an online payment is settled', async () => {
    getMyOrderById.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'ORD-1',
      status: 'pending_payment',
      paymentMethod: 'razorpay',
      Payment: { status: 'pending' },
    });

    renderPage('/payment/success?orderId=order-1');

    await waitFor(() => expect(screen.getByText(/payment is still being confirmed/i)).toBeInTheDocument());
    expect(screen.queryByText('Order Placed!')).not.toBeInTheDocument();
  });

  it('shows success only for the verified settled order', async () => {
    getMyOrderById.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'ORD-1',
      status: 'processing',
      paymentMethod: 'razorpay',
      Payment: { status: 'paid_online' },
    });

    renderPage('/payment/success?orderId=order-1');

    await waitFor(() => expect(screen.getByText('Order Placed!')).toBeInTheDocument());
    expect(screen.getByText(/payment successful/i)).toBeInTheDocument();
  });
});
