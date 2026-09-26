import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentFailurePage from '../../../pages/storefront/PaymentFailurePage';

const mocks = vi.hoisted(() => ({
  getMyOrderById: vi.fn(),
}));

vi.mock('../../../services/orderService', () => ({
  orderService: { getMyOrderById: mocks.getMyOrderById },
}));

const renderPage = (initialEntry = '/payment/failure') => render(
  <MemoryRouter initialEntries={[initialEntry]}>
    <PaymentFailurePage />
  </MemoryRouter>
);

describe('PaymentFailurePage', () => {
  beforeEach(() => {
    mocks.getMyOrderById.mockReset();
  });

  it('does not claim the customer was not charged when no order can be verified', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: /could not confirm payment status/i })).toBeInTheDocument();
    expect(screen.getByText(/could not verify whether the payment completed/i)).toBeInTheDocument();
    expect(screen.queryByText(/not charged/i)).not.toBeInTheDocument();
    expect(mocks.getMyOrderById).not.toHaveBeenCalled();
  });

  it('shows a pending state when the server has no final payment result', async () => {
    mocks.getMyOrderById.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'ORD-1',
      status: 'pending_payment',
      Payment: { status: 'payment_pending' },
    });

    renderPage('/payment/failure?orderId=order-1&status=FAILED');

    await waitFor(() => expect(screen.getByRole('heading', { name: /still pending/i })).toBeInTheDocument());
    expect(screen.getByText(/check your order status before starting another payment/i)).toBeInTheDocument();
    expect(screen.queryByText(/not charged/i)).not.toBeInTheDocument();
  });

  it('only offers retry after the server confirms a definitive failure', async () => {
    mocks.getMyOrderById.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'ORD-1',
      status: 'pending_payment',
      Payment: { status: 'payment_failed' },
    });

    renderPage('/payment/failure?orderId=order-1');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Payment failed' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    expect(screen.getByText(/server confirmed that this payment did not complete/i)).toBeInTheDocument();
    expect(screen.queryByText(/not charged/i)).not.toBeInTheDocument();
  });

  it('does not show a failure after the server confirms a settled payment', async () => {
    mocks.getMyOrderById.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'ORD-1',
      status: 'processing',
      Payment: { status: 'paid_online' },
    });

    renderPage('/payment/failure?orderId=order-1');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Payment received' })).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /view order status/i })).toHaveAttribute('href', '/account/orders/order-1');
    expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument();
  });

  it('uses an ambiguous status message when server verification fails', async () => {
    mocks.getMyOrderById.mockRejectedValue(new Error('network error'));

    renderPage('/payment/failure?orderId=order-1');

    await waitFor(() => expect(screen.getByRole('heading', { name: /could not confirm payment status/i })).toBeInTheDocument());
    expect(screen.getByText(/check your bank or payment provider before trying again/i)).toBeInTheDocument();
    expect(screen.queryByText(/not charged/i)).not.toBeInTheDocument();
  });
});
