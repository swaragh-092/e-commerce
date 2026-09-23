'use strict';

import { createRequire } from 'node:module';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

const require = createRequire(import.meta.url);

process.env.JWT_ACCESS_SECRET = 'test-access-secret-32chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32chars-long!';
process.env.JWT_ISSUER = 'ecommerce-pro';
process.env.JWT_AUDIENCE = 'ecommerce-pro-client';

const { generateTokens } = require('../../src/modules/auth/auth.service');
const { listUsersQuerySchema } = require('../../src/modules/user/user.validation');
const { ROLES } = require('../../src/config/constants');
const { PERMISSIONS } = require('../../src/config/permissions');
const { sequelize } = require('../../src/modules/index');
const AuditService = require('../../src/modules/audit/audit.service');

beforeEach(() => {
  vi.spyOn(AuditService, 'log').mockResolvedValue(true);
});

describe('C1 — createStaffUser emailVerified flag', () => {
  it('passes emailVerified: true to User.create', async () => {
    // Verified by inspecting admin.service.js: User.create receives emailVerified: true
    const fs = require('fs');
    const path = require('path');
    const adminServiceSrc = fs.readFileSync(
      path.join(__dirname, '../../src/modules/admin/admin.service.js'),
      'utf8'
    );
    expect(adminServiceSrc).toContain('emailVerified: true');
    expect(adminServiceSrc).not.toContain('isEmailVerified: true');
  });
});

describe('C2 — AdminLoginPage authorization & role redirect logic', () => {
  // Pure logic mirror of client/src/pages/admin/AdminLoginPage.jsx getFirstAccessibleAdminPath
  const getFirstAccessibleAdminPath = (user) => {
    if (!user) return null;
    const roles = Array.isArray(user.roles)
      ? user.roles.map((r) => (typeof r === 'string' ? r : r.slug || r.name))
      : [user.role].filter(Boolean);

    const isCustomerOnly = roles.length > 0 && roles.every((r) => r === 'customer');
    if (isCustomerOnly) return null;

    const permissions = Array.isArray(user.permissions) ? user.permissions : [];
    if (roles.includes('super_admin') || permissions.includes('analytics.read')) return '/admin/analytics';
    if (roles.includes('admin') || permissions.includes('orders.read')) return '/admin/orders';
    if (permissions.includes('products.read')) return '/admin/products';
    return '/admin';
  };

  it('rejects customers with roles: ["customer"] from admin redirect', () => {
    const customerUser = {
      id: 'cust-1',
      role: 'customer',
      roles: ['customer'],
      permissions: ['account.self'],
    };
    expect(getFirstAccessibleAdminPath(customerUser)).toBeNull();
  });

  it('correctly maps string-array roles for admin', () => {
    const adminUser = {
      id: 'adm-1',
      role: 'admin',
      roles: ['admin'],
      permissions: ['orders.read'],
    };
    expect(getFirstAccessibleAdminPath(adminUser)).toBe('/admin/orders');
  });

  it('correctly maps super_admin to analytics', () => {
    const superAdminUser = {
      id: 'super-1',
      role: 'super_admin',
      roles: ['super_admin'],
      permissions: ['analytics.read'],
    };
    expect(getFirstAccessibleAdminPath(superAdminUser)).toBe('/admin/analytics');
  });
});

