'use strict';

const { ROLES } = require('./constants');

const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: 'dashboard.view',

  PRODUCTS_READ: 'products.read',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_UPDATE: 'products.update',
  PRODUCTS_DELETE: 'products.delete',
  PRODUCTS_BULK_SALE: 'products.bulk_sale',

  CATEGORIES_READ: 'categories.read',
  CATEGORIES_MANAGE: 'categories.manage',

  ATTRIBUTES_READ: 'attributes.read',
  ATTRIBUTES_MANAGE: 'attributes.manage',

  ORDERS_READ: 'orders.read',
  ORDERS_UPDATE_STATUS: 'orders.update_status',
  ORDERS_REFUND: 'orders.refund',

  CUSTOMERS_READ: 'customers.read',
  CUSTOMERS_MANAGE: 'customers.manage',

  COUPONS_READ: 'coupons.read',
  COUPONS_MANAGE: 'coupons.manage',

  REVIEWS_READ: 'reviews.read',
  REVIEWS_MODERATE: 'reviews.moderate',
  REVIEWS_DELETE: 'reviews.delete',

  MEDIA_READ: 'media.read',
  MEDIA_UPLOAD: 'media.upload',
  MEDIA_DELETE: 'media.delete',

  SETTINGS_READ: 'settings.read',
  SETTINGS_MANAGE: 'settings.manage',
  SETTINGS_ADVANCED: 'settings.advanced',

  AUDIT_READ: 'audit.read',

  ACCOUNT_SELF: 'account.self',
  CART_SELF: 'cart.self',
  WISHLIST_SELF: 'wishlist.self',
  CHECKOUT_SELF: 'checkout.self',
  REVIEWS_CREATE: 'reviews.create',

  ROLES_READ: 'roles.read',
  ROLES_MANAGE: 'roles.manage',
  SYSTEM_ROLES_MANAGE: 'system_roles.manage',
  USERS_ASSIGN_ROLES: 'users.assign_roles',
});

const SYSTEM_ROLE_DEFINITIONS = Object.freeze({
  [ROLES.CUSTOMER]: {
    key: ROLES.CUSTOMER,
    name: 'Customer',
    description: 'Storefront customer with account, cart, checkout, and review capabilities.',
  },
  [ROLES.ADMIN]: {
    key: ROLES.ADMIN,
    name: 'Admin',
    description: 'Operational admin with catalog, order, customer, content, and dashboard access.',
  },
  [ROLES.SUPER_ADMIN]: {
    key: ROLES.SUPER_ADMIN,
    name: 'Super Admin',
    description: 'Full system access including audit, advanced settings, and role/permission management.',
  },
});

const ADMIN_PERMISSIONS = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.PRODUCTS_READ,
  PERMISSIONS.PRODUCTS_CREATE,
  PERMISSIONS.PRODUCTS_UPDATE,
  PERMISSIONS.PRODUCTS_DELETE,
  PERMISSIONS.PRODUCTS_BULK_SALE,
  PERMISSIONS.CATEGORIES_READ,
  PERMISSIONS.CATEGORIES_MANAGE,
  PERMISSIONS.ATTRIBUTES_READ,
  PERMISSIONS.ATTRIBUTES_MANAGE,
  PERMISSIONS.ORDERS_READ,
  PERMISSIONS.ORDERS_UPDATE_STATUS,
  PERMISSIONS.ORDERS_REFUND,
  PERMISSIONS.CUSTOMERS_READ,
  PERMISSIONS.CUSTOMERS_MANAGE,
  PERMISSIONS.COUPONS_READ,
  PERMISSIONS.COUPONS_MANAGE,
  PERMISSIONS.REVIEWS_READ,
  PERMISSIONS.REVIEWS_MODERATE,
  PERMISSIONS.REVIEWS_DELETE,
  PERMISSIONS.MEDIA_READ,
  PERMISSIONS.MEDIA_UPLOAD,
  PERMISSIONS.MEDIA_DELETE,
  PERMISSIONS.SETTINGS_READ,
  PERMISSIONS.SETTINGS_MANAGE,
  PERMISSIONS.AUDIT_READ,
];

const CUSTOMER_PERMISSIONS = [
  PERMISSIONS.ACCOUNT_SELF,
  PERMISSIONS.CART_SELF,
  PERMISSIONS.WISHLIST_SELF,
  PERMISSIONS.CHECKOUT_SELF,
  PERMISSIONS.REVIEWS_CREATE,
];

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.CUSTOMER]: CUSTOMER_PERMISSIONS,
  [ROLES.ADMIN]: ADMIN_PERMISSIONS,
  [ROLES.SUPER_ADMIN]: [...new Set([
    ...Object.values(PERMISSIONS),
    ...ADMIN_PERMISSIONS,
    ...CUSTOMER_PERMISSIONS,
  ])],
});

const RESERVED_SUPER_ADMIN_PERMISSIONS = Object.freeze([
  PERMISSIONS.SYSTEM_ROLES_MANAGE,
  PERMISSIONS.USERS_ASSIGN_ROLES,
]);

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
  ROLE_PERMISSIONS,
  RESERVED_SUPER_ADMIN_PERMISSIONS,
  getRolesForUser,
  getPermissionsForRole,
  getPermissionsForUser,
  getPermissionKeysFromRoleObject,
  enrichUserAuthorization,
  getSystemRoles,
};