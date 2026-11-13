import { createRequire } from 'node:module';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const policy = require('../../src/modules/auth/mfaPolicy');
const service = require('../../src/modules/auth/mfaSettings.service');
const factors = require('../../src/modules/auth/twoFactor.service');
const { PERMISSIONS } = require('../../src/config/permissions');
const roleId = '10000000-0000-4000-8000-000000000001';
const optional = { requireAdministrators: false, staffMode: 'optional', requiredRoleIds: [] };
const selected = { requireAdministrators: false, staffMode: 'selected', requiredRoleIds: [roleId] };
let actor, saved;
const input = config => ({ policy: config, verification: { currentPassword: 'provided-by-user', code: '123456' } });
beforeEach(() => {
  saved = null;
  actor = { id: 'owner', role: 'super_admin', status: 'active', twoFactorEnabled: false,
    permissions: [PERMISSIONS.SETTINGS_MANAGE], validatePassword: vi.fn().mockResolvedValue(true) };
  vi.spyOn(db.Setting, 'findOne').mockImplementation(async () => saved && { value: saved });
  vi.spyOn(db.Setting, 'upsert').mockImplementation(async setting => { saved = setting.value; });
  vi.spyOn(db.Role, 'findAll').mockResolvedValue([{ id: roleId, name: 'Support', slug: 'support' }]);
  vi.spyOn(db.User, 'scope').mockReturnValue({ findByPk: async () => actor });
  vi.spyOn(db.User, 'findAll').mockResolvedValue([]);
  vi.spyOn(db.AuditLog, 'create').mockResolvedValue({});
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(callback => callback({ LOCK: { UPDATE: 'UPDATE' } }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('Role-scoped MFA enforcement', () => {
  it('distinguishes persisted staff roles from their legacy admin alias', () => {
    const staff = { role: 'admin', roles: [{ id: roleId, slug: 'support', baseRole: 'admin' }] };
    expect(policy.isEnrollmentRequired(staff, { ...optional, requireAdministrators: true })).toBe(false);
    expect(policy.isEnrollmentRequired(staff, selected)).toBe(true);
    expect(policy.isEnrollmentRequired({ ...staff, roles: [{ id: 'other', slug: 'sales', baseRole: 'admin' }] }, selected)).toBe(false);
    expect(policy.isEnrollmentRequired({ role: 'super_admin', roles: staff.roles }, { ...optional, requireAdministrators: true })).toBe(true);
  });
  it('never requires customer enrollment and keeps enrolled staff evidence enforced', () => {
    expect(policy.isEnrollmentRequired({ role: 'customer', roles: [{ id: roleId, baseRole: 'customer' }] }, selected)).toBe(false);
    expect(() => policy.assertMfaSession({ role: 'admin', twoFactorEnabled: true }, {}, optional)).toThrow();
    expect(() => policy.assertMfaSession({ role: 'admin', twoFactorEnabled: true }, { mfa: true }, optional)).not.toThrow();
  });
  it('reads new policy immediately without a worker-local cache', async () => {
    saved = optional;
    expect(await policy.loadMfaPolicy({ role: 'admin' })).toEqual(optional);
    saved = { ...optional, requireAdministrators: true };
    expect((await policy.loadMfaPolicy({ role: 'admin' })).requireAdministrators).toBe(true);
  });
  it('preserves environment defaults until a policy is explicitly saved', async () => {
    vi.stubEnv('REQUIRE_ADMIN_MFA', 'false');
    expect(await policy.loadMfaPolicy({ role: 'admin' })).toEqual(optional);
    vi.stubEnv('REQUIRE_ADMIN_MFA', 'true');
    expect((await policy.loadMfaPolicy({ role: 'admin' })).staffMode).toBe('all');
  });
  it('fails closed on invalid stored policy or failed reads', async () => {
    saved = { ...optional, staffMode: 'invalid' };
    await expect(policy.loadMfaPolicy({ role: 'admin' })).rejects.toMatchObject({ code: 'MFA_POLICY_INVALID' });
    db.Setting.findOne.mockRejectedValue(new Error('database unavailable'));
    await expect(policy.loadMfaPolicy({ role: 'admin' })).rejects.toThrow('database unavailable');
  });
});

describe('Verified MFA policy updates', () => {
  it('refuses customers and delegated settings managers', async () => {
    await expect(service.update({ ...actor, role: 'admin' }, input(optional))).rejects.toMatchObject({ statusCode: 403 });
    expect(db.Setting.upsert).not.toHaveBeenCalled();
  });
  it('rechecks the actor permissions after authentication', async () => {
    actor.permissions = [];
    await expect(service.update({ ...actor, permissions: [PERMISSIONS.SETTINGS_MANAGE] }, input(optional)))
      .rejects.toMatchObject({ statusCode: 403 });
  });
  it('requires the current password, and a TOTP code when enrolled', async () => {
    actor.validatePassword.mockResolvedValue(false);
    await expect(service.update(actor, input(optional))).rejects.toMatchObject({ code: 'REAUTHENTICATION_FAILED' });
    actor.validatePassword.mockResolvedValue(true);
    actor.twoFactorEnabled = true;
    vi.spyOn(factors, 'verify').mockReturnValue(false);
    await expect(service.update(actor, input(optional))).rejects.toMatchObject({ code: 'REAUTHENTICATION_FAILED' });
    expect(db.Setting.upsert).not.toHaveBeenCalled();
  });
  it('rejects unknown or customer role selections', async () => {
    await expect(service.update(actor, input({ ...selected, requiredRoleIds: ['20000000-0000-4000-8000-000000000001'] })))
      .rejects.toMatchObject({ statusCode: 400 });
  });
  it('saves the policy before existing staff enroll', async () => {
    db.User.findAll.mockResolvedValue([{ role: 'admin', twoFactorEnabled: false,
      roles: [{ id: roleId, slug: 'support', baseRole: 'admin' }] }]);
    await expect(service.update(actor, input(selected))).resolves.toMatchObject({ policy: selected });
    expect(db.Setting.upsert).toHaveBeenCalled();
  });
  it('saves selected scopes transactionally without logging verification secrets', async () => {
    actor.twoFactorEnabled = true;
    vi.spyOn(factors, 'verify').mockReturnValue(true);
    const response = await service.update(actor, input(selected));
    expect(response.policy).toEqual(selected);
    expect(response.source).toBe('settings');
    expect(db.AuditLog.create).toHaveBeenCalledWith(expect.objectContaining({ changes: {
      policy: { old: expect.any(Object), new: selected },
    } }), expect.objectContaining({ transaction: expect.any(Object) }));
    const persisted = JSON.stringify([db.Setting.upsert.mock.calls, db.AuditLog.create.mock.calls]);
    expect(persisted).not.toContain('provided-by-user');
    expect(persisted).not.toContain('123456');
  });
  it('blocks generic settings writers from bypassing re-verification', async () => {
    const settings = require('../../src/modules/settings/settings.service');
    await expect(settings.updateKey('mfaPolicy', optional, 'auth', actor.id, actor)).rejects.toMatchObject({ statusCode: 403 });
    await expect(settings.bulkUpdate([{ group: 'auth', key: 'mfaPolicy', value: optional }], actor.id, actor))
      .rejects.toMatchObject({ statusCode: 403 });
  });
});
