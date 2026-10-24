import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const userRouter = require('../../src/modules/user/user.routes');
const { authorizePermissions } = require('../../src/middleware/role.middleware');
const {
  getPermissionsForUser,
  getPermissionsForRole,
  PERMISSIONS,
  RESERVED_SUPER_ADMIN_PERMISSIONS,
} = require('../../src/config/permissions');
const { ROLES } = require('../../src/config/constants');

describe('Session bootstrap (/users/me)', () => {
  it('does not gate GET /me behind a grantable permission so custom roles can load', () => {
    const routes = userRouter.stack
      .filter((layer) => layer.route)
      .map((layer) => ({
        path: layer.route.path,
        methods: Object.keys(layer.route.methods),
        middlewareCount: layer.route.stack.length,
      }));

    const getMe = routes.find((route) => route.path === '/me' && route.methods.includes('get'));
    // authenticate + getMe controller only — no authorizePermissions layer.
    expect(getMe?.middlewareCount).toBe(2);

    // Self-service mutations still carry the account.self gate (3+ layers).
    const getAddresses = routes.find((route) => route.path === '/me/addresses' && route.methods.includes('get'));
    expect(getAddresses?.middlewareCount).toBeGreaterThanOrEqual(3);
  });
});

describe('Super Admin permission resolution', () => {
  it('resolves super-admin grants from the role instead of a blanket grant', () => {
    // A super-admin whose persisted role only retains a subset of permissions
    // must be restricted to that subset (permission switches apply).
    const restricted = getPermissionsForUser({
      roles: [{ slug: ROLES.SUPER_ADMIN, permissions: [{ key: PERMISSIONS.PRODUCTS_READ }] }],
    });
    expect(restricted).toEqual([PERMISSIONS.PRODUCTS_READ]);
  });

  it('keeps the reserved system_roles.manage grant for super admin', () => {
    const reserved = getPermissionsForUser({
      roles: [{
        slug: ROLES.SUPER_ADMIN,
        permissions: RESERVED_SUPER_ADMIN_PERMISSIONS.map((key) => ({ key })),
      }],
    });
    RESERVED_SUPER_ADMIN_PERMISSIONS.forEach((permission) => {
      expect(reserved).toContain(permission);
    });
  });

  it('falls back to the full super-admin role set when grants are not loaded', () => {
    const permissions = getPermissionsForUser({ role: ROLES.SUPER_ADMIN });
    expect(permissions).toEqual(getPermissionsForRole(ROLES.SUPER_ADMIN));
    Object.values(PERMISSIONS).forEach((permission) => {
      expect(permissions).toContain(permission);
    });
  });
});

describe('authorizePermissions middleware', () => {
  const run = (user, permission) => {
    const req = { user };
    let error;
    let nextCalled = false;
    authorizePermissions(permission)(req, {}, (err) => {
      if (err) error = err;
      else nextCalled = true;
    });
    return { error, nextCalled };
  };

  it('no longer bypasses super admin when a required permission is missing', () => {
    const { error, nextCalled } = run({ role: ROLES.SUPER_ADMIN, permissions: [] }, PERMISSIONS.PRODUCTS_READ);
    expect(nextCalled).toBe(false);
    expect(error).toMatchObject({ statusCode: 403 });
  });

  it('allows super admin when the permission is granted', () => {
    const { error, nextCalled } = run(
      { role: ROLES.SUPER_ADMIN, permissions: [PERMISSIONS.PRODUCTS_READ] },
      PERMISSIONS.PRODUCTS_READ
    );
    expect(error).toBeUndefined();
    expect(nextCalled).toBe(true);
  });

  it('still enforces permissions for non-super-admin users', () => {
    const denied = run({ role: ROLES.CUSTOMER, permissions: [] }, PERMISSIONS.PRODUCTS_READ);
    expect(denied.nextCalled).toBe(false);
    expect(denied.error).toMatchObject({ statusCode: 403 });

    const allowed = run(
      { role: ROLES.ADMIN, permissions: [PERMISSIONS.PRODUCTS_READ] },
      PERMISSIONS.PRODUCTS_READ
    );
    expect(allowed.error).toBeUndefined();
    expect(allowed.nextCalled).toBe(true);
  });
});
