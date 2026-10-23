import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const AdminService = require('../../src/modules/admin/admin.service');
const SettingsService = require('../../src/modules/settings/settings.service');
const AuditService = require('../../src/modules/audit/audit.service');
const {
  PERMISSIONS,
  ADMIN_PERMISSIONS,
  getPermissionsForUser,
  getPermissionKeysFromRoleObject,
  enrichUserAuthorization,
} = require('../../src/config/permissions');
const { ROLES } = require('../../src/config/constants');
const { authorizePermissions, authorizeAnyPermission } = require('../../src/middleware/role.middleware');
const apiBuilderRouter = require('../../src/modules/apiBuilder/apiBuilder.routes');
const menuRouter = require('../../src/modules/menu/menu.routes');
const adminRouter = require('../../src/modules/admin/admin.routes');

describe('Access Control & RBAC Enforcement Suite', () => {
  const mockPermissionsList = [
    { id: 'perm-products-read', key: PERMISSIONS.PRODUCTS_READ, name: 'Products Read', group: 'products' },
    { id: 'perm-products-update', key: PERMISSIONS.PRODUCTS_UPDATE, name: 'Products Update', group: 'products' },
    { id: 'perm-roles-read', key: PERMISSIONS.ROLES_READ, name: 'Roles Read', group: 'access_control' },
    { id: 'perm-roles-manage', key: PERMISSIONS.ROLES_MANAGE, name: 'Roles Manage', group: 'access_control' },
    { id: 'perm-system-roles', key: PERMISSIONS.SYSTEM_ROLES_MANAGE, name: 'System Roles Manage', group: 'access_control' },
    { id: 'perm-assign-roles', key: PERMISSIONS.USERS_ASSIGN_ROLES, name: 'Assign Roles', group: 'access_control' },
    { id: 'perm-settings-manage', key: PERMISSIONS.SETTINGS_MANAGE, name: 'Settings Manage', group: 'settings' },
    { id: 'perm-api-read', key: PERMISSIONS.API_BUILDER_READ, name: 'API Read', group: 'api_builder' },
    { id: 'perm-api-manage', key: PERMISSIONS.API_BUILDER_MANAGE, name: 'API Manage', group: 'api_builder' },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    if (AuditService && AuditService.log) {
      vi.spyOn(AuditService, 'log').mockResolvedValue(true);
    }
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (cb) => cb({
      LOCK: { UPDATE: 'UPDATE' },
    }));
    vi.spyOn(db.Permission, 'findAll').mockImplementation(async (opts = {}) => {
      if (opts?.where?.id) {
        const ids = Array.isArray(opts.where.id) ? opts.where.id : [opts.where.id];
        return mockPermissionsList.filter((p) => ids.includes(p.id));
      }
      return mockPermissionsList;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Privilege Escalation Prevention', () => {
    const superAdminUser = {
      id: 'super-admin-uuid',
      role: ROLES.SUPER_ADMIN,
      roles: [ROLES.SUPER_ADMIN],
      permissions: Object.values(PERMISSIONS),
    };

    const regularAdminUser = {
      id: 'admin-uuid',
      role: ROLES.ADMIN,
      roles: [ROLES.ADMIN],
      permissions: ADMIN_PERMISSIONS,
    };

    const staffWithCustomRole = {
      id: 'staff-uuid',
      role: 'catalog_manager',
      roles: ['catalog_manager'],
      permissions: [PERMISSIONS.PRODUCTS_READ, PERMISSIONS.PRODUCTS_UPDATE, PERMISSIONS.ROLES_MANAGE],
    };

    it('rejects non-superadmin creating a role with super_admin baseRole', async () => {
      await expect(
        AdminService.createAccessRole(
          {
            name: 'Escalated Role',
            baseRole: ROLES.SUPER_ADMIN,
            permissionIds: [],
          },
          staffWithCustomRole
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Only super admins can create roles with super admin base role',
      });
    });

    it('rejects non-superadmin granting permissions they do not possess', async () => {
      // staffWithCustomRole does not possess settings.manage
      await expect(
        AdminService.createAccessRole(
          {
            name: 'Sneaky Settings Role',
            baseRole: ROLES.ADMIN,
            permissionIds: ['perm-settings-manage'],
          },
          staffWithCustomRole
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You cannot grant permissions you do not possess',
      });
    });

    it('rejects assigning reserved superadmin permissions to custom roles', async () => {
      await expect(
        AdminService.createAccessRole(
          {
            name: 'Illegal System Manager',
            baseRole: ROLES.ADMIN,
            permissionIds: ['perm-system-roles'],
          },
          superAdminUser
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Reserved super admin permissions cannot be assigned to custom roles',
      });
    });

    it('rejects non-superadmin updating an existing role with unpossessed permissions', async () => {
      const mockCustomRole = {
        id: 'role-123',
        name: 'Existing Custom Role',
        slug: 'existing-custom',
        baseRole: ROLES.ADMIN,
        isSystem: false,
        permissions: [],
        setPermissions: vi.fn(),
        update: vi.fn(),
      };
      vi.spyOn(db.Role, 'findByPk').mockResolvedValue(mockCustomRole);

      await expect(
        AdminService.updateAccessRole(
          mockCustomRole.id,
          { permissionIds: ['perm-settings-manage'] },
          staffWithCustomRole
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'You cannot grant permissions you do not possess',
      });
    });

    it('rejects non-superadmin editing system roles', async () => {
      const mockSystemRole = {
        id: 'system-admin-role-id',
        name: 'Admin',
        slug: ROLES.ADMIN,
        baseRole: ROLES.ADMIN,
        isSystem: true,
        permissions: [],
      };
      vi.spyOn(db.Role, 'findByPk').mockResolvedValue(mockSystemRole);

      await expect(
        AdminService.updateAccessRole(
          mockSystemRole.id,
          { description: 'Altered description' },
          staffWithCustomRole
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Only super admins can edit system roles',
      });
    });

    it('rejects non-superadmin modifying a superadmin user account', async () => {
      const mockSuperAdminUser = {
        id: 'target-superadmin-id',
        role: ROLES.SUPER_ADMIN,
        roles: [{ slug: ROLES.SUPER_ADMIN, baseRole: ROLES.SUPER_ADMIN }],
      };
      vi.spyOn(db.User, 'findByPk').mockResolvedValue(mockSuperAdminUser);

      const mockTargetRole = {
        id: 'target-role-id',
        slug: 'custom-staff',
        baseRole: ROLES.ADMIN,
        isActive: true,
        permissions: [],
      };
      vi.spyOn(db.Role, 'findByPk').mockResolvedValue(mockTargetRole);

      await expect(
        AdminService.updateUserRole(
          mockSuperAdminUser.id,
          mockTargetRole.id,
          staffWithCustomRole
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Only super admins can change super admin accounts',
      });
    });

    it('rejects non-superadmin deleting a superadmin user account', async () => {
      const mockSuperAdminUser = {
        id: 'target-superadmin-id',
        role: ROLES.SUPER_ADMIN,
        roles: [{ slug: ROLES.SUPER_ADMIN, baseRole: ROLES.SUPER_ADMIN }],
      };
      vi.spyOn(db.User, 'findByPk').mockResolvedValue(mockSuperAdminUser);

      await expect(
        AdminService.deleteStaffUser(
          mockSuperAdminUser.id,
          staffWithCustomRole
        )
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Only super admins can delete super admin accounts',
      });
    });

    it('rejects non-superadmin modifying platform features or store mode', async () => {
      await expect(
        SettingsService.updateKey('reviews', false, 'features', regularAdminUser.id, regularAdminUser)
      ).rejects.toMatchObject({
        code: 'SUPERADMIN_REQUIRED',
        statusCode: 403,
      });

      await expect(
        SettingsService.updateKey('mode', 'catalog', 'general', regularAdminUser.id, regularAdminUser)
      ).rejects.toMatchObject({
        code: 'SUPERADMIN_REQUIRED',
        statusCode: 403,
      });
    });
  });

  describe('2. Role Creation & Staff Assignment Boundaries', () => {
    it('requires explicit USERS_ASSIGN_ROLES for staff assignment endpoints', () => {
      const routes = adminRouter.stack
        .filter((layer) => layer.route)
        .map((layer) => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods),
        }));

      const usersRoute = routes.find((r) => r.path === '/access-control/users');
      expect(usersRoute).toBeDefined();

      const userRoleRoute = routes.find((r) => r.path === '/access-control/users/:id/role');
      expect(userRoleRoute).toBeDefined();
    });

    it('does not silently include USERS_ASSIGN_ROLES in default admin permissions', () => {
      expect(ADMIN_PERMISSIONS).not.toContain(PERMISSIONS.USERS_ASSIGN_ROLES);
    });

    it('allows an authorized admin to create a role with a subset of possessed permissions', async () => {
      const authorizedStaff = {
        id: 'authorized-staff-uuid',
        role: 'operations_manager',
        roles: ['operations_manager'],
        permissions: [PERMISSIONS.PRODUCTS_READ, PERMISSIONS.PRODUCTS_UPDATE, PERMISSIONS.ROLES_MANAGE],
      };

      vi.spyOn(db.Role, 'findOne').mockResolvedValue(null);
      const createdInstance = {
        id: 'new-role-uuid',
        name: 'Catalog Viewer',
        slug: 'catalog-viewer',
        baseRole: ROLES.ADMIN,
        isSystem: false,
        isActive: true,
        permissions: [{ id: 'perm-products-read', key: PERMISSIONS.PRODUCTS_READ }],
        setPermissions: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(db.Role, 'create').mockResolvedValue(createdInstance);
      vi.spyOn(db.Role, 'findByPk').mockResolvedValue(createdInstance);

      const createdRole = await AdminService.createAccessRole(
        {
          name: 'Catalog Viewer',
          description: 'Custom catalog viewer',
          baseRole: ROLES.ADMIN,
          permissionIds: ['perm-products-read'],
        },
        authorizedStaff
      );

      expect(createdRole).toBeDefined();
      expect(createdRole.name).toBe('Catalog Viewer');
      expect(createdRole.permissions).toHaveLength(1);
      expect(createdRole.permissions[0].key).toBe(PERMISSIONS.PRODUCTS_READ);
    });
  });

  describe('3. Empty Roles: Zero Permissions Grants Zero Access', () => {
    it('ensures getPermissionsForUser returns empty array when permissions array is empty', () => {
      const userWithZeroPermissions = {
        id: 'zero-user-1',
        role: ROLES.ADMIN, // baseRole column is admin
        permissions: [],
      };

      const perms = getPermissionsForUser(userWithZeroPermissions);
      expect(perms).toEqual([]);
      expect(perms).not.toContain(PERMISSIONS.DASHBOARD_VIEW);
      expect(perms).not.toContain(PERMISSIONS.PRODUCTS_READ);
    });

    it('ensures getPermissionsForUser returns empty array when roles array is empty', () => {
      const userWithNoRoles = {
        id: 'no-roles-user',
        role: ROLES.ADMIN,
        roles: [],
      };

      const perms = getPermissionsForUser(userWithNoRoles);
      expect(perms).toEqual([]);
    });

    it('ensures getPermissionsForUser returns empty array for custom role with zero permissions', () => {
      const userWithEmptyCustomRole = {
        id: 'custom-zero-user',
        role: ROLES.ADMIN,
        roles: [
          {
            id: 'custom-role-uuid',
            slug: 'custom_zero_role',
            name: 'Custom Zero Role',
            baseRole: ROLES.ADMIN,
            permissions: [],
          },
        ],
      };

      const perms = getPermissionsForUser(userWithEmptyCustomRole);
      expect(perms).toEqual([]);
    });

    it('ensures getPermissionKeysFromRoleObject returns empty array for zero-permission role object', () => {
      const emptyRole = {
        id: 'empty-role-id',
        slug: 'empty_role',
        baseRole: 'admin',
        permissions: [],
      };

      expect(getPermissionKeysFromRoleObject(emptyRole)).toEqual([]);
    });

    it('blocks zero-permission user via authorizePermissions middleware with 403', () => {
      const zeroUser = {
        id: 'zero-user-id',
        role: 'empty_custom_role',
        roles: ['empty_custom_role'],
        permissions: [],
      };

      const req = { user: zeroUser };
      const res = {};
      let nextError = null;
      const next = (err) => { nextError = err; };

      const middleware = authorizePermissions(PERMISSIONS.DASHBOARD_VIEW);
      middleware(req, res, next);

      expect(nextError).toBeDefined();
      expect(nextError.statusCode).toBe(403);
    });

    it('blocks zero-permission user via authorizeAnyPermission middleware with 403', () => {
      const zeroUser = {
        id: 'zero-user-id',
        role: 'empty_custom_role',
        roles: ['empty_custom_role'],
        permissions: [],
      };

      const req = { user: zeroUser };
      const res = {};
      let nextError = null;
      const next = (err) => { nextError = err; };

      const middleware = authorizeAnyPermission(PERMISSIONS.PRODUCTS_READ, PERMISSIONS.PRODUCTS_UPDATE);
      middleware(req, res, next);

      expect(nextError).toBeDefined();
      expect(nextError.statusCode).toBe(403);
    });

    it('allows creating a custom role with zero permissions', async () => {
      const superAdmin = {
        id: 'super-admin-uuid',
        role: ROLES.SUPER_ADMIN,
        roles: [ROLES.SUPER_ADMIN],
        permissions: Object.values(PERMISSIONS),
      };

      vi.spyOn(db.Role, 'findOne').mockResolvedValue(null);
      const emptyInstance = {
        id: 'empty-role-uuid',
        name: 'Zero Access Role',
        slug: 'zero-access-role',
        baseRole: ROLES.ADMIN,
        isSystem: false,
        isActive: true,
        permissions: [],
        setPermissions: vi.fn().mockResolvedValue(true),
      };
      vi.spyOn(db.Role, 'create').mockResolvedValue(emptyInstance);
      vi.spyOn(db.Role, 'findByPk').mockResolvedValue(emptyInstance);

      const emptyRole = await AdminService.createAccessRole(
        {
          name: 'Zero Access Role',
          description: 'A role with zero permissions',
          baseRole: ROLES.ADMIN,
          permissionIds: [],
        },
        superAdmin
      );

      expect(emptyRole).toBeDefined();
      expect(emptyRole.permissions).toEqual([]);

      // Verify enriched authorization for a user with this empty role
      const user = {
        id: 'test-user',
        roles: [emptyRole],
      };
      const enriched = enrichUserAuthorization(user);
      expect(enriched.permissions).toEqual([]);
    });
  });

  describe('4. Menu Builder Permissions', () => {
    it('does not include menus.read or menus.manage in default admin permissions', () => {
      expect(ADMIN_PERMISSIONS).not.toContain(PERMISSIONS.MENUS_READ);
      expect(ADMIN_PERMISSIONS).not.toContain(PERMISSIONS.MENUS_MANAGE);
    });

    it('includes menus.read and menus.manage for superadmin', () => {
      const superAdminPerms = getPermissionsForUser({ role: ROLES.SUPER_ADMIN });
      expect(superAdminPerms).toContain(PERMISSIONS.MENUS_READ);
      expect(superAdminPerms).toContain(PERMISSIONS.MENUS_MANAGE);
    });

    it('guards admin menu routes with distinct read and manage permissions', () => {
      const routes = menuRouter.stack
        .filter((l) => l.route)
        .map((l) => ({
          path: l.route.path,
          methods: Object.keys(l.route.methods),
        }));

      // Public routes are present
      expect(routes.some((r) => r.path === '/public/:location')).toBe(true);
      expect(routes.some((r) => r.path === '/slug/public/:slug')).toBe(true);

      // Admin routes are present
      expect(routes.some((r) => r.path === '/')).toBe(true);
      expect(routes.some((r) => r.path === '/:id')).toBe(true);
    });
  });

  describe('5. API Builder Permissions', () => {
    it('defines distinct api_builder.read and api_builder.manage permissions', () => {
      expect(PERMISSIONS.API_BUILDER_READ).toBe('api_builder.read');
      expect(PERMISSIONS.API_BUILDER_MANAGE).toBe('api_builder.manage');
    });

    it('does not include api_builder.read or api_builder.manage in default admin permissions', () => {
      expect(ADMIN_PERMISSIONS).not.toContain(PERMISSIONS.API_BUILDER_READ);
      expect(ADMIN_PERMISSIONS).not.toContain(PERMISSIONS.API_BUILDER_MANAGE);
    });

    it('includes api_builder.read and api_builder.manage for superadmin', () => {
      const superAdminPerms = getPermissionsForUser({ role: ROLES.SUPER_ADMIN });
      expect(superAdminPerms).toContain(PERMISSIONS.API_BUILDER_READ);
      expect(superAdminPerms).toContain(PERMISSIONS.API_BUILDER_MANAGE);
    });

    it('guards API Builder admin endpoints with api_builder permissions and leaves /public/:slug public', () => {
      const routes = apiBuilderRouter.stack
        .filter((l) => l.route)
        .map((l) => ({
          path: l.route.path,
          methods: Object.keys(l.route.methods),
        }));

      // Public endpoint
      const publicRoute = routes.find((r) => r.path === '/public/:slug');
      expect(publicRoute).toBeDefined();
      expect(publicRoute.methods).toContain('get');

      // Admin CRUD endpoints
      expect(routes.some((r) => r.path === '/' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/' && r.methods.includes('post'))).toBe(true);

      expect(routes.some((r) => r.path === '/:id' && r.methods.includes('get'))).toBe(true);
      expect(routes.some((r) => r.path === '/:id' && r.methods.includes('put'))).toBe(true);
      expect(routes.some((r) => r.path === '/:id' && r.methods.includes('delete'))).toBe(true);
    });

    it('blocks staff without api_builder.read from API Builder list', () => {
      const userWithoutApiBuilder = {
        id: 'no-api-builder',
        role: ROLES.ADMIN,
        roles: [ROLES.ADMIN],
        permissions: ADMIN_PERMISSIONS, // Does not contain api_builder.read
      };

      const req = { user: userWithoutApiBuilder };
      const res = {};
      let nextError = null;
      const next = (err) => { nextError = err; };

      const middleware = authorizeAnyPermission(PERMISSIONS.API_BUILDER_READ, PERMISSIONS.API_BUILDER_MANAGE);
      middleware(req, res, next);

      expect(nextError).toBeDefined();
      expect(nextError.statusCode).toBe(403);
    });

    it('allows staff with api_builder.read to access API Builder read middleware', () => {
      const userWithApiBuilderRead = {
        id: 'api-builder-reader',
        role: 'api_viewer',
        roles: ['api_viewer'],
        permissions: [PERMISSIONS.API_BUILDER_READ],
      };

      const req = { user: userWithApiBuilderRead };
      const res = {};
      let calledNext = false;
      let nextError = null;
      const next = (err) => {
        calledNext = true;
        nextError = err;
      };

      const middleware = authorizeAnyPermission(PERMISSIONS.API_BUILDER_READ, PERMISSIONS.API_BUILDER_MANAGE);
      middleware(req, res, next);

      expect(calledNext).toBe(true);
      expect(nextError).toBeUndefined();
    });

    it('blocks staff with only api_builder.read from API Builder write operations', () => {
      const userWithApiBuilderRead = {
        id: 'api-builder-reader',
        role: 'api_viewer',
        roles: ['api_viewer'],
        permissions: [PERMISSIONS.API_BUILDER_READ],
      };

      const req = { user: userWithApiBuilderRead };
      const res = {};
      let nextError = null;
      const next = (err) => { nextError = err; };

      const middleware = authorizePermissions(PERMISSIONS.API_BUILDER_MANAGE);
      middleware(req, res, next);

      expect(nextError).toBeDefined();
      expect(nextError.statusCode).toBe(403);
    });
  });
});
