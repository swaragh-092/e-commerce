import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const service = require('../../src/modules/admin/admin.service');
const audit = require('../../src/modules/audit/audit.service');
const { Op } = require('sequelize');
const root = { id: 'root', role: 'super_admin', permissions: ['roles.manage'] };
let transaction;
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  transaction = {};
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(async callback => callback(transaction));
  vi.spyOn(audit, 'log').mockResolvedValue({});
  vi.spyOn(db.User, 'findAll').mockResolvedValue([]);
  vi.spyOn(db.RefreshToken, 'update').mockResolvedValue([1]);
});
describe('Permission changes revoke affected sessions atomically', () => {
  it('revokes the target user sessions when assigning a different role', async () => {
    const user = { id: 'target', role: 'admin', roles: [{ id: 'old', slug: 'old' }], update: vi.fn(), setRoles: vi.fn() };
    const role = { id: 'new', slug: 'new', name: 'New', baseRole: 'admin', isActive: true, permissions: [] };
    vi.spyOn(db.User, 'findByPk').mockResolvedValue(user);
    vi.spyOn(db.Role, 'findByPk').mockResolvedValue(role);
    await service.updateUserRole('target', 'new', root);
    expect(db.RefreshToken.update).toHaveBeenCalledWith({ revokedAt: expect.any(Date) }, {
      where: { userId: { [Op.in]: ['target'] }, revokedAt: null }, transaction,
    });
  });
  it('revokes members sessions when a shared role loses a permission', async () => {
    const role = { id: 'support', slug: 'support', name: 'Support', baseRole: 'admin', permissions: [{ id: 'p', key: 'products.read' }], setPermissions: vi.fn(), update: vi.fn() };
    vi.spyOn(db.Role, 'findByPk').mockResolvedValue(role);
    vi.spyOn(db.sequelize, 'query').mockResolvedValue([{ id: 'member-1' }, { id: 'member-2' }]);
    await service.updateAccessRole(role.id, { permissionIds: [] }, root);
    expect(db.RefreshToken.update.mock.calls[0][1]).toEqual({
      where: { userId: { [Op.in]: ['member-1', 'member-2'] }, revokedAt: null }, transaction,
    });
  });
  it('does not revoke sessions for a description-only change', async () => {
    const role = { id: 'support', slug: 'support', name: 'Support', baseRole: 'admin', permissions: [], update: vi.fn() };
    vi.spyOn(db.Role, 'findByPk').mockResolvedValue(role);
    await service.updateAccessRole(role.id, { description: 'Updated description' }, root);
    expect(db.RefreshToken.update).not.toHaveBeenCalled();
  });
  it('does not revoke sessions when the role assignment fails', async () => {
    const user = { id: 'target', role: 'admin', roles: [], update: vi.fn(), setRoles: vi.fn().mockRejectedValue(new Error('write failed')) };
    vi.spyOn(db.User, 'findByPk').mockResolvedValue(user);
    vi.spyOn(db.Role, 'findByPk').mockResolvedValue({ id: 'new', slug: 'new', baseRole: 'admin', isActive: true, permissions: [] });
    await expect(service.updateUserRole('target', 'new', root)).rejects.toThrow('write failed');
    expect(db.RefreshToken.update).not.toHaveBeenCalled();
  });
});
