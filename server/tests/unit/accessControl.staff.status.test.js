import { beforeEach, describe, expect, it, vi } from 'vitest';

const AdminService = require('../../src/modules/admin/admin.service');
const db = require('../../src/modules/index');
const AuditService = require('../../src/modules/audit/audit.service');

describe('AdminService.updateStaffStatus', () => {
  const superAdmin = { id: 'root', role: 'super_admin' };
  const manager = { id: 'manager', role: 'admin', permissions: ['users.assign_roles'] };

  beforeEach(() => {
    vi.restoreAllMocks();
    db.sequelize.transaction = vi.fn(async (callback) => callback({}));
  });

  it('rejects self suspension and customer targets', async () => {
    await expect(AdminService.updateStaffStatus('manager', 'inactive', 'Security review', manager))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('own account') });

    vi.spyOn(db.User, 'findByPk').mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111', role: 'customer', roles: [{ slug: 'customer' }] });
    await expect(AdminService.updateStaffStatus('11111111-1111-4111-8111-111111111111', 'inactive', 'Security review', manager))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('Customers page') });
  });

  it('blocks a non-superadmin from suspending a superadmin', async () => {
    vi.spyOn(db.User, 'findByPk').mockResolvedValue({ id: 'target', role: 'super_admin', roles: [], status: 'active' });
    await expect(AdminService.updateStaffStatus('target', 'inactive', 'Security review', manager))
      .rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  });

  it('protects the last active superadmin', async () => {
    vi.spyOn(db.User, 'findByPk').mockResolvedValue({ id: 'target', role: 'super_admin', roles: [], status: 'active' });
    vi.spyOn(db.sequelize, 'query').mockResolvedValue([{ id: 'target' }]);
    await expect(AdminService.updateStaffStatus('target', 'inactive', 'Security review', superAdmin))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('last active super admin') });
  });

  it('reserves system admin status changes for superadmins', async () => {
    vi.spyOn(db.User, 'findByPk').mockResolvedValue({ id: 'target', role: 'admin', roles: [{ slug: 'admin' }], status: 'active' });
    await expect(AdminService.updateStaffStatus('target', 'inactive', 'Security review', manager))
      .rejects.toMatchObject({ code: 'FORBIDDEN', statusCode: 403 });
  });

  it('does not use reactivation to bypass a banned account', async () => {
    vi.spyOn(db.User, 'findByPk').mockResolvedValue({ id: 'target', role: 'admin', roles: [], status: 'banned' });
    await expect(AdminService.updateStaffStatus('target', 'active', 'Security review', superAdmin))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('Banned accounts') });
  });

  it('suspends staff, revokes sessions, and audits the reason and actor', async () => {
    const target = {
      id: 'staff', email: 'staff@example.test', firstName: 'Staff', lastName: 'Member',
      role: 'admin', status: 'active', roles: [{ id: 'role', slug: 'support', name: 'Support', baseRole: 'admin', permissions: [] }],
      update: vi.fn(async ({ status }) => { target.status = status; }),
      toJSON: () => ({ id: target.id, email: target.email, firstName: target.firstName, lastName: target.lastName, role: target.role, status: target.status, roles: target.roles }),
    };
    vi.spyOn(db.User, 'findByPk').mockResolvedValue(target);
    vi.spyOn(db.RefreshToken, 'findAll').mockResolvedValue([{ id: 'session-1' }]);
    const revokeSessions = vi.spyOn(db.RefreshToken, 'update').mockResolvedValue([1]);
    const audit = vi.spyOn(AuditService, 'log').mockResolvedValue(true);

    const result = await AdminService.updateStaffStatus('staff', 'inactive', '  Security review  ', manager);

    expect(result.status).toBe('inactive');
    expect(revokeSessions).toHaveBeenCalledWith(
      { revokedAt: expect.any(Date) },
      expect.objectContaining({ where: { userId: 'staff', revokedAt: null } })
    );
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'manager', action: 'STATUS_CHANGE', entityId: 'staff',
      changes: { status: { old: 'active', new: 'inactive' }, reason: 'Security review' },
    }), expect.any(Object));

    expect(db.User.findByPk).toHaveBeenCalledWith('staff', expect.objectContaining({
      lock: { level: 'UPDATE', of: db.User },
    }));
    revokeSessions.mockClear();
    const previousRoles = target.roles;
    const reactivated = await AdminService.updateStaffStatus('staff', 'active', 'Review completed', manager);
    expect(reactivated.status).toBe('active');
    expect(target.roles).toBe(previousRoles);
    expect(revokeSessions).not.toHaveBeenCalled();
  });
});
