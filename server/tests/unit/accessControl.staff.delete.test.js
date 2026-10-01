import { describe, it, expect, vi, beforeEach } from 'vitest';
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
      status: 'active',
    });
    // Join-aware guard counts via raw query (legacy column OR roles join)
    vi.spyOn(db.sequelize, 'query').mockResolvedValue([{ count: 1 }]);

    await expect(
      AdminService.deleteStaffUser('last-super-admin-id', superAdminCaller)
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Cannot delete the last active super admin',
    });
  });

  it('rejects with 400 if deleting a join-assigned super admin who is the last one', async () => {
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      id: 'join-super-admin-id',
      email: 'join_sa@example.com',
      role: 'admin',
      roles: [{ slug: 'super_admin', baseRole: 'super_admin' }],
      status: 'active',
    });
    vi.spyOn(db.sequelize, 'query').mockResolvedValue([{ count: 1 }]);

    await expect(
      AdminService.deleteStaffUser('join-super-admin-id', superAdminCaller)
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: 'Cannot delete the last active super admin',
    });
  });

  it('allows deleting an inactive super admin even when only one active super admin exists', async () => {
    const mockInactiveSA = {
      id: 'inactive-sa-id',
      email: 'inactive_sa@example.com',
      role: 'super_admin',
      status: 'inactive',
      setRoles: vi.fn().mockResolvedValue(true),
      destroy: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(User, 'findByPk').mockResolvedValue(mockInactiveSA);
    vi.spyOn(Order, 'count').mockResolvedValue(0);
    vi.spyOn(RefreshToken, 'findAll').mockResolvedValue([]);
    vi.spyOn(RefreshToken, 'update').mockResolvedValue([0]);
    vi.spyOn(AuditService, 'log').mockResolvedValue(true);
    // findAll should not be called because status !== 'active'
    const findAllSpy = vi.spyOn(User, 'findAll');

    const result = await AdminService.deleteStaffUser('inactive-sa-id', superAdminCaller);
    expect(result).toEqual({ id: 'inactive-sa-id', email: 'inactive_sa@example.com' });
    expect(findAllSpy).not.toHaveBeenCalled();
    expect(mockInactiveSA.destroy).toHaveBeenCalledTimes(1);
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
    vi.spyOn(RefreshToken, 'findAll').mockResolvedValue([]);
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

  it('allows deleting a staff user with a custom role whose baseRole is customer', async () => {
    const mockCustomRoleUser = {
      id: 'custom-role-user-id',
      email: 'custom_role@example.com',
      role: 'customer',
      roles: [{ slug: 'testing', baseRole: 'customer' }],
      setRoles: vi.fn().mockResolvedValue(true),
      destroy: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(User, 'findByPk').mockResolvedValue(mockCustomRoleUser);
    vi.spyOn(Order, 'count').mockResolvedValue(0);
    vi.spyOn(RefreshToken, 'findAll').mockResolvedValue([]);
    vi.spyOn(RefreshToken, 'update').mockResolvedValue([1]);
    vi.spyOn(AuditService, 'log').mockResolvedValue(true);

    const result = await AdminService.deleteStaffUser('custom-role-user-id', superAdminCaller);
    expect(result).toEqual({ id: 'custom-role-user-id', email: 'custom_role@example.com' });
    expect(mockCustomRoleUser.destroy).toHaveBeenCalledTimes(1);
  });

  it('rejects with 400 if attempting to delete a customer user from Access Control', async () => {
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      id: 'customer-user-id',
      email: 'customer@example.com',
      role: 'customer',
      roles: [{ slug: 'customer', baseRole: 'customer' }],
    });

    await expect(
      AdminService.deleteStaffUser('customer-user-id', superAdminCaller)
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      message: expect.stringContaining('Customer accounts cannot be deleted'),
    });
  });
});

