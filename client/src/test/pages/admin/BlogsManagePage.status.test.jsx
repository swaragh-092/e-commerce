import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BlogsManagePage from '../../../pages/admin/BlogsManagePage';

const { notify, auth } = vi.hoisted(() => ({ notify: vi.fn(), auth: { canManage: true } }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => auth.canManage }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify }) }));
vi.mock('../../../services/blogService', () => ({
  default: { adminGetPosts: vi.fn(), adminUpdatePost: vi.fn(), adminDeletePost: vi.fn() },
}));
vi.mock('@mui/x-data-grid', () => ({
  DataGrid: ({ rows, columns }) => <div>{rows.map((row) => <div key={row.id}>
    {columns.filter((column) => column.renderCell).map((column) => (
      <div key={column.field}>{column.renderCell({ row, value: row[column.field] })}</div>
    ))}
  </div>)}</div>,
}));

const blogService = await import('../../../services/blogService');
const post = { id: 'post-1', title: 'Orbi seeds', slug: 'orbi-seeds', status: 'published', publishedAt: '2026-05-21T00:00:00Z' };
const renderPage = () => render(<MemoryRouter><BlogsManagePage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  auth.canManage = true;
  blogService.default.adminGetPosts.mockResolvedValue({ data: [post], meta: { total: 1 } });
  blogService.default.adminUpdatePost.mockResolvedValue({ data: { ...post, status: 'draft' } });
});

describe('blog status control', () => {
  it('lets authorized staff change a post status from the posts list', async () => {
    renderPage();
    const status = await screen.findByRole('combobox', { name: 'Status for Orbi seeds' });
    fireEvent.mouseDown(status);
    fireEvent.click(await screen.findByRole('option', { name: 'Draft' }));

    await waitFor(() => expect(blogService.default.adminUpdatePost).toHaveBeenCalledWith('post-1', { status: 'draft' }));
    expect(await screen.findByRole('combobox', { name: 'Status for Orbi seeds' })).toHaveTextContent('draft');
    expect(notify).toHaveBeenCalledWith('Blog post status updated to draft.', 'success');
  });

  it('keeps the saved status and reports an error when the update fails', async () => {
    blogService.default.adminUpdatePost.mockRejectedValueOnce(new Error('No access'));
    renderPage();
    const status = await screen.findByRole('combobox', { name: 'Status for Orbi seeds' });
    fireEvent.mouseDown(status);
    fireEvent.click(await screen.findByRole('option', { name: 'Draft' }));

    await waitFor(() => expect(notify).toHaveBeenCalledWith('No access', 'error'));
    expect(await screen.findByRole('combobox', { name: 'Status for Orbi seeds' })).toHaveTextContent('published');
  });

  it('updates the displayed date when publishing returns a publication date', async () => {
    const draft = { ...post, status: 'draft', publishedAt: null };
    const publishedAt = '2026-10-31T10:00:00.000Z';
    blogService.default.adminGetPosts.mockResolvedValueOnce({ data: [draft], meta: { total: 1 } });
    blogService.default.adminUpdatePost.mockResolvedValueOnce({ data: { ...draft, status: 'published', publishedAt } });
    renderPage();

    const status = await screen.findByRole('combobox', { name: 'Status for Orbi seeds' });
    fireEvent.mouseDown(status);
    fireEvent.click(await screen.findByRole('option', { name: 'Published' }));

    await waitFor(() => expect(screen.getByText(new Date(publishedAt).toLocaleDateString())).toBeInTheDocument());
  });
});
