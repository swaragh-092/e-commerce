export const PERMISSIONS = Object.freeze({
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

export const ROLES = Object.freeze({
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
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

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.CUSTOMER]: CUSTOMER_PERMISSIONS,
  [ROLES.ADMIN]: ADMIN_PERMISSIONS,
  [ROLES.SUPER_ADMIN]: [...new Set([
    ...Object.values(PERMISSIONS),
    ...ADMIN_PERMISSIONS,
    ...CUSTOMER_PERMISSIONS,
  ])],
});

const unique = (items = []) => [...new Set(items.filter(Boolean))];

export const getRolesForUser = (user) => {
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

export const getPermissionsForUser = (user) => {
  const safeUser = user || {};

  if (Array.isArray(safeUser.permissions) && safeUser.permissions.length) {
    return unique(safeUser.permissions);
  }

  return unique(getRolesForUser(safeUser).flatMap((role) => ROLE_PERMISSIONS[role] || []));
};

export const hasPermission = (user, permission) => getPermissionsForUser(user).includes(permission);
export const hasAnyPermission = (user, permissions = []) => permissions.some((permission) => hasPermission(user, permission));
export const hasAllPermissions = (user, permissions = []) => permissions.every((permission) => hasPermission(user, permission));