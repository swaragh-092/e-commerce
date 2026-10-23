'use strict';

const { ROLES } = require('./constants');
const authorizationSchema = require('../../../shared/authorization.json');

const PERMISSIONS = Object.freeze({ ...authorizationSchema.permissions });

const SYSTEM_ROLE_DEFINITIONS = Object.freeze({ ...authorizationSchema.systemRoleDefinitions });

const ADMIN_PERMISSIONS = [...authorizationSchema.adminPermissionKeys];

const CUSTOMER_PERMISSIONS = [...authorizationSchema.customerPermissionKeys];

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.CUSTOMER]: CUSTOMER_PERMISSIONS,
  [ROLES.ADMIN]: ADMIN_PERMISSIONS,
  [ROLES.SUPER_ADMIN]: [...new Set([
    ...Object.values(PERMISSIONS),
    ...ADMIN_PERMISSIONS,
    ...CUSTOMER_PERMISSIONS,
  ])],
});

const RESERVED_SUPER_ADMIN_PERMISSIONS = Object.freeze([...authorizationSchema.reservedSuperAdminPermissions]);

const IMPLIES = Object.freeze(authorizationSchema.implies || {});

const unique = (items = []) => [...new Set(items.filter(Boolean))];

const expandImplied = (permissions) => {
  const expanded = new Set(permissions);
  for (const perm of permissions) {
    const implied = IMPLIES[perm];
    if (implied) implied.forEach((p) => expanded.add(p));
  }
  return [...expanded];
};

const getRolesForUser = (user) => {
  const safeUser = user || {};

  if (Array.isArray(safeUser.roles)) {
    return unique(
      safeUser.roles
        .map((role) => (typeof role === 'string' ? role : role?.slug || role?.name || role?.role))
        .filter(Boolean)
    );
  }

  return safeUser.role ? [safeUser.role] : [];
};

const getPermissionsForRole = (role) => unique(ROLE_PERMISSIONS[role] || []);

const getPermissionKeysFromRoleObject = (role) => {
  if (!role || typeof role !== 'object') {
    return [];
  }

  // A persisted custom role with no permissions must stay empty. Falling back
  // to its base role would silently grant every default admin permission.
  if (Array.isArray(role.permissions)) {
    return unique(
      role.permissions
        .map((permission) => (typeof permission === 'string' ? permission : permission?.key))
        .filter(Boolean)
    );
  }

  const roleKey = role.slug || role.key || role.name || role.role;
  return getPermissionsForRole(roleKey);
};

const getPermissionsForUser = (user) => {
  const safeUser = user || {};

  if (Array.isArray(safeUser.permissions)) {
    return expandImplied(unique(safeUser.permissions));
  }

  if (Array.isArray(safeUser.roles)) {
    return expandImplied(unique(
      safeUser.roles.flatMap((role) =>
        typeof role === 'string' ? getPermissionsForRole(role) : getPermissionKeysFromRoleObject(role)
      )
    ));
  }

  return expandImplied(unique(getRolesForUser(safeUser).flatMap((role) => getPermissionsForRole(role))));
};

const enrichUserAuthorization = (user) => {
  const plainUser = typeof user?.toJSON === 'function' ? user.toJSON() : { ...(user || {}) };
  const userRoles = getRolesForUser(plainUser);

  return {
    ...plainUser,
    role: userRoles[0] || plainUser.role,
    roles: userRoles,
    permissions: getPermissionsForUser(plainUser),
  };
};

const getSystemRoles = () =>
  Object.values(SYSTEM_ROLE_DEFINITIONS).map((role) => ({
    ...role,
    permissions: getPermissionsForRole(role.key),
  }));

module.exports = {
  PERMISSIONS,
  SYSTEM_ROLE_DEFINITIONS,
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
};
