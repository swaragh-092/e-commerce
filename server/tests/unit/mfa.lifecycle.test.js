import { createRequire } from 'node:module';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
process.env.JWT_ACCESS_SECRET = 'test-access-secret-32chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-long!';
const db = require('../../src/modules');
const factors = require('../../src/modules/auth/twoFactor.service');
const { encrypt } = require('../../src/utils/crypto');
const { authenticator } = require('otplib');
const jwt = require('jsonwebtoken');
let initial, locked, find, transaction, code;
beforeEach(() => {
  vi.stubEnv('CREDENTIAL_ENCRYPTION_KEY', 'test-only-encryption-key');
  const secret = authenticator.generateSecret();
  code = authenticator.generate(secret);
  initial = { id: 'account', role: 'admin', status: 'active', twoFactorEnabled: false,
    twoFactorSecret: encrypt(secret), roles: [] };
  locked = { ...initial, twoFactorSecret: { ...initial.twoFactorSecret },
    update: vi.fn(async changes => Object.assign(locked, changes)) };
  find = vi.fn().mockResolvedValueOnce(initial).mockResolvedValue(locked);
  vi.spyOn(db.User, 'scope').mockReturnValue({ findByPk: find });
  vi.spyOn(db.User, 'findAll').mockResolvedValue([locked]);
  vi.spyOn(db.RefreshToken, 'update').mockResolvedValue([2]);
  vi.spyOn(db.RefreshToken, 'create').mockResolvedValue({});
  vi.spyOn(db.Setting, 'findOne').mockResolvedValue({ value: {
    requireAdministrators: false, staffMode: 'optional', requiredRoleIds: [],
  } });
  transaction = { LOCK: { UPDATE: 'UPDATE' } };
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(callback => callback(transaction));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('MFA factor lifecycle', () => {
  it('enables MFA and replaces the authenticated session in the same transaction', async () => {
    const result = await factors.enable(initial.id, code, { createSession: true, ipAddress: '127.0.0.1' });
    expect(result.backupCodes).toHaveLength(8);
    expect(locked.twoFactorEnabled).toBe(true);
    expect(locked.twoFactorBackupCodes).not.toContain(result.backupCodes[0]);
    expect(jwt.decode(result.tokens.accessToken).mfa).toBe(true);
    expect(find).toHaveBeenLastCalledWith(initial.id, expect.objectContaining({ transaction, lock: 'UPDATE' }));
    expect(db.RefreshToken.update).toHaveBeenCalledWith(expect.objectContaining({ revokedAt: expect.any(Date) }), expect.objectContaining({ transaction }));
    expect(db.RefreshToken.create).toHaveBeenCalledWith(expect.objectContaining({ userId: initial.id }), { transaction });
    expect(locked.update).toHaveBeenCalledWith(expect.objectContaining({ twoFactorEnabled: true }), { transaction });
    expect(db.RefreshToken.create.mock.calls[0][0].token).not.toBe(result.tokens.refreshToken);
  });
  it('supports operator enrollment without issuing or exposing a login session', async () => {
    const result = await factors.enable(initial.id, code);
    expect(result.tokens).toBeUndefined();
    expect(result.backupCodes).toHaveLength(8);
    expect(db.RefreshToken.create).not.toHaveBeenCalled();
  });
  it('rejects stale setup confirmation rather than replacing a newer secret', async () => {
    locked.twoFactorSecret = encrypt(authenticator.generateSecret());
    await expect(factors.enable(initial.id, code, { createSession: true })).rejects.toMatchObject({ statusCode: 409 });
    expect(locked.update).not.toHaveBeenCalled();
    expect(db.RefreshToken.create).not.toHaveBeenCalled();
  });
  it('keeps revocation and enrollment in the transaction if session issuance fails', async () => {
    db.RefreshToken.create.mockRejectedValue(new Error('write failed'));
    await expect(factors.enable(initial.id, code, { createSession: true })).rejects.toThrow('write failed');
    expect(db.RefreshToken.update.mock.calls[0][1].transaction).toBe(transaction);
    expect(locked.update.mock.calls[0][1].transaction).toBe(transaction);
  });
  it('allows verified disable under optional policy and replaces other sessions', async () => {
    initial.twoFactorEnabled = true; locked.twoFactorEnabled = true;
    const result = await factors.disable(initial.id, code, { createSession: true });
    expect(result.enabled).toBe(false);
    expect(locked.twoFactorSecret).toBeNull();
    expect(db.RefreshToken.update).toHaveBeenCalled();
    expect(result.tokens).toBeDefined();
  });
  it('rechecks policy under the account lock before disabling a required factor', async () => {
    initial.twoFactorEnabled = true; locked.twoFactorEnabled = true;
    db.Setting.findOne.mockResolvedValueOnce({ value: { requireAdministrators: false, staffMode: 'optional', requiredRoleIds: [] } })
      .mockResolvedValue({ value: { requireAdministrators: true, staffMode: 'optional', requiredRoleIds: [] } });
    await expect(factors.disable(initial.id, code, { createSession: true })).rejects.toMatchObject({ code: 'MFA_REQUIRED' });
    expect(locked.update).not.toHaveBeenCalled();
    expect(db.RefreshToken.create).not.toHaveBeenCalled();
  });
  it('sends replacement credentials only in protected cookies', async () => {
    const controller = require('../../src/modules/auth/twoFactor.controller');
    vi.spyOn(factors, 'enable').mockResolvedValue({ enabled: true, backupCodes: ['backup'], tokens: { accessToken: 'access', refreshToken: 'refresh' } });
    const res = { cookie: vi.fn(), json: vi.fn(), status: vi.fn() };
    res.status.mockReturnValue(res);
    const next = vi.fn();
    await controller.enable({ user: { id: initial.id }, validated: { code }, ip: '127.0.0.1' }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith('auth_access_token', 'access', expect.objectContaining({ httpOnly: true }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ data: { enabled: true, backupCodes: ['backup'] } }));
  });
});
