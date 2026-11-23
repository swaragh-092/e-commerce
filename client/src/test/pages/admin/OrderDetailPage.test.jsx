import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderDetailPage from '../../../pages/admin/OrderDetailPage';
import { getOrderById } from '../../../services/adminService';
vi.mock('../../../services/adminService', () => ({ getOrderById: vi.fn() }));
vi.mock('../../../services/settingsService', () => ({ getSettingsGroup: vi.fn().mockResolvedValue({}) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../hooks/useSettings', () => ({ useFeature: () => false, useCurrency: () => ({ formatPrice: value => `₹${value}` }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify: vi.fn(), confirm: vi.fn() }) }));
vi.mock('../../../components/admin/StaffAssignment', () => ({ default: () => null }));
const base = {
  id: 'order', orderNumber: 'ORD-TEST', status: 'cancelled', orderShippingStatus: 'delivered',
  total: 100, paymentMethod: 'stripe', Payment: { status: 'payment_expired' },
  shippingAddressSnapshot: { fullName: 'Customer', addressLine1: 'Main Street' },
  items: [{ id: 'item', quantity: 1, unitPrice: 100, total: 100, productName: 'Product' }],
  fulfillments: [], shipments: [], returns: [], history: [],
};
const mount = () => render(<MemoryRouter initialEntries={['/admin/orders/order']}><Routes><Route path="/admin/orders/:id" element={<OrderDetailPage />} /></Routes></MemoryRouter>);
beforeEach(() => { vi.clearAllMocks(); getOrderById.mockResolvedValue({ data: { data: base } }); });
describe('admin order status and editing', () => {
  it('keeps cancelled orders locked and clearly labels conflicting lifecycle and shipping records', async () => {
    mount();
    expect(await screen.findByRole('button', { name: 'Edit Order' })).toBeDisabled();
    expect(screen.getByText('Order: Cancelled')).toBeInTheDocument();
    expect(screen.getByText('Delivery: Delivered')).toBeInTheDocument();
    expect(screen.getByText(/item-level fulfillment records do not confirm/)).toBeInTheDocument();
    expect(screen.getByText('Main Street')).toBeInTheDocument();
    expect(screen.queryByText('Out for delivery')).not.toBeInTheDocument();
  });
  it('allows editing an eligible order without changing its payment or total', async () => {
    getOrderById.mockResolvedValue({ data: { data: { ...base, status: 'confirmed', orderShippingStatus: 'not_shipped' } } });
    mount();
    const edit = await screen.findByRole('button', { name: 'Edit Order' });
    expect(edit).toBeEnabled();
    fireEvent.click(edit);
    expect(await screen.findByRole('dialog')).toHaveTextContent('Edit Order ORD-TEST');
  });
});
