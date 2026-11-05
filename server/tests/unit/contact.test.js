import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const handlebars = require('handlebars');
const { Setting, User, NotificationQueue, NotificationTemplate, NotificationLog } = require('../../src/modules');
const settings = require('../../src/modules/settings/settings.service');
const notifications = require('../../src/modules/notification/notification.service');
const service = require('../../src/modules/contact/contact.service');
const { contactSchema } = require('../../src/modules/contact/contact.validation');
const { DEFAULTS, TEMPLATE_VARIABLES } = require('../../src/modules/notification/notification.defaults');
const input = { name: 'Jane Doe', email: 'jane@example.test', phone: '+91 98765 43210', message: 'Please contact me.\nThank you.' };
const staff = { id: 'mail-admin', email: 'team@example.test', firstName: 'Team', toJSON: () => ({ permissions: ['notifications.manage'] }) };

beforeEach(() => vi.spyOn(notifications, 'sendEvent').mockResolvedValue(null));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('Public contact validation', () => {
  it('normalizes submitted fields and ignores attempts to select mail recipients', () => {
    const result = contactSchema.validate({ ...input, name: ' Jane Doe ', email: ' JANE@EXAMPLE.TEST ', to: 'attacker@example.test' }, { stripUnknown: true });
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual(input);
  });

  it.each([
    { name: ' ' }, { name: 'A' }, { name: 'Jane\r\nBcc: other@example.test' },
    { email: 'invalid' }, { phone: 'abc1234567' }, { phone: '123' }, { phone: '1'.repeat(16) },
    { message: '' }, { message: ' '.repeat(10) }, { message: 'a'.repeat(5001) },
  ])('rejects invalid or excessive data: %j', change => {
    expect(contactSchema.validate({ ...input, ...change }).error).toBeDefined();
  });
});

