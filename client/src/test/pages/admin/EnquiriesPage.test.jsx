import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EnquiriesPage from '../../../pages/admin/EnquiriesPage';
import api from '../../../services/api';
const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../components/common/PageSEO', () => ({ default: () => null }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify }) }));
vi.mock('@mui/x-data-grid', () => ({ DataGrid: ({ rows, columns }) => <div>{rows.map(row => <div key={row.id}>{columns.find(column => column.field === 'actions').renderCell({ row })}</div>)}</div> }));
const enquiry = { id: 'eq1', name: 'Customer', email: 'customer@example.test', phone: '9876543210', message: 'Tell me more', status: 'pending', createdAt: '2026-10-30T10:00:00Z', product: { id: 'p1', name: 'RED BERRY' }, quantity: 2, replies: [{ id: 'r1', senderName: 'First Staff', createdAt: '2026-10-30T11:00:00Z', message: 'Earlier reply' }] };
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockImplementation(async (url) => url.includes('/assignments/') ? { data: { data: { assignedUserId: 's1', candidates: [{ id: 's1', name: 'Full Staff Name', email: 'staff@example.test' }, { id: 's2', name: 'Other Staff', email: 'other@example.test' }] } } } : { data: { data: [enquiry], meta: { total: 1 } } });
  api.put.mockResolvedValue({});
});
const open = async () => {
  render(<MemoryRouter><EnquiriesPage /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'View enquiry from customer@example.test' }));
  return within(screen.getByRole('dialog'));
};
describe('Enquiry workspace', () => {
  it('shows contact links and product details, and saves only changed assignments', async () => {
    const dialog = await open();
    expect(dialog.getByRole('heading', { name: /RED BERRY enquiry/ })).toBeInTheDocument();
    expect(dialog.getByRole('link', { name: 'customer@example.test' })).toHaveAttribute('href', 'mailto:customer@example.test');
    expect(dialog.getByRole('link', { name: '9876543210' })).toHaveAttribute('href', 'tel:9876543210');
    expect(dialog.getByRole('link', { name: 'RED BERRY' })).toHaveAttribute('href', '/admin/products/p1/edit');
    expect(dialog.getByText('Quantity: 2')).toBeInTheDocument();
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fireEvent.click(dialog.getByRole('button', { name: 'Copy phone' }));
    await dialog.findByText('Copied');
    expect(writeText).toHaveBeenCalledWith('9876543210');
    const save = await dialog.findByRole('button', { name: 'Save assignment' });
    await waitFor(() => expect(dialog.getByRole('combobox')).toHaveValue('Full Staff Name'));
    expect(save).toBeDisabled();
    fireEvent.change(dialog.getByRole('combobox'), { target: { value: 'Other' } });
    fireEvent.click(await screen.findByRole('option', { name: /Other Staff/ }));
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await dialog.findByText('Assignment saved.');
    expect(save).toBeDisabled();
    expect(api.put).toHaveBeenCalledWith('/notifications/assignments/enquiries/eq1', { assignedUserId: 's2' });
  });
  it('keeps the dialog open after sending and displays saved reply history', async () => {
    api.post.mockResolvedValue({ data: { data: { enquiry: { ...enquiry, status: 'responded', replies: [...enquiry.replies, { id: 'r2', senderName: 'Second Staff', createdAt: '2026-10-31T10:00:00Z', message: 'New reply' }] } } } });
    const dialog = await open();
    expect(dialog.getByText('Earlier reply')).toBeInTheDocument();
    fireEvent.click(dialog.getByRole('button', { name: 'Reply via Email' }));
    fireEvent.change(dialog.getByRole('textbox', { name: 'Reply message' }), { target: { value: 'New reply' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Send Reply' }));
    await dialog.findByText('Reply sent.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(dialog.getByText('New reply')).toBeInTheDocument();
    expect(dialog.getByText('Second Staff')).toBeInTheDocument();
    expect(dialog.getByText('Earlier reply')).toBeInTheDocument();
  });
  it('keeps the reply draft when sending fails', async () => {
    api.post.mockRejectedValue(new Error('Network failure'));
    const dialog = await open();
    fireEvent.click(dialog.getByRole('button', { name: 'Reply via Email' }));
    fireEvent.change(dialog.getByRole('textbox', { name: 'Reply message' }), { target: { value: 'Keep my draft' } });
    fireEvent.click(dialog.getByRole('button', { name: 'Send Reply' }));
    await waitFor(() => expect(dialog.getByRole('button', { name: 'Send Reply' })).toBeEnabled());
    expect(dialog.getByRole('textbox', { name: 'Reply message' })).toHaveValue('Keep my draft');
    expect(dialog.queryByText('Reply sent.')).not.toBeInTheDocument();
  });

});
