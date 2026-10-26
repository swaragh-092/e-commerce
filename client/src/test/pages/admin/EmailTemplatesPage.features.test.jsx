import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmailTemplatesPage from '../../../pages/admin/EmailTemplatesPage';

const state = vi.hoisted(() => ({ features: {}, templates: [] }));
vi.mock('../../../hooks/useSettings', () => ({ useSettings: () => ({ features: state.features }) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => true }) }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify: vi.fn(), confirm: vi.fn() }) }));
vi.mock('../../../services/adminService', () => ({
  getEmailTemplates: vi.fn(async () => ({ data: { data: state.templates } })),
  updateEmailTemplate: vi.fn(), previewEmailTemplate: vi.fn(), resetEmailTemplate: vi.fn(),
  getEmailTemplateDefault: vi.fn(), sendTestNotification: vi.fn(),
}));

const catalog = { orders: false, payments: false, shipping: false, cart: false, enquiry: true, newsletter: true };
const ecommerce = { orders: true, payments: true, shipping: true, cart: true, enquiry: false, newsletter: true };

beforeEach(() => {
  state.features = catalog;
  state.templates = ['email', 'sms', 'whatsapp'].flatMap(channel => [
    'admin_new_order', 'new_enquiry_admin', 'welcome', 'payment_failed_customer',
    'order_shipped', 'inventory_alert_digest', 'newsletter_campaign',
  ].map(name => ({ name, channel, subject: `${name}-${channel}`, bodyHtml: `<p>${name}</p>`, bodyText: name, isActive: true, variables: [] })));
});

describe('Templates follow the resolved store capabilities', () => {
  it.each(['Email', 'SMS', 'WhatsApp'])('filters %s templates and replaces the editor selection after mode changes', async (channel) => {
    const { rerender } = render(<EmailTemplatesPage />);
    await screen.findByPlaceholderText('Search templates…');
    fireEvent.click(screen.getByRole('tab', { name: new RegExp(channel) }));
    if (channel !== 'Email') {
      expect(screen.getByRole('tab', { name: 'Message Body' })).toHaveAttribute('aria-selected', 'true');
    }
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Subject Line' })).toHaveValue(`new_enquiry_admin-${channel.toLowerCase()}`));
    for (const label of ['New Order Received', 'Payment Failed', 'Order Shipped', 'Inventory Alert Digest']) {
      expect(screen.queryByText(label, { exact: true })).not.toBeInTheDocument();
    }
    expect(screen.getByText('Welcome', { exact: true })).toBeInTheDocument();

    state.features = ecommerce;
    rerender(<EmailTemplatesPage />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Subject Line' })).toHaveValue(`admin_new_order-${channel.toLowerCase()}`));
    expect(screen.queryByText('New Enquiry — Staff', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText('Order Shipped', { exact: true })).toBeInTheDocument();

    state.features = catalog;
    rerender(<EmailTemplatesPage />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Subject Line' })).toHaveValue(`new_enquiry_admin-${channel.toLowerCase()}`));
    expect(screen.queryByText('New Order Received', { exact: true })).not.toBeInTheDocument();
  });
});
