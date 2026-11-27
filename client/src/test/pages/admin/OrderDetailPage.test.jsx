import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderDetailPage from '../../../pages/admin/OrderDetailPage';
import { getOrderById, processRefund } from '../../../services/adminService';
vi.mock('../../../services/adminService', () => ({ getOrderById: vi.fn(), processRefund: vi.fn() }));
vi.mock('../../../services/settingsService', () => ({ getSettingsGroup: vi.fn().mockResolvedValue({}) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../hooks/useSettings', () => ({ useFeature: () => false, useCurrency: () => ({ formatPrice: value => `₹${value}` }) }));
const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify, confirm: vi.fn() }) }));
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
  it('refreshes and blocks another submission after an ambiguous refund error', async () => {
    const returnedItem = { id: 'returned-item', quantity: 1, orderItem: { ...base.items[0], snapshotName: 'Product' } };
    const order = {
      ...base,
      status: 'processing',
      Payment: { status: 'paid_online', amount: 100 },
      returns: [
        { id: 'return-1', type: 'return', status: 'pickup_completed', reason: 'First return', items: [returnedItem] },
        { id: 'return-2', type: 'return', status: 'pickup_completed', reason: 'Other return', items: [returnedItem] },
      ],
    };
    getOrderById.mockResolvedValueOnce({ data: { data: order } }).mockResolvedValueOnce({
      data: { data: { ...order, refunds: [{ id: 'pending-local-reference', returnId: 'return-1', amount: 25, status: 'refund_processing' }] } },
    });
    processRefund.mockRejectedValueOnce(new Error('Gateway did not respond.'));

    mount();
    const [firstRefund] = await screen.findAllByRole('button', { name: 'Issue refund' });
    fireEvent.click(firstRefund);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Issue refund' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(processRefund).toHaveBeenCalledTimes(1);
    expect(processRefund).toHaveBeenCalledWith('order', { returnId: 'return-1', amount: 100, reason: 'First return' });
    expect(getOrderById).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Refund processing' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Issue refund' })).toBeDisabled();
    expect(screen.getByText(/pending-local-reference/)).toBeInTheDocument();
    expect(notify).toHaveBeenCalledWith(expect.stringMatching(/Gateway did not respond.*Check the order’s refund status before trying again/), 'error');
  });
});
