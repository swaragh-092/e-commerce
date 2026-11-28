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
vi.mock('@mui/x-data-grid', () => ({ DataGrid: ({ rows, columns }) => (
  <div>{rows.map(row => (
    <div key={row.id}>
      {columns.find(column => column.field === 'name').renderCell({ row })}
      {columns.find(column => column.field === 'actions').renderCell({ row })}
    </div>
  ))}</div>
) }));
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
  it.each([['Closed – Converted', 'closed_converted'], ['Closed – Lost', 'closed_lost']])('saves and displays %s', async (label, status) => {
    api.patch.mockResolvedValue({});
    const dialog = await open();
    fireEvent.click(dialog.getByRole('button', { name: label }));
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/enquiries/eq1/status', { status }));
    await waitFor(() => expect(dialog.getByRole('button', { name: label })).toBeDisabled());
    expect(dialog.getAllByText(label)).toHaveLength(2);
    expect(dialog.queryByRole('button', { name: 'closed' })).not.toBeInTheDocument();
  });
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

  it.each([[false, 'Guest'], [null, 'Unknown'], [true, 'Signed-in customer']])(
    'shows %s submission metadata without guessing an account',
    async (submittedWhileSignedIn, label) => {
      const current = { ...enquiry, submittedWhileSignedIn };
      api.get.mockResolvedValueOnce({ data: { data: [current], meta: { total: 1 } } });
      const dialog = await open();
      expect(dialog.getByText((_, node) => node.tagName === 'P' && node.textContent === `Submission type ${label}`)).toBeInTheDocument();
      expect(dialog.getByText('Unavailable')).toBeInTheDocument();
      expect(dialog.queryByRole('region', { name: 'Past enquiries' })).not.toBeInTheDocument();
      expect(api.get.mock.calls.some(([, options]) => options?.params?.submittedByUserId)).toBe(false);
    },
  );

  it('separates account and reply emails and opens paginated account history', async () => {
    const submitter = { email: 'account@example.test' };
    const current = { ...enquiry, submittedByUserId: 'account-1', submittedWhileSignedIn: true, submitter };
    const other = { ...current, id: 'eq2', email: 'past-reply@example.test', product: { id: 'p2', name: 'MANGO' } };
    const older = { ...other, id: 'eq3', product: { id: 'p3', name: 'LEMON' } };
    const defaultGet = api.get.getMockImplementation();
    api.get.mockImplementation((url, config) => {
      const { submittedByUserId, excludeId, page } = config?.params || {};
      if (submittedByUserId) {
        const rows = excludeId === current.id ? [page === 1 ? other : older] : [current];
        return Promise.resolve({ data: { data: rows, meta: { total: excludeId === current.id ? 6 : 1 } } });
      }
      if (url === '/admin/enquiries') return Promise.resolve({ data: { data: [current], meta: { total: 1 } } });
      return defaultGet(url, config);
    });

    const dialog = await open();
    expect(dialog.getByText('Account email').parentElement).toHaveTextContent('account@example.test');
    expect(dialog.getByText('Reply email')).toBeInTheDocument();
    expect(dialog.getByRole('link', { name: current.email })).toHaveAttribute('href', `mailto:${current.email}`);
    const history = within(dialog.getByRole('region', { name: 'Past enquiries' }));
    expect(await history.findByText('MANGO')).toBeInTheDocument();
    fireEvent.click(history.getByRole('button', { name: /next page/i }));
    expect(await history.findByText('LEMON')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/enquiries', expect.objectContaining({
      params: { submittedByUserId: 'account-1', excludeId: 'eq1', page: 2, limit: 5 },
    }));
    fireEvent.click(history.getByRole('button', { name: 'View enquiry for LEMON' }));
    expect(await dialog.findByRole('heading', { name: /LEMON enquiry/ })).toBeInTheDocument();
    expect(dialog.getByRole('link', { name: older.email })).toHaveAttribute('href', `mailto:${older.email}`);
  });

});
