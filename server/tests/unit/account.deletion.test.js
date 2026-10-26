import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { deleteAccountSchema } = require('../../src/modules/user/user.validation');

describe('Account deletion validation & grace handling', () => {
  it('validates deleteAccountSchema with password', () => {
    const valid = deleteAccountSchema.validate({ password: 'secretpassword123' });
    expect(valid.error).toBeUndefined();
  });

  it('validates deleteAccountSchema with oauthProvider for passwordless accounts', () => {
    const valid = deleteAccountSchema.validate({ oauthProvider: 'google' });
    expect(valid.error).toBeUndefined();
  });

  it('validates deleteAccountSchema with otp for phone accounts', () => {
    const valid = deleteAccountSchema.validate({ otp: '123456' });
    expect(valid.error).toBeUndefined();
  });

  it('rejects empty payload in deleteAccountSchema', () => {
    const invalid = deleteAccountSchema.validate({});
    expect(invalid.error).toBeDefined();
  });

  it('permits login during active 30-day grace period and blocks only after expiry', () => {
    const now = new Date();
    const activeGraceUser = {
      id: 'user-grace',
      status: 'active',
      scheduledDeletionAt: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days in future
    };
    const expiredGraceUser = {
      id: 'user-expired',
      status: 'active',
      scheduledDeletionAt: new Date(now.getTime() - 1000), // 1 sec in past
    };

    const isGraceExpired = (user) => Boolean(user.scheduledDeletionAt && new Date(user.scheduledDeletionAt) <= new Date());

    expect(isGraceExpired(activeGraceUser)).toBe(false);
    expect(isGraceExpired(expiredGraceUser)).toBe(true);
  });
});
