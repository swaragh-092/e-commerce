import authorizationSchema from '../../../shared/authorization.json';

export const PERMISSIONS = Object.freeze({ ...authorizationSchema.permissions });

export const ROLES = Object.freeze({ ...authorizationSchema.roles });

export const ADMIN_PERMISSIONS = [...authorizationSchema.adminPermissionKeys];

export const CUSTOMER_PERMISSIONS = [...authorizationSchema.customerPermissionKeys];

export const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.CUSTOMER]: CUSTOMER_PERMISSIONS,
  [ROLES.ADMIN]: ADMIN_PERMISSIONS,
  [ROLES.SUPER_ADMIN]: [...new Set([
    ...Object.values(PERMISSIONS),
    ...ADMIN_PERMISSIONS,
    ...CUSTOMER_PERMISSIONS,
  ])],
});

export const ADMIN_ROUTE_PERMISSION_MAP = Object.freeze([
  { path: '/admin', permissions: [PERMISSIONS.DASHBOARD_VIEW] },
  { path: '/admin/products', permissions: [PERMISSIONS.PRODUCTS_READ, PERMISSIONS.PRODUCTS_CREATE, PERMISSIONS.PRODUCTS_UPDATE, PERMISSIONS.PRODUCTS_DELETE] },
  { path: '/admin/categories', permissions: [PERMISSIONS.CATEGORIES_READ, PERMISSIONS.CATEGORIES_MANAGE] },
  { path: '/admin/brands', permissions: [PERMISSIONS.PRODUCTS_READ, PERMISSIONS.PRODUCTS_CREATE, PERMISSIONS.PRODUCTS_UPDATE, PERMISSIONS.PRODUCTS_DELETE] },
  { path: '/admin/attributes', permissions: [PERMISSIONS.ATTRIBUTES_READ, PERMISSIONS.ATTRIBUTES_MANAGE] },
  { path: '/admin/orders', permissions: [PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_UPDATE_STATUS, PERMISSIONS.ORDERS_REFUND] },
  { path: '/admin/customers', permissions: [PERMISSIONS.CUSTOMERS_READ, PERMISSIONS.CUSTOMERS_MANAGE] },
  { path: '/admin/coupons', permissions: [PERMISSIONS.COUPONS_READ, PERMISSIONS.COUPONS_MANAGE] },
  { path: '/admin/reviews', permissions: [PERMISSIONS.REVIEWS_READ, PERMISSIONS.REVIEWS_MODERATE, PERMISSIONS.REVIEWS_DELETE] },
  { path: '/admin/media', permissions: [PERMISSIONS.MEDIA_READ, PERMISSIONS.MEDIA_UPLOAD, PERMISSIONS.MEDIA_DELETE] },
  { path: '/admin/settings', permissions: [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.SETTINGS_ADVANCED] },
  { path: '/admin/pages', permissions: [PERMISSIONS.PAGES_READ, PERMISSIONS.PAGES_MANAGE] },
  { path: '/admin/access-control', permissions: [PERMISSIONS.ROLES_READ, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.SYSTEM_ROLES_MANAGE, PERMISSIONS.USERS_ASSIGN_ROLES] },
  { path: '/admin/audit-log', permissions: [PERMISSIONS.AUDIT_READ] },
]);

export const ADMIN_ACCESS_PERMISSIONS = Object.freeze(
  [...new Set(ADMIN_ROUTE_PERMISSION_MAP.flatMap((item) => item.permissions))]
);

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

export const getFirstAccessibleAdminPath = (user) => {
  const permissions = getPermissionsForUser(user);
  const match = ADMIN_ROUTE_PERMISSION_MAP.find((item) => item.permissions.some((permission) => permissions.includes(permission)));
  return match?.path || null;
};