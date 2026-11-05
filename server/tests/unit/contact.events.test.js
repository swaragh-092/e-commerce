import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { Setting, User, Role, NotificationQueue, NotificationTemplate, sequelize } = require('../../src/modules');
const routing = require('../../src/modules/notification/notificationRules.service');
const notifications = require('../../src/modules/notification/notification.service');
const { findEvent } = require('../../src/modules/notification/notification.events');
const settings = require('../../src/modules/settings/settings.service');
const audit = require('../../src/modules/audit/audit.service');
const contact = require('../../src/modules/contact/contact.service');
const eventKey = 'contact_form_submitted';
const ids = { staff: '22222222-2222-4222-8222-222222222222', role: '33333333-3333-4333-8333-333333333333', rule: '44444444-4444-4444-8444-444444444444' };
const staff = { id: ids.staff, firstName: 'Team', email: 'team@example.test', role: 'admin', emailVerified: true,
  profile: { phone: '+919876543210' }, roles: [{ id: ids.role, slug: 'admin', isActive: true, baseRole: 'admin' }],
  toJSON: () => ({ permissions: ['notifications.manage'] }) };
const message = { subject: 'Contact from {{contact_name}}', bodyHtml: '<p>{{contact_message}}</p>', bodyText: '{{contact_name}}: {{contact_message}}' };
const makeRule = () => ({ id: ids.rule, name: 'Contact form message', audience: 'internal', isActive: true, channels: ['email'],
  recipients: { defaultAdmins: false, userIds: [ids.staff], roleIds: [], contacts: [] },
  messages: { email: { ...message }, sms: { ...message, bodyHtml: '' }, whatsapp: { ...message, bodyHtml: '' } } });
const input = { name: 'Jane Doe', email: 'jane@example.test', phone: '+15550000000', message: 'Please contact me about your seeds.' };
let config, legacy, jobs;

