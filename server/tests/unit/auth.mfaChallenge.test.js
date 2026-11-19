import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
process.env.JWT_ACCESS_SECRET = 'test-access-secret-32chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-long!';
const db = require('../../src/modules');
const auth = require('../../src/modules/auth/auth.service');
const challenges = require('../../src/modules/auth/twoFactorChallenge');
const factors = require('../../src/modules/auth/twoFactor.service');
const attempts = require('../../src/modules/auth/loginAttemptStore');
const audit = require('../../src/modules/audit/audit.service');

let user;
let challengeRecord;
const transaction = { LOCK: { UPDATE: 'UPDATE' } };

beforeEach(() => {
  user = {
    id: 'staff-id', email: 'staff@example.test', role: 'admin', status: 'active',
    twoFactorEnabled: true, twoFactorSecret: { data: 'encrypted-secret' },
    twoFactorBackupCodes: [], update: vi.fn().mockResolvedValue(undefined),
  };
  challengeRecord = null;
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(callback => callback(transaction));
  vi.spyOn(db.User, 'scope').mockReturnValue({ findByPk: async () => user });
  vi.spyOn(db.User, 'findByPk').mockResolvedValue(user);
  vi.spyOn(db.Setting, 'findOne').mockResolvedValue(null);
  vi.spyOn(db.OtpToken, 'create').mockImplementation(async values => {
    challengeRecord = {
      ...values,
      attempts: 0,
      update: vi.fn(async changes => Object.assign(challengeRecord, changes)),
    };
    return challengeRecord;
  });
  vi.spyOn(db.OtpToken, 'findOne').mockImplementation(async () => challengeRecord);
  vi.spyOn(db.RefreshToken, 'create').mockResolvedValue({});
  vi.spyOn(attempts, 'checkMfaLock').mockResolvedValue(undefined);
  vi.spyOn(attempts, 'clearMfaFailures').mockResolvedValue(undefined);
  vi.spyOn(attempts, 'recordMfaFailure').mockResolvedValue(undefined);
  vi.spyOn(factors, 'verify').mockReturnValue(true);
  vi.spyOn(audit, 'log').mockResolvedValue(undefined);
});

afterEach(() => vi.restoreAllMocks());

describe('single-use authenticator challenges', () => {
  it('keeps MFA lock counters separate from password lock counters', async () => {
    attempts.checkMfaLock.mockRestore();
    const query = vi.spyOn(db.sequelize, 'query').mockResolvedValue([]);

    await attempts.checkLock(user.email, transaction);
    await attempts.checkMfaLock(user.email, transaction);

    const passwordLock = query.mock.calls[0][1];
    const mfaLock = query.mock.calls[1][1];
    expect(passwordLock.replacements.emailHash).not.toBe(mfaLock.replacements.emailHash);
    expect(passwordLock.transaction).toBe(transaction);
    expect(mfaLock.transaction).toBe(transaction);
  });

  it('stores a five-minute challenge and allows it to create only one session', async () => {
    const issued = await challenges.issue(user.id);
    const claims = require('jsonwebtoken').decode(issued.token);
    expect(claims).toMatchObject({ id: user.id, purpose: '2fa', jti: issued.jti });
    expect(challengeRecord).toMatchObject({
      identifier: issued.jti, purpose: '2fa-challenge', maxAttempts: 1,
      expiresAt: new Date(claims.exp * 1000),
    });

    const result = await auth.verifyTwoFactor(issued.token, '123456', '127.0.0.1');
    expect(result.tokens).toBeDefined();
    expect(challengeRecord.attempts).toBe(1);
    await expect(auth.verifyTwoFactor(issued.token, '123456', '127.0.0.1'))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(db.RefreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('serializes simultaneous TOTP submissions for one challenge', async () => {
    const issued = await challenges.issue(user.id);
    let queue = Promise.resolve();
    db.sequelize.transaction.mockImplementation(callback => {
      const next = queue.then(() => callback(transaction));
      queue = next.catch(() => {});
      return next;
    });

    const results = await Promise.allSettled([
      auth.verifyTwoFactor(issued.token, '123456', '127.0.0.1'),
      auth.verifyTwoFactor(issued.token, '123456', '127.0.0.1'),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(db.RefreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('commits account-scoped failure counts for invalid authenticator codes', async () => {
    const issued = await challenges.issue(user.id);
    vi.mocked(factors.verify).mockReturnValue(false);

    await expect(auth.verifyTwoFactor(issued.token, '000000', '127.0.0.1'))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' });

    expect(attempts.recordMfaFailure).toHaveBeenCalledWith(user.email, transaction);
    expect(challengeRecord.attempts).toBe(0);
    expect(db.RefreshToken.create).not.toHaveBeenCalled();
  });

  it('checks the account MFA lock before verifying the factor', async () => {
    const issued = await challenges.issue(user.id);
    const locked = new Error('MFA lock active');
    vi.mocked(attempts.checkMfaLock).mockRejectedValue(locked);

    await expect(auth.verifyTwoFactor(issued.token, '123456', '127.0.0.1')).rejects.toBe(locked);
    expect(factors.verify).not.toHaveBeenCalled();
    expect(db.RefreshToken.create).not.toHaveBeenCalled();
  });
});
