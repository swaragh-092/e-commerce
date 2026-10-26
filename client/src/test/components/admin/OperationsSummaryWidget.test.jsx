import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OperationsSummaryWidget from '../../../components/admin/dashboard/OperationsSummaryWidget';

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
        features={{ orders: true }}
        mode="ecommerce"
      />
    );

    const card = screen.getByText(label).closest('.MuiPaper-root');
    expect(card).not.toBeNull();
    fireEvent.click(card);

    expect(navigateMock).toHaveBeenCalledWith(destination);
  });
});
