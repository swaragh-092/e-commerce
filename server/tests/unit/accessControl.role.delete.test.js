import { describe, it, expect, vi, beforeEach } from 'vitest';
const AdminService = require('../../src/modules/admin/admin.service');
const db = require('../../src/modules/index');
const { Role, User } = db;
const AuditService = require('../../src/modules/audit/audit.service');
const { PERMISSIONS } = require('../../src/config/permissions');

describe('AdminService.deleteAccessRole edge cases', () => {
  const superAdminUser = {
    id: 'super-admin-uuid',
    role: 'super_admin',
    permissions: [PERMISSIONS.ROLES_MANAGE, PERMISSIONS.SYSTEM_ROLES_MANAGE],
  };

  const regularAdminUser = {
    id: 'admin-uuid',
    role: 'admin',
    permissions: [PERMISSIONS.ROLES_MANAGE],
  };

  const restrictedUser = {
    id: 'restricted-uuid',
    role: 'staff',
    permissions: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    db.sequelize.transaction = vi.fn().mockImplementation(async (callback) => callback({}));
  });

  it('rejects with 404 if role does not exist', async () => {
    vi.spyOn(Role, 'findByPk').mockResolvedValue(null);

    await expect(
      AdminService.deleteAccessRole('non-existent-id', superAdminUser)
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'Role not found',
    });
  });

  it('rejects with 403 if role is a system role', async () => {
    vi.spyOn(Role, 'findByPk').mockResolvedValue({
      id: 'system-role-id',
      name: 'Admin',
      slug: 'admin',
      isSystem: true,
    });

    await expect(
      AdminService.deleteAccessRole('system-role-id', superAdminUser)
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'System roles cannot be deleted',
    });
  });

  it('rejects with 403 if acting user lacks roles.manage permission', async () => {
    vi.spyOn(Role, 'findByPk').mockResolvedValue({
      id: 'custom-role-id',
      name: 'Custom Manager',
      slug: 'custom-manager',
      isSystem: false,
    });

    await expect(
      AdminService.deleteAccessRole('custom-role-id', restrictedUser)
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'You do not have permission to delete custom roles',
    });
  });

  it('rejects with 409 conflict if users are currently assigned to the role', async () => {
    vi.spyOn(Role, 'findByPk').mockResolvedValue({
      id: 'custom-role-id',
      name: 'Testing Role',
      slug: 'testing-role',
      isSystem: false,
    });
    vi.spyOn(db.sequelize, 'query').mockResolvedValue([{ count: 3 }]);
    vi.spyOn(User, 'count').mockResolvedValue(0);

    await expect(
      AdminService.deleteAccessRole('custom-role-id', regularAdminUser)
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
    });
  });

  it('successfully cleans up permissions, deletes custom role, and logs audit', async () => {
    const mockRole = {
      id: 'custom-role-id',
      name: 'Unused Custom Role',
      slug: 'unused-custom-role',
      baseRole: 'admin',
      isSystem: false,
      setPermissions: vi.fn().mockResolvedValue([]),
      destroy: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(Role, 'findByPk').mockResolvedValue(mockRole);
    vi.spyOn(db.sequelize, 'query').mockResolvedValue([{ count: 0 }]);
    vi.spyOn(User, 'count').mockResolvedValue(0);
    const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(true);

    const result = await AdminService.deleteAccessRole('custom-role-id', regularAdminUser);

    expect(result).toBe(true);
    expect(mockRole.setPermissions).toHaveBeenCalledWith([], expect.anything());
    expect(mockRole.destroy).toHaveBeenCalled();
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DELETE',
        entity: 'Role',
        entityId: 'custom-role-id',
      }),
      expect.anything()
    );
  });
});
