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

const unique = (items = []) => [...new Set(items.filter(Boolean))];

const getRolesForUser = (user) => {
  const safeUser = user || {};

  if (Array.isArray(safeUser.roles) && safeUser.roles.length) {
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

  if (Array.isArray(role.permissions) && role.permissions.length) {
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

  if (Array.isArray(safeUser.permissions) && safeUser.permissions.length) {
    return unique(safeUser.permissions);
  }

  if (Array.isArray(safeUser.roles) && safeUser.roles.length) {
    return unique(
      safeUser.roles.flatMap((role) =>
        typeof role === 'string' ? getPermissionsForRole(role) : getPermissionKeysFromRoleObject(role)
      )
    );
  }

  return unique(getRolesForUser(safeUser).flatMap((role) => getPermissionsForRole(role)));
};

const enrichUserAuthorization = (user) => {
  const plainUser = typeof user?.toJSON === 'function' ? user.toJSON() : { ...(user || {}) };

  return {
    ...plainUser,
    roles: getRolesForUser(plainUser),
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