import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { Setting, User, Role, Order, Enquiry, NotificationQueue, NotificationLog, NotificationTemplate, sequelize } = require('../../src/modules');
const routing = require('../../src/modules/notification/notificationRules.service');
const notifications = require('../../src/modules/notification/notification.service');
const settings = require('../../src/modules/settings/settings.service');
const audit = require('../../src/modules/audit/audit.service');
const ids = { buyer: '11111111-1111-4111-8111-111111111111', staff: '22222222-2222-4222-8222-222222222222', role: '33333333-3333-4333-8333-333333333333', rule: '44444444-4444-4444-8444-444444444444' };
const people = [
  { id: ids.staff, firstName: 'Alex', email: 'alex@example.test', role: 'admin', emailVerified: true, profile: { phone: '+15551234567' }, roles: [{ id: ids.role, isActive: true, baseRole: 'admin' }] },
];
const message = text => ({ subject: text, bodyHtml: `<p>${text}</p>`, bodyText: text });
const makeRule = (patch = {}) => ({ id: ids.rule, name: 'Packing alert', audience: 'internal', isActive: true, channels: ['email'],
  recipients: { defaultAdmins: false, userIds: [ids.staff], roleIds: [], contacts: [] },
  messages: { email: message('Internal {{order_number}}'), sms: message('Pack {{order_number}}'), whatsapp: message('Pack {{order_number}}') }, ...patch });
let config;
let jobs;

