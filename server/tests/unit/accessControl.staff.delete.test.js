import { describe, it, expect, vi, beforeEach } from 'vitest';
const AppError = require('../../src/utils/AppError');
const AdminService = require('../../src/modules/admin/admin.service');
const db = require('../../src/modules/index');
const { User, Order, RefreshToken } = db;
const AuditService = require('../../src/modules/audit/audit.service');

describe('AdminService.deleteStaffUser edge cases & functionality', () => {
  const superAdminCaller = {
    id: 'super-admin-caller-id',
    role: 'super_admin',
  };

  const adminCaller = {
    id: 'admin-caller-id',
    role: 'admin',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    db.sequelize.transaction = vi.fn().mockImplementation(async (callback) => callback({}));
  });

  it('rejects with 400 if user attempts to delete their own account', async () => {
    await expect(
      AdminService.deleteStaffUser(adminCaller.id, adminCaller)
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'You cannot delete your own account',
    });
  });

  it('rejects with 404 if user does not exist', async () => {
    vi.spyOn(User, 'findByPk').mockResolvedValue(null);

    await expect(
      AdminService.deleteStaffUser('non-existent-user-id', adminCaller)
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'User not found',
    });
  });

  it('rejects with 403 if non-super-admin tries to delete a super admin', async () => {
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      id: 'target-super-admin-id',
      email: 'target_sa@example.com',
      role: 'super_admin',
    });

    await expect(
      AdminService.deleteStaffUser('target-super-admin-id', adminCaller)
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'Only super admins can delete super admin accounts',
    });
  });

  it('rejects with 400 if deleting the last active super admin', async () => {
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      id: 'last-super-admin-id',
      email: 'last_sa@example.com',
      role: 'super_admin',
    });
    vi.spyOn(User, 'count').mockResolvedValue(1);

    await expect(
      AdminService.deleteStaffUser('last-super-admin-id', superAdminCaller)
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Cannot delete the last active super admin',
    });
  });

  it('rejects with 409 if user has associated storefront orders', async () => {
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      id: 'staff-with-orders-id',
      email: 'staff_with_orders@example.com',
      role: 'admin',
    });
    vi.spyOn(Order, 'count').mockResolvedValue(3);

    await expect(
      AdminService.deleteStaffUser('staff-with-orders-id', superAdminCaller)
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
      message: expect.stringContaining('associated order(s)'),
    });
  });

  it('successfully revokes tokens, clears roles, soft-deletes user, and logs audit', async () => {
    const mockUser = {
      id: 'staff-to-delete-id',
      email: 'staff_delete@example.com',
      role: 'admin',
      setRoles: vi.fn().mockResolvedValue(true),
      destroy: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(User, 'findByPk').mockResolvedValue(mockUser);
    vi.spyOn(Order, 'count').mockResolvedValue(0);
    const tokenUpdateSpy = vi.spyOn(RefreshToken, 'update').mockResolvedValue([1]);
    const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(true);

    const result = await AdminService.deleteStaffUser('staff-to-delete-id', superAdminCaller);

    expect(result).toEqual({ id: 'staff-to-delete-id', email: 'staff_delete@example.com' });
    expect(mockUser.setRoles).toHaveBeenCalledWith([], expect.any(Object));
    expect(mockUser.destroy).toHaveBeenCalledWith(expect.any(Object));
    expect(tokenUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: expect.any(Date) }),
      expect.objectContaining({ where: { userId: 'staff-to-delete-id', revokedAt: null } })
    );
    expect(auditSpy).toHaveBeenCalledTimes(1);
  });
});
