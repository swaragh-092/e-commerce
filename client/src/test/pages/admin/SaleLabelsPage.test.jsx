import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import SaleLabelsPage from '../../../pages/admin/SaleLabelsPage';
import { createSaleLabel, getSaleLabels, getSaleLabelUsage, reorderSaleLabels, deleteSaleLabel } from '../../../services/adminService';
import { useNotification } from '../../../context/NotificationContext';
import { bulkUpdateProducts, getProducts } from '../../../services/productService';

vi.mock('../../../services/adminService', () => ({
  getSaleLabels: vi.fn(), createSaleLabel: vi.fn(), updateSaleLabel: vi.fn(),
  deleteSaleLabel: vi.fn(), reorderSaleLabels: vi.fn(), getSaleLabelUsage: vi.fn(),
}));
vi.mock('../../../services/productService', () => ({ getProducts: vi.fn(), bulkUpdateProducts: vi.fn() }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));

beforeEach(() => {
  vi.clearAllMocks();
  useNotification.mockReturnValue({ notify: vi.fn(), confirm: vi.fn() });
  getSaleLabels.mockResolvedValue({ data: { data: [] } });
});

it('shows the product count before asking for permission to delete', async () => {
  const confirm = vi.fn().mockResolvedValue(false);
  useNotification.mockReturnValue({ notify: vi.fn(), confirm });
  getSaleLabels.mockResolvedValue({ data: { data: [{ id: 'flash', name: 'Flash' }] } });
  getSaleLabelUsage.mockResolvedValue({ data: { data: { productCount: 3 } } });
  render(<SaleLabelsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Delete Flash' }));
  await waitFor(() => expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('3 products use this label') })));
  expect(deleteSaleLabel).not.toHaveBeenCalled();
});

it('moves a label without dropping its schedule', async () => {
  const startDate = '2099-01-01T00:00:00Z';
  const endDate = '2099-02-01T00:00:00Z';
  getSaleLabels.mockResolvedValue({ data: { data: [
    { id: 'first', name: 'First', priority: 0 },
    { id: 'second', name: 'Second', priority: 1, startDate, endDate },
  ] } });
  reorderSaleLabels.mockResolvedValue({});
  render(<SaleLabelsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Move Second up' }));
  expect(reorderSaleLabels).toHaveBeenCalledWith([
    expect.objectContaining({ id: 'second', priority: 0, startDate, endDate }),
    expect.objectContaining({ id: 'first', priority: 1 }),
  ]);
  expect(await screen.findByText('Scheduled')).toBeVisible();
});

it('keeps selections across catalog searches and previews replacements before assigning', async () => {
  getSaleLabels.mockResolvedValue({ data: { data: [{ id: 'flash', name: 'Flash Sale' }, { id: 'clearance', name: 'Clearance' }] } });
  getProducts.mockImplementation(async ({ search }) => ({ data: search
    ? [{ id: 'two', name: 'Second Product', sku: 'SKU-222' }]
    : [{ id: 'one', name: 'First Product', saleLabel: 'clearance' }] }));
  bulkUpdateProducts.mockResolvedValue({});
  render(<SaleLabelsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Assign Flash Sale to products' }));
  const search = screen.getByRole('combobox', { name: 'Search Products' });
  fireEvent.mouseDown(search);
  fireEvent.click(await screen.findByRole('option', { name: 'First Product' }));
  expect(screen.getByRole('alert')).toHaveTextContent('First Product (Clearance)');
  fireEvent.change(search, { target: { value: 'SKU-222' } });
  fireEvent.click(await screen.findByRole('option', { name: 'Second Product (SKU-222)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Assign to 2 products' }));
  expect(bulkUpdateProducts).toHaveBeenCalledWith(['one', 'two'], { saleLabel: 'flash' });
});

it('distinguishes scheduled and expired labels from enabled and disabled labels', async () => {
  getSaleLabels.mockResolvedValue({ data: { data: [
    { id: 'future', name: 'Future Sale', isActive: true, startDate: '2099-01-01T00:00:00Z' },
    { id: 'past', name: 'Past Sale', isActive: true, endDate: '2000-01-01T00:00:00Z' },
    { id: 'live', name: 'Live Sale', isActive: true },
    { id: 'off', name: 'Disabled Sale', isActive: false, startDate: '2099-01-01T00:00:00Z' },
  ] } });
  render(<SaleLabelsPage />);
  await screen.findByText('Scheduled');
  expect(screen.getByText('Expired')).toBeVisible();
  expect(screen.getByText('Active')).toBeVisible();
  expect(screen.getByText('Disabled')).toBeVisible();
});

it('previews the badge and prevents an invalid schedule from reaching the API', async () => {
  render(<SaleLabelsPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'New Label' }));
  const editor = within(screen.getByRole('dialog', { name: 'New Sale Label' }));
  fireEvent.change(editor.getByRole('textbox', { name: 'Display Name' }), { target: { value: 'Flash Sale' } });
  expect(editor.getByText('Flash Sale')).toBeVisible();
  fireEvent.change(editor.getByRole('textbox', { name: 'Label ID' }), { target: { value: 'flash-sale' } });
  fireEvent.change(editor.getByLabelText('Global Start Date'), { target: { value: '2030-05-02T10:00' } });
  fireEvent.change(editor.getByLabelText('Global End Date'), { target: { value: '2030-05-01T10:00' } });
  expect(editor.getByText('End time must be after the start time.')).toBeVisible();
  expect(editor.getByRole('button', { name: 'Save Label' })).toBeDisabled();
  fireEvent.submit(editor.getByRole('button', { name: 'Save Label' }).form);
  expect(createSaleLabel).not.toHaveBeenCalled();
});