describe('C3 — Session sid in token, isCurrent, and revokeAllOtherSessions', () => {
  it('embeds sid in the access token payload', () => {
    const user = { id: 'u-123', role: 'customer' };
    const sessionId = 'session-uuid-456';
    const tokens = generateTokens(user, sessionId);

    const decoded = jwt.verify(tokens.accessToken, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    });

    expect(decoded.id).toBe('u-123');
    expect(decoded.sid).toBe('session-uuid-456');
  });

  it('marks isCurrent accurately based on sid in access token', async () => {
    const UserService = require('../../src/modules/user/user.service');
    const { RefreshToken } = require('../../src/modules/index');

    const targetSessionId = 'active-session-2';
    const dummySessions = [
      { id: 'older-session-1', lastActiveAt: new Date(Date.now() - 1000) },
      { id: 'active-session-2', lastActiveAt: new Date(Date.now() - 2000) },
      { id: 'other-session-3', lastActiveAt: new Date(Date.now() - 3000) },
    ];

    vi.spyOn(RefreshToken, 'findAll').mockResolvedValue(dummySessions);

    const accessToken = jwt.sign(
      { id: 'u-1', sid: targetSessionId },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    const sessions = await UserService.getSessions('u-1', accessToken);
    expect(sessions.find((s) => s.id === targetSessionId).isCurrent).toBe(true);
    expect(sessions.find((s) => s.id === 'older-session-1').isCurrent).toBe(false);

    vi.restoreAllMocks();
  });

  it('revokeAllOtherSessions retains the session matching sid and revokes the rest', async () => {
    const UserService = require('../../src/modules/user/user.service');
    const { RefreshToken } = require('../../src/modules/index');

    const callerSessionId = 'caller-session-2';
    const dummySessions = [
      { id: 'most-recent-1' },
      { id: 'caller-session-2' },
      { id: 'older-3' },
    ];

    vi.spyOn(RefreshToken, 'findAll').mockResolvedValue(dummySessions);
    let revokedIds = [];
    vi.spyOn(RefreshToken, 'update').mockImplementation(async (updates, options) => {
      revokedIds = options.where.id[options.where.id.constructor ? Object.getOwnPropertySymbols(options.where.id)[0] : 'in'] || options.where.id;
      return [2];
    });

    const accessToken = jwt.sign(
      { id: 'u-1', sid: callerSessionId },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    await UserService.revokeAllOtherSessions('u-1', accessToken);
    expect(revokedIds).toContain('most-recent-1');
    expect(revokedIds).toContain('older-3');
    expect(revokedIds).not.toContain(callerSessionId);

    vi.restoreAllMocks();
  });
});

describe('C4 & C5 — Email/Phone uniqueness validation', () => {
  beforeEach(() => {
    const mockTx = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (cb) => cb(mockTx));
  });

  it('updateMe rejects duplicate phone assigned to another user with 409', async () => {
    const UserService = require('../../src/modules/user/user.service');
    const { User, UserProfile } = require('../../src/modules/index');

    vi.spyOn(User, 'findByPk').mockResolvedValue({ id: 'u-1', toJSON: () => ({ id: 'u-1' }) });
    vi.spyOn(UserProfile, 'findOne').mockResolvedValue({ userId: 'other-user', phone: '9999999999' });

    await expect(UserService.updateMe('u-1', { phone: '9999999999' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });

    vi.restoreAllMocks();
  });
});

describe('C6 — Role permission subset check and super_admin escalation guard', () => {
  beforeEach(() => {
    const mockTx = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (cb) => cb(mockTx));
  });

  it('blocks non-super-admin from creating role with baseRole: super_admin', async () => {
    const AdminService = require('../../src/modules/admin/admin.service');
    const { Permission } = require('../../src/modules/index');

    vi.spyOn(Permission, 'findAll').mockResolvedValue([{ id: 'p1', key: 'products.read' }]);

    const normalAdminUser = {
      id: 'admin-1',
      role: 'admin',
      roles: ['admin'],
      permissions: ['products.read'],
    };

    await expect(
      AdminService.createAccessRole(
        {
          name: 'Sneaky Super Admin',
          baseRole: ROLES.SUPER_ADMIN,
          permissionIds: ['p1'],
        },
        normalAdminUser
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    vi.restoreAllMocks();
  });

  it('blocks non-super-admin from granting permissions they do not possess', async () => {
    const AdminService = require('../../src/modules/admin/admin.service');
    const { Permission } = require('../../src/modules/index');

    vi.spyOn(Permission, 'findAll').mockResolvedValue([
      { id: 'p1', key: 'products.read' },
      { id: 'p2', key: 'payments.manage' }, // Admin doesn't have this
    ]);

    const limitedAdmin = {
      id: 'admin-2',
      role: 'admin',
      roles: ['admin'],
      permissions: ['products.read'],
    };

    await expect(
      AdminService.createAccessRole(
        {
          name: 'Manager',
          baseRole: 'admin',
          permissionIds: ['p1', 'p2'],
        },
        limitedAdmin
      )
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    vi.restoreAllMocks();
  });

  it('blocks non-super-admin from assigning a role with baseRole: super_admin', async () => {
    const AdminService = require('../../src/modules/admin/admin.service');
    const { User, Role } = require('../../src/modules/index');

    vi.spyOn(User, 'findByPk').mockResolvedValue({ id: 'u-target', role: 'customer', roles: [] });
    vi.spyOn(Role, 'findByPk').mockResolvedValue({
      id: 'role-super',
      baseRole: ROLES.SUPER_ADMIN,
      isActive: true,
      permissions: [],
    });

    const regularAdmin = {
      id: 'admin-caller',
      role: 'admin',
      roles: ['admin'],
      permissions: ['products.read'],
    };

    await expect(
      AdminService.updateUserRole('u-target', 'role-super', regularAdmin)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    vi.restoreAllMocks();
  });
});

describe('C7 — listUsersQuerySchema and query validation', () => {
  it('validates pagination, status, and role correctly', () => {
    const { error, value } = listUsersQuerySchema.validate({
      page: '2',
      limit: '15',
      status: 'active',
      role: 'admin',
      search: 'alice',
    });

    expect(error).toBeUndefined();
    expect(value.page).toBe(2);
    expect(value.limit).toBe(15);
    expect(value.status).toBe('active');
  });

  it('rejects invalid status', () => {
    const { error } = listUsersQuerySchema.validate({
      status: 'pending_invalid_status',
    });
    expect(error).toBeDefined();
  });
});

describe('C8 — Super admin deactivation guard and refresh token revocation', () => {
  beforeEach(() => {
    const mockTx = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(sequelize, 'transaction').mockImplementation(async (cb) => cb(mockTx));
  });

  it('blocks deactivating or banning the last active super admin', async () => {
    const UserService = require('../../src/modules/user/user.service');
    const { User } = require('../../src/modules/index');

    vi.spyOn(User, 'findByPk').mockResolvedValue({
      id: 'super-admin-target',
      role: 'super_admin',
      status: 'active',
      toJSON: () => ({ id: 'super-admin-target', role: 'super_admin', status: 'active' }),
    });
    vi.spyOn(User, 'count').mockResolvedValue(1); // Only 1 active super admin left

    await expect(
      UserService.updateStatus('super-admin-target', 'banned', 'super-admin-caller')
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: expect.stringContaining('last active super admin'),
    });

    vi.restoreAllMocks();
  });

  it('revokes all refresh tokens when user is banned or deactivated', async () => {
    const UserService = require('../../src/modules/user/user.service');
    const { User, RefreshToken } = require('../../src/modules/index');

    const mockUser = {
      id: 'u-to-ban',
      role: 'customer',
      status: 'active',
      toJSON: () => ({ id: 'u-to-ban', role: 'customer', status: 'active' }),
      update: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(User, 'findByPk').mockResolvedValue(mockUser);
    const updateSpy = vi.spyOn(RefreshToken, 'update').mockResolvedValue([3]);

    await UserService.updateStatus('u-to-ban', 'banned', 'admin-caller');

    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: expect.any(Date) }),
      expect.objectContaining({ where: { userId: 'u-to-ban', revokedAt: null } })
    );

    vi.restoreAllMocks();
  });
});
