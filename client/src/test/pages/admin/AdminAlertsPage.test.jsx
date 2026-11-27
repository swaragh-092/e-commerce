import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import InternalAlertRules from '../../../pages/admin/InternalAlertRules';
import AdminAlertsPage from '../../../pages/admin/AdminAlertsPage';
import AdminAlertBell from '../../../components/admin/AdminAlertBell';
import { adminAlerts } from '../../../services/adminAlerts';

vi.mock('../../../services/adminAlerts', () => ({
  adminAlerts: { inbox: vi.fn(), mark: vi.fn(), markAll: vi.fn(), preferences: vi.fn(), savePreferences: vi.fn(), rules: vi.fn(), setInboxEnabled: vi.fn(), setEmailEnabled: vi.fn() },
  refreshAdminAlerts: () => window.dispatchEvent(new Event('admin-alerts-changed')),
}));

beforeEach(() => vi.resetAllMocks());

it('updates the inbox and navigation badge when an alert is read', async () => {
  let read = false;
  adminAlerts.inbox.mockImplementation(async () => ({
    enabled: true, unread: read ? 0 : 1, total: 1,
    items: [{ id: '1', read_at: read ? '2026-11-27T00:00:00Z' : null, created_at: '2026-11-27T00:00:00Z',
      message: { title: 'Order assigned', body: 'A new order is ready.', link: '/admin/orders/1', linkLabel: 'Open order' } }],
  }));
  adminAlerts.mark.mockImplementation(async () => { read = true; });

  render(<MemoryRouter initialEntries={['/admin/notifications']}><AdminAlertBell /><AdminAlertsPage /></MemoryRouter>);
  expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open order' })).toHaveAttribute('href', '/admin/orders/1');
  fireEvent.click(screen.getByRole('button', { name: 'Mark as read' }));
  await waitFor(() => expect(adminAlerts.mark).toHaveBeenCalledWith('1', true));
  expect(await screen.findByRole('button', { name: 'Notifications, 0 unread' })).toBeInTheDocument();
});

it('shows required inbox alerts as locked and saves personal email quiet hours', async () => {
  adminAlerts.preferences.mockResolvedValue({
    canEmail: true, emailPaused: false, preferences: { events: {}, quiet: null },
    events: [{ key: 'staff_access', label: 'Staff access changed', required: true, in_app: true, email: false }],
  });
  adminAlerts.savePreferences.mockResolvedValue({});
  render(<MemoryRouter initialEntries={['/admin/notifications/preferences']}><AdminAlertsPage /></MemoryRouter>);
  expect(await screen.findByText('Required by a notification rule')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Email quiet hours' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'IANA time zone' }), { target: { value: 'Asia/Kolkata' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save preferences' }));
  await waitFor(() => expect(adminAlerts.savePreferences).toHaveBeenCalledWith({
    events: {}, quiet: { start: '22:00', end: '07:00', zone: 'Asia/Kolkata' },
  }));
});

it('lets notification managers enable a disabled inbox and refreshes the bell', async () => {
  const initial = { manage: true, inboxEnabled: false, inboxAvailable: false, rules: [] };
  adminAlerts.rules.mockResolvedValueOnce(initial).mockResolvedValueOnce({
    ...initial, inboxEnabled: true, inboxAvailable: true, events: {}, emailEnabled: false,
  });
  adminAlerts.setInboxEnabled.mockResolvedValue({ enabled: true });
  const refresh = vi.fn();
  window.addEventListener('admin-alerts-changed', refresh, { once: true });
  render(<MemoryRouter><InternalAlertRules /></MemoryRouter>);
  const toggle = await screen.findByRole('switch', { name: 'Enable admin notification inbox' });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  await waitFor(() => expect(adminAlerts.setInboxEnabled).toHaveBeenCalledWith(true));
  await waitFor(() => expect(toggle).toBeChecked());
  expect(refresh).toHaveBeenCalledOnce();
  expect(screen.getByText('Internal email is off.')).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Enable internal email' })).not.toBeChecked();
});

it('keeps a draft when switching between routing and message', async () => {
  adminAlerts.rules.mockResolvedValue({
    manage: true, inboxEnabled: true, inboxAvailable: true, emailEnabled: false,
    events: { order_status: { label: 'Order status changed', audience: ['participant'], fields: ['status'] } },
    staff: [], roles: [],
    rules: [{ id: 'rule-1', version: 1, event: 'order_status', config: {
      name: 'Order updates', enabled: true, conditions: {}, audience: ['participant'], channels: ['in_app'],
      inAppDefault: true, emailDefault: false, urgent: false, required: false, title: 'Order updated',
      body: 'The order changed.', subject: 'Order updated', summary: 'The order changed.', linkLabel: 'Open order',
    } }],
  });
  render(<MemoryRouter><InternalAlertRules /></MemoryRouter>);
  const ruleName = await screen.findByRole('textbox', { name: 'Rule name' });
  expect(screen.getByRole('button', { name: 'Publish rule' })).toBeDisabled();
  fireEvent.change(ruleName, { target: { value: 'Shipping updates' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Message' }));
  expect(await screen.findByRole('textbox', { name: 'Inbox title' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Routing' }));
  expect(screen.getByRole('textbox', { name: 'Rule name' })).toHaveValue('Shipping updates');
  expect(screen.getByRole('button', { name: 'Publish rule' })).toBeEnabled();
});

it('turns on internal email independently of the inbox', async () => {
  const inactive = { manage: true, inboxEnabled: false, inboxAvailable: false, emailEnabled: false, rules: [] };
  adminAlerts.rules.mockResolvedValueOnce(inactive).mockResolvedValueOnce({ ...inactive, emailEnabled: true });
  adminAlerts.setEmailEnabled.mockResolvedValue({ enabled: true });
  render(<MemoryRouter><InternalAlertRules /></MemoryRouter>);
  const toggle = await screen.findByRole('switch', { name: 'Enable internal email' });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toBeChecked());
  expect(adminAlerts.setEmailEnabled).toHaveBeenCalledWith(true);
  expect(adminAlerts.setInboxEnabled).not.toHaveBeenCalled();
});