describe('Dedicated contact mail', () => {
  it('queues all form fields to selected staff, never to the visitor or a supplied recipient', async () => {
    vi.spyOn(settings, 'getByGroup').mockResolvedValue({ emailEnabled: true });
    vi.spyOn(Setting, 'findOne').mockResolvedValue({ value: { contact: [staff.id] } });
    vi.spyOn(User, 'findAll').mockResolvedValue([staff]);
    vi.spyOn(NotificationTemplate, 'findOne').mockResolvedValue({ isActive: true });
    const create = vi.spyOn(NotificationQueue, 'create').mockResolvedValue({});

    await expect(service.submit({ ...input, to: 'attacker@example.test' })).resolves.toEqual({ queued: true });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      templateName: 'contact_form_admin', channel: 'email', recipientEmail: staff.email,
      variables: expect.objectContaining({ contact_name: input.name, contact_email: input.email, contact_phone: input.phone, contact_message: input.message }),
    }), expect.any(Object));
  });

  it('does not accept a message when no recipients are selected', async () => {
    vi.spyOn(settings, 'getByGroup').mockResolvedValue({ emailEnabled: true });
    vi.spyOn(Setting, 'findOne').mockResolvedValue({ value: { contact: [] } });
    vi.spyOn(User, 'findAll').mockResolvedValue([staff]);
    const create = vi.spyOn(NotificationQueue, 'create');
    await expect(service.submit(input)).rejects.toMatchObject({ statusCode: 503, code: 'CONTACT_UNAVAILABLE' });
    expect(create).not.toHaveBeenCalled();
  });

  it('uses notification administrators and the configured inbox by default', async () => {
    vi.stubEnv('ADMIN_NOTIFICATION_EMAIL', 'inbox@example.test');
    vi.stubEnv('ADMIN_NOTIFICATION_PHONE', '');
    vi.spyOn(settings, 'getByGroup').mockResolvedValue({ emailEnabled: true });
    vi.spyOn(Setting, 'findOne').mockResolvedValue(null);
    vi.spyOn(User, 'findAll').mockResolvedValue([staff]);
    vi.spyOn(NotificationTemplate, 'findOne').mockResolvedValue({ isActive: true });
    const create = vi.spyOn(NotificationQueue, 'create').mockResolvedValue({});
    await service.submit(input);
    expect(create.mock.calls.map(([job]) => job.recipientEmail).sort()).toEqual(['inbox@example.test', staff.email].sort());
  });

  it('delivers queued contact fields through the existing email channel and records delivery', async () => {
    const channel = require('../../src/modules/notification/channels/email.channel');
    const features = require('../../src/middleware/featureGate.middleware');
    vi.spyOn(features, 'getResolvedFeature').mockResolvedValue(false);
    vi.spyOn(settings, 'getByGroup').mockResolvedValue({ emailEnabled: true, storeName: 'Orbi Seeds' });
    const job = { id: 'contact-job', templateName: 'contact_form_admin', channel: 'email', recipientEmail: staff.email,
      attempts: 0, maxAttempts: 3, variables: { contact_name: input.name, contact_email: input.email,
        contact_phone: input.phone, contact_message: input.message }, update: vi.fn().mockResolvedValue() };
    vi.spyOn(NotificationQueue, 'update').mockImplementation(async changes => [changes.status === 'processing' ? 1 : 0]);
    vi.spyOn(NotificationQueue, 'findAll').mockResolvedValue([job]);
    vi.spyOn(NotificationTemplate, 'findOne').mockResolvedValue({ ...DEFAULTS.contact_form_admin, isActive: true });
    const log = vi.spyOn(NotificationLog, 'create').mockResolvedValue({});
    const send = vi.spyOn(channel, 'send').mockResolvedValue(true);
    expect(await notifications.processQueued()).toBe(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: staff.email,
      subject: 'New contact message from Jane Doe — Orbi Seeds',
      html: expect.stringContaining(input.message), text: expect.stringContaining(input.email),
    }));
    expect(job.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent' }));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent', templateName: 'contact_form_admin' }), expect.any(Object));
  });

  it.each([{ results: [] }, { results: [false] }, { results: [false, false] }])('does not claim success when queuing fails or the template is disabled: %j', async ({ results }) => {
    vi.spyOn(settings, 'getByGroup').mockResolvedValue({ emailEnabled: true });
    vi.spyOn(notifications, 'sendToAdmins').mockResolvedValue(results);
    await expect(service.submit(input)).rejects.toMatchObject({ statusCode: 503 });
  });

  it.each([false, 'false', '0', 'off'])('does not queue when email is switched off (%s)', async emailEnabled => {
    vi.spyOn(settings, 'getByGroup').mockResolvedValue({ emailEnabled });
    const send = vi.spyOn(notifications, 'sendToAdmins');
    await expect(service.submit(input)).rejects.toMatchObject({ statusCode: 503 });
    expect(send).not.toHaveBeenCalled();
  });

  it('escapes submitted HTML and keeps every field available in the admin template', () => {
    const variables = { contact_name: 'Jane <img src=x onerror=alert(1)>', contact_email: input.email,
      contact_phone: input.phone, contact_message: '<script>alert(1)</script>\nSecond line' };
    const html = handlebars.compile(DEFAULTS.contact_form_admin.bodyHtml)(variables);
    const text = handlebars.compile(DEFAULTS.contact_form_admin.bodyText, { noEscape: true })(variables);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('white-space:pre-wrap');
    expect(html).toContain(`mailto:${input.email}`);
    for (const key of Object.keys(variables)) {
      expect(TEMPLATE_VARIABLES.contact_form_admin).toContain(key);
      expect(text).toContain(variables[key]);
    }
  });

  it('adds the migration template without overwriting administrator edits', async () => {
    const migration = require('../../migrations/20261103120000-add-contact-form-notification');
    const query = vi.fn().mockResolvedValue([]);
    await migration.up({ sequelize: { query } });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT (name, channel) DO NOTHING'), expect.objectContaining({
      replacements: expect.objectContaining({ name: 'contact_form_admin', html: DEFAULTS.contact_form_admin.bodyHtml }),
    }));
  });
});
