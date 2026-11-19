import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationEventsPage from '../../../pages/admin/NotificationEventsPage';
import { notificationService } from '../../../services/notificationService';

const state = vi.hoisted(() => ({ canEdit: true }));
vi.mock('../../../hooks/useSettings', () => ({ useSettings: () => ({ features: { enquiry: false, orders: false, newsletter: false } }) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => state.canEdit }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true) }) }));
vi.mock('../../../services/notificationService', () => ({ notificationService: {
  events: vi.fn(), options: vi.fn(), read: vi.fn(), save: vi.fn(), preview: vi.fn(), test: vi.fn(), history: vi.fn(),
} }));
vi.mock('../../../services/adminService', () => ({
  getEmailTemplates: vi.fn(async () => ({ data: { data: [
    { name: 'contact_form_admin', channel: 'email', subject: 'Contact alert', bodyHtml: '<p>{{contact_message}}</p>', bodyText: '{{contact_message}}', isActive: true },
    { name: 'welcome', channel: 'email', subject: 'Welcome subject', bodyHtml: '<p>Welcome</p>', bodyText: 'Welcome', isActive: true },
  ] } })),
  updateEmailTemplate: vi.fn(), previewEmailTemplate: vi.fn(), resetEmailTemplate: vi.fn(), getEmailTemplateDefault: vi.fn(), sendTestNotification: vi.fn(),
}));
const event = { key: 'contact_form_submitted', label: 'Contact form submitted', group: 'Contact', description: 'When a visitor submits the public website contact form.',
  customerTemplate: null, internalTemplate: 'contact_form_admin', variables: ['contact_name', 'contact_email', 'contact_phone', 'contact_message', 'recipient_name'] };
const initial = () => ({ event, managed: true, revision: 'revision-1', rules: [{ id: 'contact-rule', name: 'Contact form message', audience: 'internal', isActive: true, channels: ['email'],
  recipients: { defaultAdmins: true, userIds: [], roleIds: [], contacts: [] },
  messages: { email: { subject: 'Contact from {{contact_name}}', bodyHtml: '', bodyText: '{{contact_message}}' }, sms: { subject: '', bodyHtml: '', bodyText: '' }, whatsapp: { subject: '', bodyHtml: '', bodyText: '' } },
}] });
beforeEach(() => {
  vi.clearAllMocks(); state.canEdit = true;
  notificationService.events.mockResolvedValue([event]);
  notificationService.options.mockResolvedValue({ users: [], roles: [], channelEnabled: { email: true } });
  notificationService.read.mockImplementation(async () => initial());
  notificationService.save.mockImplementation(async (_, input) => ({ ...initial(), revision: 'revision-2', rules: input.rules }));
  notificationService.history.mockResolvedValue([{ id: 'delivery', name: 'Website contact alert', status: 'sent', recipient: 'team@example.test', channel: 'email', createdAt: '2026-11-03T10:00:00Z' }]);
});

describe('Contact form uses the shared event notification interface', () => {
  it('offers standard recipients, content and active controls even when product enquiries are disabled', async () => {
    render(<NotificationEventsPage />);
    await screen.findByRole('textbox', { name: 'Notification name' });
    expect(screen.getByRole('heading', { name: 'Contact form submitted' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Store administrators' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Customer involved in this event' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Add different message' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Email subject' }), { target: { value: 'New contact message' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Active', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() => expect(notificationService.save).toHaveBeenCalledWith(event.key, expect.objectContaining({ rules: [expect.objectContaining({
      isActive: false, audience: 'internal', messages: expect.objectContaining({ email: expect.objectContaining({ subject: 'New contact message' }) }),
    })] })));
  });

  it('shows contact delivery history through the same event history control', async () => {
    render(<NotificationEventsPage />);
    await screen.findByRole('textbox', { name: 'Notification name' });
    fireEvent.click(screen.getByRole('tab', { name: 'Delivery history' }));
    await screen.findByText(/team@example.test/);
    expect(notificationService.history).toHaveBeenCalledWith(event.key);
    expect(screen.getByText('sent')).toBeInTheDocument();
  });

  it('excludes contact mail from account and system templates', async () => {
    render(<NotificationEventsPage />);
    await screen.findByRole('textbox', { name: 'Notification name' });
    fireEvent.click(screen.getByRole('tab', { name: 'Account & system templates' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Subject Line' })).toHaveValue('Welcome subject'));
    expect(screen.queryByText('contact_form_admin', { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText('Contact form recipients', { exact: true })).not.toBeInTheDocument();
  });

  it('keeps contact rules read-only without notification management permission', async () => {
    state.canEdit = false;
    render(<NotificationEventsPage />);
    const field = await screen.findByRole('textbox', { name: 'Notification name' });
    expect(field).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save event' })).not.toBeInTheDocument();
  });
});
