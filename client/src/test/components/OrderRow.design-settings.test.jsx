import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OrderRow from '../../components/orders/OrderRow';

const order = {
  id: 'order-1', orderNumber: 'ORDER-1', createdAt: '2026-11-01',
  status: 'cancelled', total: 125, paymentMethod: 'cod',
  items: [{ quantity: 2, snapshotImage: '/uploads/product.png', snapshotName: 'Test product', product: { name: 'Test product' } }],
};

describe('Order row presentation', () => {
  it('can show a saved product thumbnail without changing status, total or details actions', () => {
    const onView = vi.fn();
    const view = render(<OrderRow order={order} formatPrice={value => `₹${value}`} onView={onView} density="compact" showThumbnail />);
    expect(screen.getByRole('img', { name: 'Test product' })).toBeInTheDocument();
    expect(screen.getByText('₹125')).toBeInTheDocument();
    expect(screen.getByText(/cancelled/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View Details' }));
    expect(onView).toHaveBeenCalledTimes(1);
    expect(onView).toHaveBeenCalledWith('order-1');
    view.rerender(<OrderRow order={order} formatPrice={String} onView={onView} showThumbnail={false} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
