import { afterEach, describe, expect, it, vi } from 'vitest';

const { sequelize, User, EmailVerificationToken } = require('../../src/modules');
const users = require('../../src/modules/user/user.service');
const notifications = require('../../src/modules/notification/notification.service');
const handlebars = require('handlebars');
const { DEFAULTS } = require('../../src/modules/notification/notification.defaults');

afterEach(() => vi.restoreAllMocks());

describe('Account notification safety', () => {
  it('queues the email-change notice to the old address in the same transaction', async () => {
    const transaction = { LOCK: { UPDATE: 'UPDATE' } };
    vi.spyOn(sequelize, 'transaction').mockImplementation((callback) => callback(transaction));
    vi.spyOn(EmailVerificationToken, 'findOne').mockResolvedValue({ userId: 'customer', expiresAt: new Date(Date.now() + 60000), destroy: vi.fn().mockResolvedValue() });
    const user = { id: 'customer', firstName: 'Customer', email: 'old@example.test', pendingEmail: 'new@example.test' };
    user.update = vi.fn().mockImplementation(async (changes) => Object.assign(user, changes));
    vi.spyOn(User, 'findByPk').mockResolvedValue(user);
    vi.spyOn(User, 'findOne').mockResolvedValue(null);
    const send = vi.spyOn(notifications, 'send').mockResolvedValue(true);
    await expect(users.confirmEmailChange('test-token')).resolves.toEqual({ email: 'new@example.test' });
    expect(send).toHaveBeenCalledWith('email_changed', 'old@example.test', expect.objectContaining({ new_email: 'new@example.test' }), 'customer', null, 'email', transaction);
  });

  it('does not send a security notice for an expired email-change link', async () => {
    vi.spyOn(sequelize, 'transaction').mockImplementation((callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
    vi.spyOn(EmailVerificationToken, 'findOne').mockResolvedValue({ expiresAt: new Date(0) });
    const send = vi.spyOn(notifications, 'send');
    await expect(users.confirmEmailChange('expired-token')).rejects.toMatchObject({ statusCode: 400 });
    expect(send).not.toHaveBeenCalled();
  });

  it('escapes customer-provided return reasons in the HTML email', () => {
    const rendered = handlebars.compile(DEFAULTS.admin_return_requested.bodyHtml)({ reason: '<script>alert(1)</script>', request_type: 'return' });
    expect(rendered).not.toContain('<script>');
    expect(rendered).toContain('&lt;script&gt;');
  });
});
