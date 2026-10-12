import { afterEach, describe, expect, it, vi } from 'vitest';

const { User, Setting, NotificationTemplate, NotificationQueue } = require('../../src/modules');
const recipients = require('../../src/modules/notification/notificationRecipients.service');
const settings = require('../../src/modules/settings/settings.service');

const makeUser = (id, permissions) => ({ id, email: `${id}@example.test`, firstName: id, toJSON: () => ({ permissions }) });

afterEach(() => vi.restoreAllMocks());

describe('Notification recipient permissions and routing', () => {
  it('uses the existing defaults when the category has no explicit configuration', async () => {
    vi.spyOn(Setting, 'findOne').mockResolvedValue(null);
    expect(await recipients.getConfiguredRecipients('admin_new_order')).toBeNull();
  });

  it('preserves an explicitly empty recipient list instead of falling back to admins', async () => {
    vi.spyOn(Setting, 'findOne').mockResolvedValue({ value: { orders: [] } });
    vi.spyOn(User, 'findAll').mockResolvedValue([makeUser('staff', ['orders.read'])]);
    expect(await recipients.getConfiguredRecipients('admin_new_order')).toEqual([]);
  });

  it('filters out selected staff who have lost the required event permissions', async () => {
    const orderStaff = makeUser('orders', ['orders.read']);
    vi.spyOn(Setting, 'findOne').mockResolvedValue({ value: { orders: ['orders', 'support'] } });
    vi.spyOn(User, 'findAll').mockResolvedValue([orderStaff, makeUser('support', ['enquiries.read'])]);
    expect(await recipients.getConfiguredRecipients('admin_new_order')).toEqual([orderStaff]);
    expect(User.findAll).toHaveBeenCalledWith(expect.objectContaining({ where: { status: 'active', emailVerified: true } }));
  });

  it('rejects assigning enquiry-only staff to payment alerts without persisting changes', async () => {
    vi.spyOn(User, 'findAll').mockResolvedValue([makeUser('support', ['enquiries.read'])]);
    const save = vi.spyOn(settings, 'updateKey');
    await expect(recipients.update({ payments: ['support'] }, { id: 'admin' })).rejects.toMatchObject({ statusCode: 400 });
    expect(save).not.toHaveBeenCalled();
  });

  it('passes the order transaction through to recipient lookups', async () => {
    const transaction = { id: 'order-transaction' };
    vi.spyOn(Setting, 'findOne').mockResolvedValue({ value: { returns: [] } });
    vi.spyOn(User, 'findAll').mockResolvedValue([]);
    await recipients.getConfiguredRecipients('admin_return_requested', transaction);
    expect(Setting.findOne).toHaveBeenCalledWith(expect.objectContaining({ transaction }));
    expect(User.findAll).toHaveBeenCalledWith(expect.objectContaining({ transaction }));
  });

  it('hides recipient selections from the ordinary settings payload', async () => {
    vi.spyOn(Setting, 'findAll').mockResolvedValue([{ key: 'eventRecipientUserIds', value: { orders: ['staff'] } }, { key: 'emailEnabled', value: true }]);
    const result = await settings.getByGroup('messaging');
    expect(result.eventRecipientUserIds).toBeUndefined();
    expect(result.emailEnabled).toBe(true);
  });

  it('blocks changes through the generic settings API without notification permission', async () => {
    await expect(settings.updateKey('eventRecipientUserIds', {}, 'messaging', 'settings-editor', { permissions: ['settings.manage'] })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('applies the email selection while keeping SMS recipients on the existing defaults', async () => {
    const staff = { ...makeUser('staff', ['orders.read']), profile: { phone: '+10000000001' } };
    vi.spyOn(Setting, 'findOne').mockResolvedValue({ value: { orders: ['staff'] } });
    vi.spyOn(User, 'findAll').mockResolvedValueOnce([staff]).mockResolvedValueOnce([{ id: 'admin', email: 'admin@example.test', profile: { phone: '+10000000002' } }]);
    vi.spyOn(NotificationTemplate, 'findOne').mockResolvedValue({ isActive: true });
    const queue = vi.spyOn(NotificationQueue, 'create').mockResolvedValue({});
    await require('../../src/modules/notification/notification.service').sendToAdmins('admin_new_order', ['email', 'sms']);
    const queuedJobs = queue.mock.calls.map(([job]) => job);
    expect(queuedJobs).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: 'email', recipientEmail: 'staff@example.test' }),
      expect.objectContaining({ channel: 'sms', recipientPhone: '+10000000002' }),
    ]));
    expect(queuedJobs.some((job) => job.recipientPhone === '+10000000001')).toBe(false);
    expect(queuedJobs.filter((job) => job.channel === 'email')).toHaveLength(1);
  });
});