beforeEach(() => {
  vi.stubEnv('ADMIN_NOTIFICATION_EMAIL', '');
  vi.stubEnv('ADMIN_NOTIFICATION_PHONE', '');
  config = { version: 1, revision: 'revision-1', rules: [makeRule()] };
  jobs = new Map();
  vi.spyOn(Setting, 'findOne').mockImplementation(async ({ where }) => where.key.startsWith(routing.PREFIX) ? { value: config } : null);
  vi.spyOn(User, 'findAll').mockResolvedValue(people);
  vi.spyOn(Role, 'findAll').mockResolvedValue([{ id: ids.role, name: 'Warehouse', slug: 'warehouse' }]);
  vi.spyOn(Order, 'findByPk').mockResolvedValue({ id: 'order-1', userId: ids.buyer, orderNumber: 'ORD-1042', paymentMethod: 'cod',
    total: '100.00', shippingAddressSnapshot: {}, items: [{ snapshotName: 'Seeds', quantity: 2, snapshotPrice: '50.00' }] });
  vi.spyOn(User, 'findByPk').mockResolvedValue({ id: ids.buyer, firstName: 'Jane', email: 'buyer@example.test', profile: { phone: '+15550000000' } });
  vi.spyOn(NotificationQueue, 'findOrCreate').mockImplementation(async ({ where, defaults }) => {
    if (jobs.has(where.dedupeKey)) return [jobs.get(where.dedupeKey), false];
    const job = { ...defaults, dedupeKey: where.dedupeKey };
    jobs.set(where.dedupeKey, job);
    return [job, true];
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('Event notification audiences and independent messages', () => {
  it('combines the customer, people, roles and contacts in one message without duplicates', async () => {
    User.findAll.mockResolvedValue([...people, { id: '66666666-6666-4666-8666-666666666666', firstName: 'Store owner', email: 'owner@example.test', role: 'admin', roles: [{ slug: 'admin', isActive: true, baseRole: 'admin' }] }]);
    config.rules = [makeRule({ audience: 'mixed', recipients: { defaultAdmins: true, userIds: [ids.staff], roleIds: [ids.role],
      contacts: [{ name: 'Partner', email: 'partner@example.test', phone: '' }] } })];
    await expect(routing.validate({ revision: null, rules: config.rules })).resolves.toBeDefined();
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    expect([...jobs.values()].map(job => job.recipientEmail).sort()).toEqual(['alex@example.test', 'buyer@example.test', 'owner@example.test', 'partner@example.test']);
    expect([...jobs.values()].find(job => job.recipientEmail === 'buyer@example.test').variables.__notificationRule.audience).toBe('customer');
  });

  it('gives a role member a separate message and excludes them from the shared message on every channel', async () => {
    const separateId = '55555555-5555-4555-8555-555555555555';
    config.rules = [makeRule({ audience: 'mixed', channels: ['email', 'sms'], separateRuleIds: [separateId],
      recipients: { defaultAdmins: false, userIds: [], roleIds: [ids.role], contacts: [] } }),
    makeRule({ id: separateId, name: 'Alex instructions', messages: { email: message('Only for Alex'), sms: message('Alex'), whatsapp: message('Alex') } })];
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    const queued = [...jobs.values()];
    expect(queued.map(job => job.recipientEmail || job.recipientPhone).sort()).toEqual(['alex@example.test', 'buyer@example.test', '+15550000000'].sort());
    expect(queued.find(job => job.recipientEmail === 'alex@example.test').variables.__notificationRule.message.bodyText).toBe('Only for Alex');
    config.rules[1].isActive = false;
    jobs.clear();
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    expect([...jobs.values()].every(job => job.userId === ids.buyer)).toBe(true);
  });

  it('preserves payment timing independently for both audiences in a combined message', async () => {
    config.rules = [makeRule({ audience: 'mixed' })];
    Order.findByPk.mockResolvedValue({ id: 'order-1', userId: ids.buyer, paymentMethod: 'razorpay' });
    await routing.route({ sourceTemplate: 'admin_new_order', orderId: 'order-1' });
    expect([...jobs.values()].map(job => job.recipientEmail)).toEqual(['alex@example.test']);
    await routing.route({ sourceTemplate: 'order_placed', orderId: 'order-1' });
    expect([...jobs.values()].map(job => job.recipientEmail)).toEqual(['alex@example.test', 'buyer@example.test']);
  });

  it('keeps nested individual content separate when roles overlap or change membership', async () => {
    const groupId = '55555555-5555-4555-8555-555555555555';
    const individualId = '66666666-6666-4666-8666-666666666666';
    config.rules = [makeRule({ audience: 'mixed', separateRuleIds: [groupId, individualId], recipients: { defaultAdmins: false, userIds: [], roleIds: [ids.role], contacts: [] } }),
      makeRule({ id: groupId, separateRuleIds: [individualId], recipients: { defaultAdmins: false, userIds: [], roleIds: [ids.role], contacts: [] } }),
      makeRule({ id: individualId, messages: { email: message('Alex only'), sms: message('Alex'), whatsapp: message('Alex') } })];
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    expect([...jobs.values()].map(job => job.recipientEmail).sort()).toEqual(['alex@example.test', 'buyer@example.test']);
    expect([...jobs.values()].find(job => job.recipientEmail === 'alex@example.test').variables.__notificationRule.ruleId).toBe(individualId);
    jobs.clear();
    User.findAll.mockResolvedValue([{ ...people[0], roles: [] }]);
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    expect([...jobs.values()].find(job => job.recipientEmail === 'alex@example.test').variables.__notificationRule.ruleId).toBe(individualId);
  });

  it('sends different content to the involved customer and selected people without including other customers', async () => {
    config.rules.push(makeRule({ id: '55555555-5555-4555-8555-555555555555', name: 'Customer confirmation', audience: 'customer',
      recipients: { defaultAdmins: false, userIds: [], roleIds: [], contacts: [] }, messages: { email: message('Thank you {{customer_name}}'), sms: message('Thanks'), whatsapp: message('Thanks') } }));
    await notifications.sendToAdmins('admin_new_order', ['email'], { customer_email: 'spoofed@example.test' }, 'order-1');
    const queued = [...jobs.values()];
    expect(queued).toHaveLength(2);
    expect(queued.find(job => job.recipientEmail === 'alex@example.test').variables.__notificationRule.message.bodyText).toBe('Internal {{order_number}}');
    const buyer = queued.find(job => job.recipientEmail === 'buyer@example.test');
    expect(buyer.variables).toMatchObject({ customer_name: 'Jane', customer_email: 'buyer@example.test', order_number: 'ORD-1042', items: [{ name: 'Seeds', quantity: 2 }] });
    expect(buyer.variables.__notificationRule.message.bodyText).toBe('Thank you {{customer_name}}');
    expect(queued.some(job => job.recipientEmail === 'spoofed@example.test')).toBe(false);
    expect(User.findAll.mock.calls[0][0].where.role).toBeDefined();
  });

  it('resolves roles dynamically, supports external contacts, and deduplicates overlapping selections', async () => {
    config.rules[0] = makeRule({ channels: ['email', 'whatsapp'], recipients: { defaultAdmins: false, userIds: [ids.staff], roleIds: [ids.role],
      contacts: [{ name: 'Same Alex', email: 'ALEX@example.test', phone: '+15551234567' }, { name: 'Partner', email: 'partner@example.test', phone: '+15559999999' }] } });
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    expect([...jobs.values()].map(job => job.recipientEmail || job.recipientPhone).sort()).toEqual(['+15551234567', '+15559999999', 'alex@example.test', 'partner@example.test'].sort());
    expect(jobs.size).toBe(4);
    User.findAll.mockResolvedValue([]);
    jobs.clear();
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-2' });
    expect([...jobs.values()].every(job => job.userId === null)).toBe(true);
  });

  it('does not duplicate a configured notification when existing call sites invoke it on multiple channels', async () => {
    await routing.route({ sourceTemplate: 'admin_new_order', orderId: 'order-1' });
    await routing.route({ sourceTemplate: 'admin_new_order', orderId: 'order-1' });
    await routing.route({ sourceTemplate: 'order_placed', orderId: 'order-1' });
    expect(jobs.size).toBe(1);
  });

  it('keeps different shipment and refund occurrences separate', async () => {
    for (const refund_id of ['refund-1', 'refund-2']) await routing.route({ sourceTemplate: 'order_refunded', orderId: 'order-1', variables: { refund_id } });
    expect(jobs.size).toBe(2);
  });

  it('does not queue online customer confirmation before payment succeeds', async () => {
    config.rules = [makeRule({ audience: 'customer', recipients: { defaultAdmins: false, userIds: [], roleIds: [], contacts: [] } })];
    Order.findByPk.mockResolvedValue({ id: 'order-1', userId: ids.buyer, paymentMethod: 'razorpay' });
    await routing.route({ sourceTemplate: 'admin_new_order', orderId: 'order-1' });
    expect(jobs.size).toBe(0);
    await routing.route({ sourceTemplate: 'order_placed', orderId: 'order-1' });
    expect(jobs.size).toBe(1);
  });

  it('does not send new-order internal alerts again when payment completes after an event was configured', async () => {
    expect(await routing.route({ sourceTemplate: 'order_placed', orderId: 'order-1' })).toEqual([]);
    expect(jobs.size).toBe(0);
  });

  it('resolves guest customers from the actual order and records missing phone numbers as skipped', async () => {
    config.rules = [makeRule({ audience: 'customer', channels: ['email', 'sms'], recipients: { defaultAdmins: false, userIds: [], roleIds: [], contacts: [] } })];
    Order.findByPk.mockResolvedValue({ id: 'guest-order', userId: null, paymentMethod: 'cod', shippingAddressSnapshot: { email: 'guest@example.test', firstName: 'Guest' } });
    await routing.route({ sourceTemplate: 'admin_new_order', orderId: 'guest-order' });
    expect([...jobs.values()]).toEqual(expect.arrayContaining([
      expect.objectContaining({ channel: 'email', recipientEmail: 'guest@example.test', userId: null, status: 'queued' }),
      expect.objectContaining({ channel: 'sms', recipientPhone: null, status: 'skipped', error: 'Recipient has no phone number' }),
    ]));
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  it('uses the enquiry owner, never the staff member replying, for customer notifications', async () => {
    config.rules = [makeRule({ audience: 'customer', recipients: { defaultAdmins: false, userIds: [], roleIds: [], contacts: [] } })];
    vi.spyOn(Enquiry, 'findByPk').mockResolvedValue({ id: 'enquiry-1', name: 'Enquirer', email: 'enquirer@example.test', phone: '+15550001111' });
    await notifications.send('enquiry_reply_customer', 'staff@example.test', { enquiry_id: 'enquiry-1' }, ids.staff);
    expect([...jobs.values()][0].recipientEmail).toBe('enquirer@example.test');
    expect([...jobs.values()][0].userId).toBeNull();
  });

  it('honors an explicitly empty configuration and does not fall back to administrators', async () => {
    config.rules = [];
    expect(await notifications.sendToAdmins('admin_new_order', ['email'], {}, 'order-1')).toEqual([]);
    expect(User.findAll).not.toHaveBeenCalled();
    expect(NotificationQueue.findOrCreate).not.toHaveBeenCalled();
  });

  it('continues queueing other recipients when one queue operation fails', async () => {
    config.rules[0].recipients.contacts.push({ name: 'Partner', email: 'partner@example.test', phone: '' });
    NotificationQueue.findOrCreate.mockRejectedValueOnce(new Error('Recipient queue failure'));
    const results = await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    expect(results).toEqual([false, true]);
    expect([...jobs.values()][0].recipientEmail).toBe('partner@example.test');
  });

  it('does not treat a staff custom role with an admin base role as a store administrator', async () => {
    config.rules[0].recipients = { defaultAdmins: true, userIds: [], roleIds: [], contacts: [] };
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    expect(jobs.size).toBe(0);
  });

  it('leaves account verification and password-reset routing untouched', async () => {
    expect(await routing.route({ sourceTemplate: 'password_reset' })).toBeNull();
    expect(await routing.route({ sourceTemplate: 'email_verification' })).toBeNull();
    expect(Setting.findOne).not.toHaveBeenCalled();
  });

  it('propagates the business transaction to configuration, recipient, owner and queue queries', async () => {
    const transaction = { id: 'transaction' };
    await routing.route({ sourceTemplate: 'return_requested', orderId: 'order-1', transaction });
    for (const method of [Setting.findOne, User.findAll, Role.findAll, Order.findByPk, NotificationQueue.findOrCreate]) {
      expect(method.mock.calls.some(args => args[0]?.transaction === transaction || args[1]?.transaction === transaction)).toBe(true);
    }
  });
});

describe('Validation, changes and queued delivery', () => {
  it('imports existing email overrides separately from mobile admin alerts and preserves saved message content', async () => {
    config = null;
    vi.spyOn(require('../../src/modules/notification/notificationRecipients.service'), 'getConfiguredRecipients').mockResolvedValue(people);
    vi.spyOn(NotificationTemplate, 'findAll').mockResolvedValue(['order_placed', 'admin_new_order'].flatMap(name => ['email', 'sms', 'whatsapp'].map(channel => ({ name, channel, isActive: true, ...message('Saved template') }))));
    const result = await routing.read('order_placed');
    expect(result.managed).toBe(false);
    const internal = result.rules.filter(rule => rule.audience === 'internal');
    expect(internal).toHaveLength(2);
    expect(internal[0]).toMatchObject({ channels: ['email'], recipients: { defaultAdmins: false, userIds: [ids.staff] } });
    expect(internal[1]).toMatchObject({ channels: ['sms', 'whatsapp'], recipients: { defaultAdmins: true, userIds: [] } });
    expect(internal[0].messages.email.bodyText).toBe('Saved template');
  });

  it('preserves a disabled customer enquiry acknowledgement when importing defaults', async () => {
    config = null;
    vi.spyOn(require('../../src/modules/notification/notificationRecipients.service'), 'getConfiguredRecipients').mockResolvedValue(null);
    vi.spyOn(settings, 'getByGroup').mockResolvedValue({ enquiryCustomerAcknowledgementEnabled: false });
    vi.spyOn(NotificationTemplate, 'findAll').mockResolvedValue(['new_enquiry_customer', 'new_enquiry_admin'].map(name => ({ name, channel: 'email', isActive: true, ...message('Saved enquiry') })));
    const result = await routing.read('enquiry_received');
    expect(result.rules.find(rule => rule.audience === 'customer').isActive).toBe(false);
  });

  it('reports simulated development tests honestly without calling a real provider', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.spyOn(routing, 'preview').mockResolvedValue({ subject: 'Test', html: '<p>Test</p>', text: 'Test' });
    const dispatch = vi.spyOn(require('../../src/modules/notification/notification.dispatcher'), 'dispatch').mockResolvedValue(true);
    vi.spyOn(require('../../src/modules/notification/channels/email.channel'), 'getSmtpConfig').mockResolvedValue({ user: 'your_email@gmail.com', pass: 'your_app_password_here' });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    await require('../../src/modules/notification/notificationRules.controller').test({ params: { event: 'order_placed' }, body: { channel: 'email', recipient: 'test@example.test', message: message('Test') } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith('email', expect.objectContaining({ to: 'test@example.test' }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { sent: false, simulated: true } }));
  });

  it('lets notification managers read their editor and rejects writes by read-only settings viewers', () => {
    const router = require('../../src/modules/notification/notification.routes');
    const read = router.stack.find(layer => layer.route?.path === '/events' && layer.route.methods.get).route.stack[0].handle;
    const write = router.stack.find(layer => layer.route?.path === '/events/:event' && layer.route.methods.put).route.stack[0].handle;
    const next = vi.fn();
    read({ user: { permissions: ['notifications.manage'] } }, {}, next);
    expect(next).toHaveBeenCalledWith();
    next.mockClear();
    write({ user: { permissions: ['settings.read'] } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });
  it('rejects internal recipient selections on customer messages', async () => {
    await expect(routing.validate({ revision: null, rules: [makeRule({ audience: 'customer' })] })).rejects.toThrow(/only go to the customer/);
  });
  it('validates separate-message links and rejects missing targets and cycles', async () => {
    const secondId = '55555555-5555-4555-8555-555555555555';
    await expect(routing.validate({ revision: null, rules: [makeRule({ separateRuleIds: [secondId] })] })).rejects.toThrow(/removed/);
    await expect(routing.validate({ revision: null, rules: [makeRule({ separateRuleIds: [secondId] }), makeRule({ id: secondId, separateRuleIds: [ids.rule] })] })).rejects.toThrow(/refer back/);
    await expect(routing.validate({ revision: null, rules: [makeRule({ separateRuleIds: [secondId] }), makeRule({ id: secondId })] })).resolves.toBeDefined();
  });

  it('rechecks separate-message exclusions before delivery and permits legacy rules to become combined', async () => {
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    const job = [...jobs.values()][0];
    config.rules[0].audience = 'mixed';
    expect(await routing.canDeliver(job)).toBe(true);
    const separate = makeRule({ id: '55555555-5555-4555-8555-555555555555' });
    config.rules[0].separateRuleIds = [separate.id];
    config.rules.push(separate);
    expect(await routing.canDeliver(job)).toBe(false);
    config.rules[0].separateRuleIds = [];
    expect(await routing.canDeliver(job)).toBe(true);
  });
  it('rejects unknown users, inactive roles, malformed contacts and invalid template syntax', async () => {
    for (const rule of [
      makeRule({ recipients: { defaultAdmins: false, userIds: [ids.buyer], roleIds: [], contacts: [] } }),
      makeRule({ recipients: { defaultAdmins: false, userIds: [], roleIds: [ids.buyer], contacts: [] } }),
      makeRule({ recipients: { defaultAdmins: false, userIds: [], roleIds: [], contacts: [{ email: '', phone: '' }] } }),
      makeRule({ messages: { email: message('{{#if}'), sms: message('SMS'), whatsapp: message('WA') } }),
    ]) await expect(routing.validate({ revision: null, rules: [rule] })).rejects.toMatchObject({ statusCode: 400 });
  });
  it('rejects overwriting a newer configuration and does not persist stale changes', async () => {
    vi.spyOn(sequelize, 'transaction').mockImplementation(callback => callback({ id: 'tx' }));
    vi.spyOn(sequelize, 'query').mockResolvedValue([]);
    const upsert = vi.spyOn(Setting, 'upsert').mockResolvedValue([]);
    await expect(routing.save('order_placed', { revision: 'old-revision', rules: [makeRule()] }, { id: ids.staff })).rejects.toMatchObject({ statusCode: 409 });
    expect(upsert).not.toHaveBeenCalled();
  });
  it('saves independent channel content in a transaction and records the change', async () => {
    vi.spyOn(sequelize, 'transaction').mockImplementation(callback => callback({ id: 'tx' }));
    vi.spyOn(sequelize, 'query').mockResolvedValue([]);
    vi.spyOn(Setting, 'upsert').mockImplementation(async record => { config = record.value; });
    vi.spyOn(audit, 'log').mockResolvedValue({});
    const saved = await routing.save('order_placed', { revision: 'revision-1', rules: [makeRule()] }, { id: ids.staff });
    expect(saved.managed).toBe(true);
    expect(saved.revision).not.toBe('revision-1');
    expect(Setting.upsert).toHaveBeenCalledWith(expect.objectContaining({ group: 'messaging', key: 'notificationRules_order_placed' }), { transaction: { id: 'tx' } });
    expect(audit.log).toHaveBeenCalled();
  });
  it('rechecks role membership and rule activation before delivery', async () => {
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    const job = [...jobs.values()][0];
    expect(await routing.canDeliver(job)).toBe(true);
    User.findAll.mockResolvedValue([]);
    expect(await routing.canDeliver(job)).toBe(false);
    User.findAll.mockResolvedValue(people);
    config.rules[0].isActive = false;
    expect(await routing.canDeliver(job)).toBe(false);
  });
  it('skips a queued rule after its audience changes instead of delivering the old message', async () => {
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    const job = [...jobs.values()][0];
    config.rules[0].audience = 'customer';
    expect(await routing.canDeliver(job)).toBe(false);
  });
  it('keeps routing configuration out of general settings and blocks generic updates', async () => {
    vi.spyOn(Setting, 'findAll').mockResolvedValue([{ group: 'messaging', key: 'notificationRules_order_placed', value: config }]);
    expect((await settings.getByGroup('messaging')).notificationRules_order_placed).toBeUndefined();
    await expect(settings.updateKey('notificationRules_order_placed', config, 'messaging', ids.staff, { permissions: ['settings.manage', 'notifications.manage'] })).rejects.toMatchObject({ statusCode: 403 });
  });
  it('uses the queued message snapshot and skips disabled recipients in the existing worker', async () => {
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    const job = { id: 'job-1', attempts: 0, maxAttempts: 3, ...[...jobs.values()][0] };
    job.update = vi.fn().mockImplementation(async patch => Object.assign(job, patch));
    vi.spyOn(NotificationQueue, 'findAll').mockResolvedValue([job]);
    vi.spyOn(NotificationQueue, 'update').mockResolvedValue([1]);
    vi.spyOn(NotificationLog, 'create').mockResolvedValue({});
    vi.spyOn(settings, 'getByGroup').mockResolvedValue({ emailEnabled: false });
    const template = vi.spyOn(NotificationTemplate, 'findOne');
    expect(await notifications.processQueued()).toBe(1);
    expect(job.status).toBe('skipped');
    expect(job.error).toBe('Channel disabled');
    expect(NotificationLog.create).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Internal ORD-1042', status: 'skipped' }), {});
    expect(template).not.toHaveBeenCalled();
  });

  it('retries a failed delivery without preventing the next recipient from receiving the notification', async () => {
    config.rules[0].recipients.contacts.push({ name: 'Partner', email: 'partner@example.test', phone: '' });
    await routing.route({ sourceTemplate: 'order_shipped', orderId: 'order-1' });
    const queue = [...jobs.values()].map((job, index) => {
      const record = { ...job, id: `job-${index}`, attempts: 0, maxAttempts: 3 };
      record.update = vi.fn().mockImplementation(async patch => Object.assign(record, patch));
      return record;
    });
    vi.spyOn(NotificationQueue, 'findAll').mockResolvedValue(queue);
    vi.spyOn(NotificationQueue, 'update').mockResolvedValue([1]);
    vi.spyOn(NotificationLog, 'create').mockResolvedValue({});
    vi.spyOn(settings, 'getByGroup').mockResolvedValue({ emailEnabled: true });
    const send = vi.spyOn(require('../../src/modules/notification/channels/email.channel'), 'send').mockRejectedValueOnce(new Error('Temporary provider failure')).mockResolvedValueOnce(true);
    expect(await notifications.processQueued()).toBe(2);
    expect(queue[0]).toMatchObject({ status: 'queued', attempts: 1, error: 'Temporary provider failure', nextAttemptAt: expect.any(Date) });
    expect(queue[1].status).toBe('sent');
    expect(send).toHaveBeenCalledTimes(2);
  });
});
