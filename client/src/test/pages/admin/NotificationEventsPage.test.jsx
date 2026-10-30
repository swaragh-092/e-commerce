import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationEventsPage from '../../../pages/admin/NotificationEventsPage';
import { notificationService } from '../../../services/notificationService';

const auth = vi.hoisted(() => ({ editable: true }));
const settings = vi.hoisted(() => ({ features: null }));
const { notify, confirm } = vi.hoisted(() => ({ notify: vi.fn(), confirm: vi.fn().mockResolvedValue(true) }));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ hasPermission: () => auth.editable }) }));
vi.mock('../../../hooks/useSettings', () => ({ useSettings: () => settings }));
vi.mock('../../../context/NotificationContext', () => ({ useNotification: () => ({ notify, confirm }) }));
vi.mock('../../../pages/admin/EmailTemplatesPage', () => ({ default: () => <h2>Account & system templates</h2> }));
vi.mock('../../../services/notificationService', () => ({ notificationService: {
  events: vi.fn(), options: vi.fn(), read: vi.fn(), save: vi.fn(), preview: vi.fn(), test: vi.fn(), history: vi.fn(),
} }));
const events = [
  { key: 'order_placed', label: 'Order placed', group: 'Orders', description: 'When an order is placed.', customerTemplate: 'order_placed', internalTemplate: 'admin_new_order', variables: ['customer_name', 'order_number'] },
  { key: 'order_shipped', label: 'Order shipped', group: 'Orders', description: 'When an order ships.', customerTemplate: 'order_shipped', variables: ['order_number'] },
];
const recipients = { defaultAdmins: false, userIds: [], roleIds: [], contacts: [] };
const messages = { email: { subject: 'Thanks {{customer_name}}', bodyHtml: '', bodyText: 'We received your order.' }, sms: { subject: '', bodyHtml: '', bodyText: 'Order received' }, whatsapp: { subject: '', bodyHtml: '', bodyText: 'Thank you' } };
const rule = { id: 'rule-customer', name: 'Customer confirmation', audience: 'customer', isActive: true, channels: ['email'], recipients, messages };
const data = event => ({ event, managed: false, revision: null, rules: [structuredClone(rule)] });
const ready = async () => { await screen.findByRole('textbox', { name: 'Notification name' }); };

beforeEach(() => {
  vi.clearAllMocks(); auth.editable = true;
  settings.features = { orders: true, shipping: true, payments: true, enquiry: true };
  notificationService.events.mockResolvedValue(events);
  notificationService.options.mockResolvedValue({ users: [{ id: 'person-1', name: 'Alex', email: 'alex@example.test', roleIds: ['role-1'] }], roles: [{ id: 'role-1', name: 'Warehouse' }] });
  notificationService.read.mockImplementation(async key => data(events.find(event => event.key === key)));
  notificationService.save.mockImplementation(async (key, input) => ({ ...data(events.find(event => event.key === key)), managed: true, revision: 'revision-2', rules: input.rules }));
  notificationService.preview.mockResolvedValue({ subject: 'Thanks Jane', html: '', text: 'We received your order.' });
  notificationService.test.mockResolvedValue({ sent: true });
  notificationService.history.mockResolvedValue([]);
});

const capabilityEvents = [
  ...events,
  { key: 'order_cancelled', label: 'Order cancelled', group: 'Orders', customerTemplate: 'order_cancelled', internalTemplate: 'admin_order_cancelled', variables: [] },
  { key: 'order_refunded', label: 'Order refunded', group: 'Payments', customerTemplate: 'order_refunded', variables: [] },
  { key: 'payment_failed', label: 'Payment failed', group: 'Payments', customerTemplate: 'payment_failed_customer', internalTemplate: 'admin_order_failed', variables: [] },
  { key: 'return_requested', label: 'Return requested', group: 'Returns', customerTemplate: 'return_requested', internalTemplate: 'admin_return_requested', variables: [] },
  { key: 'enquiry_received', label: 'Enquiry received', group: 'Enquiries', customerTemplate: 'new_enquiry_customer', internalTemplate: 'new_enquiry_admin', variables: [] },
  { key: 'enquiry_replied', label: 'Enquiry replied', group: 'Enquiries', customerTemplate: 'enquiry_reply_customer', variables: [] },
];
const catalogFeatures = { orders: false, shipping: false, payments: false, enquiry: true };
const loadCapabilityEvents = () => {
  notificationService.events.mockResolvedValue(capabilityEvents);
  notificationService.read.mockImplementation(async key => data(capabilityEvents.find(event => event.key === key)));
};