beforeEach(() => {
  vi.stubEnv('ADMIN_NOTIFICATION_EMAIL', ''); vi.stubEnv('ADMIN_NOTIFICATION_PHONE', '');
  config = { version: 1, revision: 'revision-1', rules: [makeRule()] }; legacy = null; jobs = new Map();
  vi.spyOn(Setting, 'findOne').mockImplementation(async ({ where }) => {
    if (where.key === routing.PREFIX + eventKey) return config ? { value: config } : null;
    if (where.key === 'eventRecipientUserIds') return legacy ? { value: legacy } : null;
    return null;
  });
  vi.spyOn(User, 'findAll').mockResolvedValue([staff]);
  vi.spyOn(Role, 'findAll').mockResolvedValue([{ id: ids.role, name: 'Administrators', slug: 'admin' }]);
  vi.spyOn(settings, 'getByGroup').mockResolvedValue({ emailEnabled: true });
  vi.spyOn(NotificationQueue, 'create').mockResolvedValue({});
  vi.spyOn(NotificationQueue, 'findOrCreate').mockImplementation(async ({ where, defaults }) => {
    if (jobs.has(where.dedupeKey)) return [jobs.get(where.dedupeKey), false];
    const job = { id: 'job-' + jobs.size, createdAt: new Date(), ...defaults, dedupeKey: where.dedupeKey };
    jobs.set(where.dedupeKey, job);
    return [job, true];
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('Contact form event notifications', () => {
  it('registers an internal contact event and imports existing template edits and recipients', async () => {
    config = null; legacy = { contact: [ids.staff] };
    vi.spyOn(NotificationTemplate, 'findAll').mockResolvedValue([{ name: 'contact_form_admin', channel: 'email', isActive: true,
      subject: 'Saved subject', bodyHtml: '<p>Saved {{contact_message}}</p>', bodyText: 'Saved message' }]);
    const result = await routing.read(eventKey);
    expect(findEvent(eventKey)).toMatchObject({ customerTemplate: null, internalTemplate: 'contact_form_admin' });
    expect(result.managed).toBe(false);
    expect(result.rules).toEqual([expect.objectContaining({ audience: 'internal', isActive: true, channels: ['email'],
      recipients: { defaultAdmins: false, userIds: [ids.staff], roleIds: [], contacts: [] },
      messages: expect.objectContaining({ email: { subject: 'Saved subject', bodyHtml: '<p>Saved {{contact_message}}</p>', bodyText: 'Saved message' } }),
    })]);
    expect(result.event.variables).toEqual(expect.arrayContaining(['contact_name', 'contact_email', 'contact_phone', 'contact_message']));
  });

  it('routes public form fields through the saved event and its message snapshot', async () => {
    await expect(contact.submit({ ...input, to: 'unselected@example.test' })).resolves.toEqual({ queued: true });
    const queued = [...jobs.values()];
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ recipientEmail: staff.email, templateName: `rule_${eventKey}_${ids.rule}`, channel: 'email',
      variables: { contact_name: input.name, contact_email: input.email, contact_phone: input.phone, contact_message: input.message,
        __notificationRule: { eventKey, ruleId: ids.rule, message } },
    });
    expect(NotificationQueue.create).not.toHaveBeenCalled();
    expect(settings.getByGroup).not.toHaveBeenCalled();
  });

  it('supports the submitted visitor, selected people, roles and external contacts like other events', async () => {
    config.rules[0].audience = 'mixed';
    config.rules[0].recipients.roleIds = [ids.role];
    config.rules[0].recipients.contacts = [{ name: 'Partner', email: 'partner@example.test', phone: '' }];
    await contact.submit(input);
    expect([...jobs.values()].map(job => job.recipientEmail).sort()).toEqual([input.email, staff.email, 'partner@example.test'].sort());
    const customer = [...jobs.values()].find(job => job.recipientEmail === input.email);
    expect(customer).toMatchObject({ userId: null, variables: { customer_name: input.name, customer_email: input.email,
      __notificationRule: { audience: 'customer' } } });
    expect(await routing.canDeliver(customer)).toBe(true);
  });

  it.each(['empty', 'paused'])('does not fall back to legacy recipients for a saved %s event', async state => {
    if (state === 'empty') config.rules = []; else config.rules[0].isActive = false;
    await expect(contact.submit(input)).rejects.toMatchObject({ statusCode: 503, code: 'CONTACT_UNAVAILABLE' });
    expect(NotificationQueue.create).not.toHaveBeenCalled();
    expect(NotificationQueue.findOrCreate).not.toHaveBeenCalled();
    expect(settings.getByGroup).not.toHaveBeenCalled();
  });

  it('keeps identical messages from separate form submissions as distinct occurrences', async () => {
    await contact.submit(input); await contact.submit(input);
    expect(jobs.size).toBe(2);
    expect(new Set([...jobs.values()].map(job => job.dedupeKey)).size).toBe(2);
  });

  it('honors configured SMS channels independently of the legacy email switch', async () => {
    settings.getByGroup.mockResolvedValue({ emailEnabled: false, smsEnabled: true });
    config.rules[0].channels = ['sms'];
    await expect(contact.submit(input)).resolves.toEqual({ queued: true });
    expect([...jobs.values()]).toEqual([expect.objectContaining({ channel: 'sms', recipientPhone: staff.profile.phone })]);
  });

  it('uses the standard event save API without changing enquiry notifications', async () => {
    vi.spyOn(sequelize, 'transaction').mockImplementation(callback => callback({}));
    vi.spyOn(sequelize, 'query').mockResolvedValue([]);
    vi.spyOn(audit, 'log').mockResolvedValue();
    const upsert = vi.spyOn(Setting, 'upsert').mockImplementation(async row => { config = row.value; });
    const changed = makeRule(); changed.messages.email.subject = 'Edited contact alert';
    const saved = await routing.save(eventKey, { revision: config.revision, rules: [changed] }, { id: ids.staff });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ key: routing.PREFIX + eventKey }), expect.any(Object));
    expect(saved.managed).toBe(true);
    await contact.submit(input);
    expect([...jobs.values()][0].variables.__notificationRule.message.subject).toBe('Edited contact alert');
  });

  it('provides delivery history and rechecks changed recipients and paused rules before sending', async () => {
    await contact.submit(input);
    const job = [...jobs.values()][0];
    expect(await routing.canDeliver(job)).toBe(true);
    config.rules[0].recipients.userIds = [];
    expect(await routing.canDeliver(job)).toBe(false);
    config.rules[0].recipients.userIds = [ids.staff]; config.rules[0].isActive = false;
    expect(await routing.canDeliver(job)).toBe(false);
    vi.spyOn(NotificationQueue, 'findAll').mockResolvedValue([job]);
    expect(await routing.history(eventKey)).toEqual([expect.objectContaining({ name: 'Contact form message', recipient: staff.email, status: 'queued' })]);
    expect(NotificationQueue.findAll.mock.calls[0][0].where.templateName).toBeDefined();
  });
});
