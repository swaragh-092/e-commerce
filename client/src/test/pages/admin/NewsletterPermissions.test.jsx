import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NewsletterSubscribersPage from '../../../pages/admin/NewsletterSubscribersPage';
import api from '../../../services/api';
const { grants, notify, confirm } = vi.hoisted(() => ({ grants: new Set(), notify: vi.fn(), confirm: vi.fn() }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: (key) => grants.has(key) }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify, confirm }) }));
vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks(); grants.clear();
  api.get.mockImplementation(async (url) => ({ data: { data: url === '/newsletter'
    ? { subscribers: [{ id: 's1', email: 'subscriber@example.test', status: 'active' }], total: 1 }
    : [{ id: 'c1', subject: 'Draft', message: 'Hello', status: 'draft', delivery: {}, recipientCount: 0 }] } }));
});

describe('Newsletter permission boundaries', () => {
  it('campaign readers never request or see subscriber emails or write actions', async () => {
    grants.add('newsletter.read');
    render(<NewsletterSubscribersPage />);
    await screen.findByText('Draft');
    expect(api.get).not.toHaveBeenCalledWith('/newsletter', expect.anything());
    expect(screen.queryByText('subscriber@example.test')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export CSV' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
  });
  it('subscriber viewers do not fetch campaign drafts', async () => {
    grants.add('newsletter.subscribers_read');
    render(<NewsletterSubscribersPage />);
    await screen.findByText('subscriber@example.test');
    expect(api.get).not.toHaveBeenCalledWith('/newsletter/campaigns');
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeEnabled();
  });
  it('closes scheduling and clears subscriber data on active-session revocation', async () => {
    ['newsletter.read', 'newsletter.manage', 'newsletter.subscribers_read'].forEach((key) => grants.add(key));
    const { rerender } = render(<NewsletterSubscribersPage />);
    await screen.findByText('Draft'); await screen.findByText('subscriber@example.test');
    fireEvent.click(screen.getByRole('button', { name: 'Schedule', exact: true }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    grants.delete('newsletter.manage'); grants.delete('newsletter.subscribers_read');
    rerender(<NewsletterSubscribersPage />);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByText('subscriber@example.test')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
  it('rechecks permission after a send confirmation resolves', async () => {
    grants.add('newsletter.read'); grants.add('newsletter.manage');
    let finish;
    confirm.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const { rerender } = render(<NewsletterSubscribersPage />);
    await screen.findByText('Draft');
    fireEvent.click(screen.getByRole('button', { name: 'Send now' }));
    grants.delete('newsletter.manage'); rerender(<NewsletterSubscribersPage />);
    finish(true);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Send now' })).not.toBeInTheDocument());
    expect(api.post).not.toHaveBeenCalled();
  });
});
