import { describe, it, expect } from 'vitest';

import authorizationSchema from '../../../shared/authorization.json';
import {
  PERMISSIONS,
  ADMIN_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  ROLE_PERMISSIONS,
  RESERVED_SUPER_ADMIN_PERMISSIONS,
  getRolesForUser,
  getPermissionsForRole,
  getPermissionsForUser,
  getPermissionKeysFromRoleObject,
  enrichUserAuthorization,
  getSystemRoles,
} from '../../src/config/permissions';
import { ROLES } from '../../src/config/constants';

describe('permissions config', () => {
  it('stays in sync with the shared authorization schema', () => {
    expect(PERMISSIONS).toEqual(authorizationSchema.permissions);
    expect(ADMIN_PERMISSIONS).toEqual(authorizationSchema.adminPermissionKeys);
    expect(CUSTOMER_PERMISSIONS).toEqual(authorizationSchema.customerPermissionKeys);
    expect(RESERVED_SUPER_ADMIN_PERMISSIONS).toEqual(authorizationSchema.reservedSuperAdminPermissions);
  });

  it('derives roles from mixed role shapes without duplicates', () => {
    const user = {
      role: ROLES.CUSTOMER,
      roles: [
        ROLES.ADMIN,
        { slug: ROLES.ADMIN },
        { name: ROLES.SUPER_ADMIN },
        { role: ROLES.CUSTOMER },
      ],
    };

    expect(getRolesForUser(user)).toEqual([
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
      ROLES.CUSTOMER,
    ]);
  });

  it('resolves permission keys from role objects and users', () => {
    const roleObject = {
      slug: ROLES.ADMIN,
      permissions: [
        { key: PERMISSIONS.PRODUCTS_READ },
        { key: PERMISSIONS.PRODUCTS_UPDATE },
        PERMISSIONS.PRODUCTS_UPDATE,
      ],
    };

    expect(getPermissionKeysFromRoleObject(roleObject)).toEqual([
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_UPDATE,
    ]);

    const user = {
      roles: [roleObject, { slug: ROLES.CUSTOMER }],
    };

    expect(getPermissionsForUser(user)).toEqual([
      PERMISSIONS.PRODUCTS_READ,
      PERMISSIONS.PRODUCTS_UPDATE,
      ...CUSTOMER_PERMISSIONS.filter(
        (permission) => ![PERMISSIONS.PRODUCTS_READ, PERMISSIONS.PRODUCTS_UPDATE].includes(permission)
      ),
    ]);
  });

  it('keeps super admin role permissions comprehensive', () => {
    const superAdminPermissions = getPermissionsForRole(ROLES.SUPER_ADMIN);

    expect(superAdminPermissions).toEqual(ROLE_PERMISSIONS[ROLES.SUPER_ADMIN]);
    Object.values(PERMISSIONS).forEach((permission) => {
      expect(superAdminPermissions).toContain(permission);
    });
    ADMIN_PERMISSIONS.forEach((permission) => {
      expect(superAdminPermissions).toContain(permission);
    });
    CUSTOMER_PERMISSIONS.forEach((permission) => {
      expect(superAdminPermissions).toContain(permission);
    });
  });

  it('enriches plain and model-like users with roles and permissions', () => {
    const modelLikeUser = {
      toJSON: () => ({
        id: 'user-1',
        role: ROLES.ADMIN,
      }),
    };

    expect(enrichUserAuthorization(modelLikeUser)).toEqual({
      id: 'user-1',
      role: ROLES.ADMIN,
      roles: [ROLES.ADMIN],
      permissions: ADMIN_PERMISSIONS,
    });
  });

  it('returns system roles with resolved permission sets', () => {
    const systemRoles = getSystemRoles();

    expect(systemRoles).toHaveLength(Object.keys(authorizationSchema.systemRoleDefinitions).length);
    systemRoles.forEach((role) => {
      expect(role.permissions).toEqual(getPermissionsForRole(role.key));
    });
  });
});