describe('Event notification feature filtering', () => {
  it('shows only enquiry events in catalog mode in the list and mobile selector', async () => {
    settings.features = catalogFeatures;
    loadCapabilityEvents();
    render(<NotificationEventsPage />); await ready();
    expect(screen.getByRole('heading', { name: 'Enquiry received' })).toBeInTheDocument();
    for (const event of capabilityEvents.filter(event => event.group !== 'Enquiries')) {
      expect(screen.queryByLabelText(event.label)).not.toBeInTheDocument();
    }
    expect(notificationService.read.mock.calls.map(([key]) => key)).toEqual(['enquiry_received']);
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Notification event' }));
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Enquiry received', 'Enquiry replied']);
    fireEvent.click(screen.getByRole('option', { name: 'Enquiry replied' }));
    expect(await screen.findByRole('heading', { name: 'Enquiry replied' })).toBeInTheDocument();
  });

  it('uses each resolved capability to hide shipping, payment and enquiry events independently', async () => {
    settings.features = { orders: true, shipping: false, payments: false, enquiry: false };
    loadCapabilityEvents();
    render(<NotificationEventsPage />); await ready();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Notification event' }));
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Order placed', 'Order cancelled', 'Return requested']);
  });

  it('switches away from disabled events while preserving their unsaved drafts', async () => {
    loadCapabilityEvents();
    const { rerender } = render(<NotificationEventsPage />); await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Email subject' }), { target: { value: 'Keep my order draft' } });
    settings.features = catalogFeatures;
    rerender(<NotificationEventsPage />);
    expect(await screen.findByRole('heading', { name: 'Enquiry received' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Order placed' })).not.toBeInTheDocument();
    settings.features = { orders: true, shipping: true, payments: true, enquiry: false };
    rerender(<NotificationEventsPage />);
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Email subject' })).toHaveValue('Keep my order draft'));
    expect(notificationService.save).not.toHaveBeenCalled();
  });

  it('waits for settings before selecting or loading an event', async () => {
    settings.features = null;
    loadCapabilityEvents();
    const { rerender } = render(<NotificationEventsPage />);
    await waitFor(() => expect(notificationService.events).toHaveBeenCalled());
    expect(notificationService.read).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Loading notifications')).toBeInTheDocument();
    settings.features = catalogFeatures;
    rerender(<NotificationEventsPage />); await ready();
    expect(notificationService.read.mock.calls.map(([key]) => key)).toEqual(['enquiry_received']);
  });

  it('explains when no events are enabled and keeps account templates accessible', async () => {
    settings.features = { orders: false, shipping: false, payments: false, enquiry: false };
    loadCapabilityEvents();
    render(<NotificationEventsPage />);
    expect(await screen.findByText('No event notifications are available for the enabled store features.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Notification event' })).not.toBeInTheDocument();
    expect(notificationService.read).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Account & system templates' }));
    expect(await screen.findByRole('heading', { name: 'Account & system templates' })).toBeInTheDocument();
  });

  it('ignores a pending response for an event disabled by a settings change', async () => {
    loadCapabilityEvents();
    let finishOrder;
    notificationService.read.mockImplementation(key => key === 'order_placed'
      ? new Promise(resolve => { finishOrder = resolve; })
      : Promise.resolve(data(capabilityEvents.find(event => event.key === key))));
    const { rerender } = render(<NotificationEventsPage />);
    await waitFor(() => expect(notificationService.read).toHaveBeenCalledWith('order_placed'));
    settings.features = catalogFeatures;
    rerender(<NotificationEventsPage />); await ready();
    finishOrder(data(events[0]));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Enquiry received' })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'Order placed' })).not.toBeInTheDocument();
  });
});

describe('Event notification configuration', () => {
  it.each([true, false])('saves and reloads the customer enquiry acknowledgement as %s without changing staff alerts', async enabled => {
    const event = capabilityEvents.find(event => event.key === 'enquiry_received');
    let saved = { ...data(event), rules: [
      { ...structuredClone(rule), name: 'Customer acknowledgement', isActive: !enabled },
      { ...structuredClone(rule), id: 'rule-staff', name: 'Admin alert', audience: 'internal',
        recipients: { ...recipients, userIds: ['person-1'] } },
    ] };
    notificationService.events.mockResolvedValue([event]);
    notificationService.read.mockImplementation(async () => structuredClone(saved));
    notificationService.save.mockImplementation(async (_, input) => {
      saved = { event, managed: true, revision: 'revision-2', rules: structuredClone(input.rules) };
      return structuredClone(saved);
    });
    render(<NotificationEventsPage />); await ready();
    expect(screen.getByRole('textbox', { name: 'Notification name' })).toHaveValue('Customer acknowledgement');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Active', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() => expect(notificationService.save).toHaveBeenCalledWith('enquiry_received', expect.objectContaining({ rules: [
      expect.objectContaining({ audience: 'customer', name: 'Customer acknowledgement', isActive: enabled, channels: ['email'] }),
      expect.objectContaining({ audience: 'internal', name: 'Admin alert', isActive: true, recipients: expect.objectContaining({ userIds: ['person-1'] }) }),
    ] })));
    await screen.findByText('Configured');
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    await waitFor(() => expect(notificationService.read).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Active', exact: true })).toHaveProperty('checked', enabled));
  });

  it('shows the involved customer explicitly and saves that audience without selecting other customers', async () => {
    render(<NotificationEventsPage />); await ready();
    expect(screen.getByRole('checkbox', { name: 'Customer involved in this event' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Specific people' })).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Email subject' }), { target: { value: 'Your order confirmation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() => expect(notificationService.save).toHaveBeenCalledWith('order_placed', expect.objectContaining({ rules: [expect.objectContaining({ audience: 'customer', recipients, messages: expect.objectContaining({ email: expect.objectContaining({ subject: 'Your order confirmation' }) }) })] })));
    expect(await screen.findByText('Configured')).toBeInTheDocument();
  });

  it('creates a separate notification for people, a role, and a contact with independent content', async () => {
    render(<NotificationEventsPage />); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Add different message' }));
    const name = await screen.findByRole('textbox', { name: 'Notification name' });
    fireEvent.change(name, { target: { value: 'Packing instructions' } });
    const person = screen.getByRole('combobox', { name: 'Specific people' });
    fireEvent.change(person, { target: { value: 'Alex' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Alex (alex@example.test)' }));
    const roles = screen.getByRole('combobox', { name: 'Roles' });
    fireEvent.change(roles, { target: { value: 'Warehouse' } });
    fireEvent.click(await screen.findByRole('option', { name: 'Warehouse' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add another contact' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Contact name 1' }), { target: { value: 'Partner' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Email address 1' }), { target: { value: 'partner@example.test' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Email subject' }), { target: { value: 'Prepare this order' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Pack the items for {{order_number}}.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() => expect(notificationService.save).toHaveBeenCalled());
    const saved = notificationService.save.mock.calls[0][1].rules;
    expect(saved).toHaveLength(2);
    expect(saved[0].audience).toBe('customer');
    expect(saved[0].messages.email.bodyText).toBe('We received your order.');
    expect(saved[1]).toMatchObject({ audience: 'internal', name: 'Packing instructions', recipients: { userIds: ['person-1'], roleIds: ['role-1'], contacts: [{ name: 'Partner', email: 'partner@example.test', phone: '' }] }, messages: { email: { bodyText: 'Pack the items for {{order_number}}.' } } });
  });

  it('keeps unsaved drafts when switching between events', async () => {
    render(<NotificationEventsPage />); await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Email subject' }), { target: { value: 'Unsaved subject' } });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Notification event' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Order shipped' }));
    await screen.findByRole('heading', { name: 'Order shipped' });
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Notification event' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Order placed' }));
    expect(await screen.findByRole('textbox', { name: 'Email subject' })).toHaveValue('Unsaved subject');
  });

  it('previews and tests the current draft without saving or using real recipients', async () => {
    render(<NotificationEventsPage />); await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Draft message' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview message' }));
    expect(await screen.findByRole('dialog', { name: 'Message preview' })).toBeInTheDocument();
    await waitFor(() => expect(notificationService.preview).toHaveBeenCalledWith('order_placed', expect.objectContaining({ bodyText: 'Draft message' })));
    await waitFor(() => expect(screen.queryByLabelText('Rendering preview')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(await screen.findByRole('button', { name: 'Send a test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send a test message' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Test email address' }), { target: { value: 'test@example.test' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send test message' }));
    await waitFor(() => expect(notificationService.test).toHaveBeenCalledWith('order_placed', { channel: 'email', recipient: 'test@example.test', message: expect.objectContaining({ bodyText: 'Draft message' }) }));
    expect(notificationService.save).not.toHaveBeenCalled();
  });

  it('keeps edits when saving fails and displays the actionable error', async () => {
    notificationService.save.mockRejectedValue({ response: { data: { error: { message: 'These notifications were updated by someone else. Reload before saving.' } } } });
    render(<NotificationEventsPage />); await ready();
    fireEvent.change(screen.getByRole('textbox', { name: 'Email subject' }), { target: { value: 'Keep this draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    expect(await screen.findByText(/updated by someone else/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email subject' })).toHaveValue('Keep this draft');
  });

  it('explains development simulation instead of claiming inbox delivery', async () => {
    notificationService.test.mockResolvedValue({ sent: false, simulated: true });
    render(<NotificationEventsPage />); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Send a test' }));
    const dialog = await screen.findByRole('dialog', { name: 'Send a test message' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Test email address' }), { target: { value: 'test@example.test' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send test message' }));
    expect(await within(dialog).findByText(/Test simulated in development/)).toBeInTheDocument();
  });

  it('lets the user close a preview while rendering is pending', async () => {
    notificationService.preview.mockImplementation(() => new Promise(() => {}));
    render(<NotificationEventsPage />); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Preview message' }));
    const dialog = await screen.findByRole('dialog', { name: 'Message preview' });
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('offers a read-only view when the user cannot manage notifications', async () => {
    auth.editable = false;
    render(<NotificationEventsPage />); await ready();
    expect(screen.getByRole('textbox', { name: 'Email subject' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save event' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add different message' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send a test' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Preview message' })).toBeEnabled();
  });

  it('loads delivery history only when requested and explains skipped recipients', async () => {
    notificationService.history.mockResolvedValue([{ id: 'delivery-1', name: 'Packing alert', recipient: 'Missing contact details', channel: 'sms', status: 'skipped', error: 'Recipient has no phone number', createdAt: '2026-10-26T10:00:00Z', attempts: 0 }]);
    render(<NotificationEventsPage />); await ready();
    expect(notificationService.history).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Delivery history' }));
    expect(await screen.findByText('Recipient has no phone number')).toBeInTheDocument();
    expect(screen.getByText('Packing alert')).toBeInTheDocument();
    expect(notificationService.history).toHaveBeenCalledWith('order_placed');
  });

  it('combines customer, administrators, people and roles without clearing any selection', async () => {
    notificationService.read.mockResolvedValue({ ...data(events[0]), rules: [{ ...structuredClone(rule), audience: 'internal', recipients: { ...recipients, userIds: ['person-1'], roleIds: ['role-1'] } }] });
    render(<NotificationEventsPage />); await ready();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Customer involved in this event' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Store administrators' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() => expect(notificationService.save).toHaveBeenCalledWith('order_placed', expect.objectContaining({ rules: [expect.objectContaining({ audience: 'mixed', recipients: { ...recipients, defaultAdmins: true, userIds: ['person-1'], roleIds: ['role-1'] } })] })));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Customer involved in this event' }));
    expect(screen.getByRole('checkbox', { name: 'Store administrators' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Specific people' }).closest('.MuiAutocomplete-root')).toHaveTextContent('Alex');
  });

  it('splits a role member into an independent message while keeping the shared message for everyone else', async () => {
    notificationService.read.mockResolvedValue({ ...data(events[0]), rules: [{ ...structuredClone(rule), audience: 'mixed', recipients: { ...recipients, roleIds: ['role-1'] } }] });
    render(<NotificationEventsPage />); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Separate message' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a separate message' });
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Recipient for separate message' }));
    fireEvent.click(await screen.findByRole('option', { name: 'Alex (alex@example.test)' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create message' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'Notification name' })).toHaveValue('Message for Alex (alex@example.test)');
    expect(screen.getByRole('checkbox', { name: 'Customer involved in this event' })).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('We received your order.');
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Alex, please pack this order.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() => expect(notificationService.save).toHaveBeenCalled());
    const saved = notificationService.save.mock.calls[0][1].rules;
    expect(saved[0]).toMatchObject({ audience: 'mixed', separateRuleIds: [saved[1].id], recipients: { roleIds: ['role-1'] } });
    expect(saved[0].messages.email.bodyText).toBe('We received your order.');
    expect(saved[1]).toMatchObject({ audience: 'internal', recipients: { userIds: ['person-1'], roleIds: [] }, messages: { email: { bodyText: 'Alex, please pack this order.' } } });
    fireEvent.click(screen.getByRole('button', { name: /Remove Message for Alex/ }));
    await waitFor(() => expect(screen.queryByText('Message for Alex (alex@example.test)')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() => expect(notificationService.save).toHaveBeenCalledTimes(2));
    expect(notificationService.save.mock.calls[1][1].rules[0].separateRuleIds).toEqual([]);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('return to the shared message') }));
  });

  it('preserves individual versions when separating a broader group and reconnects them when that group is removed', async () => {
    const personal = { ...structuredClone(rule), id: 'alex-message', name: 'Alex instructions', audience: 'internal', recipients: { ...recipients, userIds: ['person-1'] } };
    notificationService.read.mockResolvedValue({ ...data(events[0]), rules: [
      { ...structuredClone(rule), audience: 'mixed', recipients: { ...recipients, roleIds: ['role-1'] }, separateRuleIds: [personal.id] }, personal,
    ] });
    render(<NotificationEventsPage />); await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Separate message' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create a separate message' });
    fireEvent.mouseDown(within(dialog).getByRole('combobox', { name: 'Recipient for separate message' }));
    expect(screen.queryByRole('option', { name: 'Alex (alex@example.test)' })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('option', { name: 'Warehouse (role)' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create message' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() => expect(notificationService.save).toHaveBeenCalled());
    const saved = notificationService.save.mock.calls[0][1].rules;
    expect(saved[2]).toMatchObject({ separateRuleIds: [personal.id], recipients: { roleIds: ['role-1'] } });
    expect(saved[0].separateRuleIds).toEqual([personal.id, saved[2].id]);
    fireEvent.click(screen.getByRole('button', { name: /Remove Message for Warehouse/ }));
    await waitFor(() => expect(screen.queryByText('Message for Warehouse (role)')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Save event' }));
    await waitFor(() => expect(notificationService.save).toHaveBeenCalledTimes(2));
    expect(notificationService.save.mock.calls[1][1].rules.map(item => item.id)).toEqual([rule.id, personal.id]);
    expect(notificationService.save.mock.calls[1][1].rules[0].separateRuleIds).toEqual([personal.id]);
  });
});
