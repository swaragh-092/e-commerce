import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const db = require('../../src/modules/index');
const auth = require('../../src/modules/auth/auth.service');
const notifications = require('../../src/modules/notification/notification.service');

afterEach(() => vi.restoreAllMocks());
describe('Password reset email destinations', () => {
  it.each(['customer', 'admin', 'super_admin'])('uses the correct reset page for %s', async (role) => {
    const email = `${role}@example.test`;
    vi.spyOn(db.User, 'findOne').mockResolvedValue({ id: role, email, role, firstName: 'Test', emailVerified: true });
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback({}));
    vi.spyOn(db.PasswordResetToken, 'destroy').mockResolvedValue(0);
    vi.spyOn(db.PasswordResetToken, 'create').mockResolvedValue({});
    const send = vi.spyOn(notifications, 'send').mockResolvedValue({});
    await auth.forgotPassword(email);
    expect(send).toHaveBeenCalled();
    const url = new URL(send.mock.calls[0][2].reset_url);
    expect(url.pathname).toBe(role === 'customer' ? '/reset-password' : '/admin/reset-password');
    expect(url.searchParams.get('token')).toMatch(/^[a-f0-9]{64}$/);
  });
});
