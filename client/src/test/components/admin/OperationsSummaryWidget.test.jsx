import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OperationsSummaryWidget from '../../../components/admin/dashboard/OperationsSummaryWidget';
import StoreHealthWidget from '../../../components/admin/dashboard/StoreHealthWidget';
import KpiCardsWidget from '../../../components/admin/dashboard/KpiCardsWidget';

const { navigateMock } = vi.hoisted(() => ({ navigateMock: vi.fn() }));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useNavigate: () => navigateMock };
});

const destinations = [
  ['Pending Payment', '/admin/orders?status=pending_payment'],
  ['Low Stock', '/admin/products?stock=low'],
  ['Customers', '/admin/customers'],
  ['Published', '/admin/products?status=published'],
  ['Pending Reviews', '/admin/reviews?status=pending'],
];

describe('OperationsSummaryWidget navigation', () => {
  beforeEach(() => navigateMock.mockClear());
  afterEach(() => cleanup());

  it.each(destinations)('opens the correct destination for %s', (label, destination) => {
    render(
      <OperationsSummaryWidget
        stats={{ pendingOrders: 3, lowStockCount: 4, customerCount: 5, productCount: 6, pendingReviewsCount: 7 }}
        spacing={{ panel: 2 }}
        features={{ orders: true, customers: true, reviews: true }}
        mode="ecommerce"
      />
    );

    const card = screen.getByText(label).closest('.MuiPaper-root');
    expect(card).not.toBeNull();
    fireEvent.click(card);

    expect(navigateMock).toHaveBeenCalledWith(destination);
  });

  it.each([OperationsSummaryWidget, KpiCardsWidget])('hides customer dashboard shortcuts when disabled and restores them when enabled', (Widget) => {
    const props = {
      stats: { customerCount: 5 }, spacing: { panel: 2 },
      settings: { 'dashboard.showStatCards': true, 'dashboard.showCustomersCard': true },
      formatPrice: String, mode: 'catalog',
    };
    const { rerender } = render(<Widget {...props} features={{ customers: false }} />);
    expect(screen.queryByText('Customers', { exact: true })).not.toBeInTheDocument();
    rerender(<Widget {...props} features={{ customers: true }} />);
    expect(screen.getByText('Customers', { exact: true })).toBeInTheDocument();
  });
});


describe('Dashboard feature visibility', () => {
  afterEach(() => cleanup());

  it.each([undefined, false, true])('shows review cards only when reviews is enabled (%s)', (reviews) => {
    const props = {
      stats: { totalReviewsCount: 6, pendingReviewsCount: 1 },
      spacing: { panel: 2, grid: 2, page: 2 },
      settings: { 'dashboard.showStatCards': true },
      formatPrice: String, features: { reviews }, mode: 'catalog',
    };
    render(<><OperationsSummaryWidget {...props} /><KpiCardsWidget {...props} /></>);
    for (const label of ['Total Reviews', 'Pending Reviews']) {
      if (reviews === true) expect(screen.getByText(label)).toBeInTheDocument();
      else expect(screen.queryByText(label)).not.toBeInTheDocument();
    }
  });

  it('excludes logo configuration from the health checks and score', () => {
    render(<StoreHealthWidget stats={{ productCount: 1, lowStockCount: 0 }} allSettings={{ logo: { main: 'logo.png' } }} spacing={{ panel: 2 }} mode="catalog" />);
    expect(screen.queryByText('Logo configured')).not.toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
