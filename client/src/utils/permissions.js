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
  { path: '/admin/analytics', permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.ORDERS_READ], requireAllPermissions: true },
  { path: '/admin/products', permissions: [PERMISSIONS.PRODUCTS_READ, PERMISSIONS.PRODUCTS_CREATE, PERMISSIONS.PRODUCTS_UPDATE, PERMISSIONS.PRODUCTS_DELETE] },
  { path: '/admin/categories', permissions: [PERMISSIONS.CATEGORIES_READ, PERMISSIONS.CATEGORIES_MANAGE] },
  { path: '/admin/brands', permissions: [PERMISSIONS.BRANDS_READ, PERMISSIONS.BRANDS_MANAGE] },
  { path: '/admin/attributes', permissions: [PERMISSIONS.ATTRIBUTES_READ, PERMISSIONS.ATTRIBUTES_MANAGE] },
  { path: '/admin/orders', permissions: [PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_UPDATE_STATUS, PERMISSIONS.ORDERS_REFUND] },
  { path: '/admin/customers', permissions: [PERMISSIONS.CUSTOMERS_READ, PERMISSIONS.CUSTOMERS_MANAGE] },
  { path: '/admin/coupons', permissions: [PERMISSIONS.COUPONS_READ, PERMISSIONS.COUPONS_MANAGE] },
  { path: '/admin/reviews', feature: 'reviews', permissions: [PERMISSIONS.REVIEWS_READ, PERMISSIONS.REVIEWS_MODERATE, PERMISSIONS.REVIEWS_DELETE] },
  { path: '/admin/media', permissions: [PERMISSIONS.MEDIA_READ, PERMISSIONS.MEDIA_UPLOAD, PERMISSIONS.MEDIA_UPDATE, PERMISSIONS.MEDIA_DELETE] },
  { path: '/admin/gallery', feature: 'gallery', permissions: [PERMISSIONS.GALLERY_READ] },
  { path: '/admin/settings', permissions: [PERMISSIONS.SETTINGS_READ, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.SETTINGS_ADVANCED] },
  { path: '/admin/newsletter', feature: 'newsletter', permissions: [PERMISSIONS.NEWSLETTER_READ, PERMISSIONS.NEWSLETTER_SUBSCRIBERS_READ] },
  { path: '/admin/themes', feature: 'themes', permissions: [PERMISSIONS.SETTINGS_READ] },
  { path: '/admin/store-designer', feature: 'themes', permissions: [PERMISSIONS.SETTINGS_MANAGE] },
  { path: '/admin/seo-overrides', feature: 'seo', permissions: [PERMISSIONS.SETTINGS_READ] },
  { path: '/admin/payment-gateways', permissions: [PERMISSIONS.SETTINGS_READ] },
  { path: '/admin/sale-labels', permissions: [PERMISSIONS.SETTINGS_READ] },
  { path: '/admin/enquiries', permissions: [PERMISSIONS.ENQUIRIES_READ] },
  { path: '/admin/shipping', permissions: [PERMISSIONS.SETTINGS_MANAGE] },
  // Settings read permission allows view-only access, while notifications manage allows editing.
  { path: '/admin/email-templates', permissions: [PERMISSIONS.SETTINGS_READ, PERMISSIONS.NOTIFICATIONS_MANAGE] },
  { path: '/admin/pages', feature: 'pages', permissions: [PERMISSIONS.PAGES_READ, PERMISSIONS.PAGES_MANAGE] },
  { path: '/admin/blogs', feature: 'blogs', permissions: [PERMISSIONS.BLOGS_READ] },
  { path: '/admin/menus', permissions: [PERMISSIONS.MENUS_READ, PERMISSIONS.MENUS_MANAGE] },
  { path: '/admin/api-builder', feature: 'apiBuilder', permissions: [PERMISSIONS.API_BUILDER_READ, PERMISSIONS.API_BUILDER_MANAGE] },
  { path: '/admin/access-control', permissions: [PERMISSIONS.ROLES_READ, PERMISSIONS.ROLES_MANAGE, PERMISSIONS.SYSTEM_ROLES_MANAGE, PERMISSIONS.USERS_ASSIGN_ROLES] },
  { path: '/admin/audit-log', permissions: [PERMISSIONS.AUDIT_READ] },
]);

export const isSuperAdminOnlySettingsKey = (group, key) => (
  group === 'features'
  || group === 'visibility'
  || (group === 'general' && key === 'mode')
);

export const ADMIN_ACCESS_PERMISSIONS = Object.freeze(
  [...new Set(ADMIN_ROUTE_PERMISSION_MAP.flatMap((item) => item.permissions))]
);

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

export const getRolesForUser = (user) => {
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

export const getPermissionsForUser = (user) => {
  const safeUser = user || {};

  if (Array.isArray(safeUser.permissions)) {
    return expandImplied(unique(safeUser.permissions));
  }

  if (Array.isArray(safeUser.roles)) {
    return expandImplied(unique(
      safeUser.roles.flatMap((role) => {
        if (!role || typeof role !== 'object') return ROLE_PERMISSIONS[role] || [];
        if (Array.isArray(role.permissions)) {
          return role.permissions.map((p) => (typeof p === 'string' ? p : p?.key)).filter(Boolean);
        }
        const roleKey = role.slug || role.key || role.name || role.role;
        return ROLE_PERMISSIONS[roleKey] || [];
      })
    ));
  }

  return expandImplied(unique(getRolesForUser(safeUser).flatMap((role) => ROLE_PERMISSIONS[role] || [])));
};

export const hasPermission = (user, permission) => getPermissionsForUser(user).includes(permission);
export const hasAnyPermission = (user, permissions = []) => permissions.some((permission) => hasPermission(user, permission));
export const hasAllPermissions = (user, permissions = []) => permissions.every((permission) => hasPermission(user, permission));

export { IMPLIES };

export const getFirstAccessibleAdminPath = (user, features) => {
  const permissions = getPermissionsForUser(user);
  const match = ADMIN_ROUTE_PERMISSION_MAP.find((item) => (!features || !item.feature || features[item.feature] === true) && (item.requireAllPermissions
    ? item.permissions.every((permission) => permissions.includes(permission))
    : item.permissions.some((permission) => permissions.includes(permission))));
  return match?.path || null;
};