describe('AdminService.createStaffUser recreation & edge cases', () => {
  const superAdminCaller = {
    id: 'super-admin-caller-id',
    role: 'super_admin',
  };

  const adminCaller = {
    id: 'admin-caller-id',
    role: 'admin',
  };

  const mockRole = {
    id: 'role-manager-id',
    name: 'Manager',
    slug: 'manager',
    baseRole: 'admin',
    isActive: true,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    db.sequelize.transaction = vi.fn().mockImplementation(async (callback) => callback({}));
    const { Role } = db;
    if (Role) {
      vi.spyOn(Role, 'findByPk').mockResolvedValue(mockRole);
    }
  });

  it('rejects with 409 if user with email is currently an active customer', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue({
      id: 'active-customer-id',
      email: 'cust@example.com',
      role: 'customer',
      deletedAt: null,
    });

    await expect(
      AdminService.createStaffUser(
        {
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'cust@example.com',
          password: 'Password123!',
          roleId: mockRole.id,
        },
        superAdminCaller
      )
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
      message: expect.stringContaining('active customer account'),
    });
  });

  it('rejects with 409 if user with email is currently an active staff member', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue({
      id: 'active-staff-id',
      email: 'staff@example.com',
      role: 'admin',
      deletedAt: null,
    });

    await expect(
      AdminService.createStaffUser(
        {
          firstName: 'Bob',
          lastName: 'Staff',
          email: 'staff@example.com',
          password: 'Password123!',
          roleId: mockRole.id,
        },
        superAdminCaller
      )
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      statusCode: 409,
      message: 'A user with this email already exists',
    });
  });

  it('rejects with 403 if non-super-admin tries to recreate a soft-deleted super admin account', async () => {
    vi.spyOn(User, 'findOne').mockResolvedValue({
      id: 'former-super-admin-id',
      email: 'former_sa@example.com',
      role: 'super_admin',
      deletedAt: new Date(),
    });

    await expect(
      AdminService.createStaffUser(
        {
          firstName: 'Former',
          lastName: 'Super',
          email: 'former_sa@example.com',
          password: 'Password123!',
          roleId: mockRole.id,
        },
        adminCaller
      )
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'Only super admins can recreate super admin accounts',
    });
  });

  it('successfully restores and recreates a soft-deleted staff user', async () => {
    const mockSoftDeletedUser = {
      id: 'deleted-staff-id',
      email: 'recreated_staff@example.com',
      role: 'admin',
      deletedAt: new Date(),
      restore: vi.fn().mockResolvedValue(true),
      save: vi.fn().mockResolvedValue(true),
      setRoles: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(User, 'findOne').mockResolvedValue(mockSoftDeletedUser);
    vi.spyOn(User, 'findByPk').mockResolvedValue({
      ...mockSoftDeletedUser,
      deletedAt: null,
      firstName: 'Recreated',
      lastName: 'User',
      roles: [mockRole],
    });
    const tokenUpdateSpy = vi.spyOn(RefreshToken, 'update').mockResolvedValue([1]);
    vi.spyOn(RefreshToken, 'findAll').mockResolvedValue([]);
    const auditSpy = vi.spyOn(AuditService, 'log').mockResolvedValue(true);

    const result = await AdminService.createStaffUser(
      {
        firstName: 'Recreated',
        lastName: 'User',
        email: 'recreated_staff@example.com',
        password: 'NewSecurePassword123!',
        roleId: mockRole.id,
      },
      superAdminCaller
    );

    expect(mockSoftDeletedUser.restore).toHaveBeenCalledTimes(1);
    expect(mockSoftDeletedUser.save).toHaveBeenCalledTimes(1);
    expect(mockSoftDeletedUser.firstName).toBe('Recreated');
    expect(mockSoftDeletedUser.lastName).toBe('User');
    expect(mockSoftDeletedUser.status).toBe('active');
    expect(mockSoftDeletedUser.emailVerified).toBe(true);
    expect(mockSoftDeletedUser.setRoles).toHaveBeenCalledWith([mockRole], expect.any(Object));
    expect(tokenUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: expect.any(Date) }),
      expect.objectContaining({ where: { userId: 'deleted-staff-id', revokedAt: null } })
    );
    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        changes: expect.objectContaining({ recreated: true }),
      }),
      expect.any(Object)
    );
    expect(result).toHaveProperty('id', 'deleted-staff-id');
  });
});
