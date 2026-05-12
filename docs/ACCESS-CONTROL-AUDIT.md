# Access Control System Audit

Complete A-to-Z audit of authentication, authorization, roles, permissions, and route protection.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Authentication System](#2-authentication-system)
3. [Role & Permission System](#3-role--permission-system)
4. [Route Inventory — 206 Endpoints](#4-route-inventory--206-endpoints)
5. [Client-Side Access Control](#5-client-side-access-control)
6. [Bugs & Security Issues](#6-bugs--security-issues)
7. [Recommendations](#7-recommendations)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                 Client (React)                   │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ AuthContext│  │Protected │  │ AdminLayout  │  │
│  │ (user,    │  │ Route    │  │ (menu filter)│  │
│  │ roles,    │  │ (route   │  │              │  │
│  │ perms)    │  │  guard)  │  │              │  │
│  └───────────┘  └──────────┘  └──────────────┘  │
└──────────────────┬──────────────────────────────┘
                   │ JWT Bearer Token
                   ▼
┌─────────────────────────────────────────────────┐
│              Server (Express)                    │
│  ┌───────────┐  ┌──────────┐  ┌──────────────┐  │
│  │auth.      │  │role.     │  │featureGate.  │  │
│  │middleware │  │middleware │  │middleware    │  │
│  │(JWT verify│  │(perm     │  │(feature      │  │
│  │ + enrich) │  │ check)   │  │ toggle)      │  │
│  └───────────┘  └──────────┘  └──────────────┘  │
│       │              │              │            │
│       ▼              ▼              ▼            │
│  ┌──────────────────────────────────────────┐    │
│  │         Route Handlers                   │    │
│  │  (controller → service → model)          │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Auth Strategy

| Component | Detail |
|---|---|
| **Type** | JWT Bearer tokens |
| **Access token** | Payload `{ id, role }`, 15m expiry |
| **Refresh token** | Same payload, 7d expiry, stored in DB, rotated on use |
| **Storage (client)** | `localStorage` — `accessToken`, `refreshToken`, `userProfile` |

### Middleware Chain

```
authenticate → authorizePermissions/authorizeAnyPermission → validate → [auditLog] → controller
```

---

## 2. Authentication System

### Auth Middleware (`server/src/middleware/auth.middleware.js`)

- `authenticate` — extracts Bearer token, verifies JWT, loads user from DB, calls `enrichUserAuthorization()`, sets `req.user`. Rejects if user deleted/inactive.
- `optionalAuth` — same logic but silently continues if no token. Used for public routes that optionally show admin content (product listings).

### Auth Routes (`server/src/modules/auth/auth.routes.js`)

| Method | Path | Security | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | Rate limited | |
| POST | `/api/auth/login` | Rate limited | |
| POST | `/api/auth/refresh` | — | Token rotation with row-level locking |
| **POST** | **`/api/auth/logout`** | **No auth middleware** | **Bug — see issues** |
| POST | `/api/auth/forgot-password` | Rate limited | |
| POST | `/api/auth/reset-password` | — | |
| POST | `/api/auth/resend-verification` | Rate limited | |
| GET | `/api/auth/verify-email` | — | Token in query param |

### Token Flow

```
Login → generateTokens(user) → { accessToken, refreshToken }
                                  ↓
                          Client stores in localStorage
                                  ↓
                     Every API call → Authorization: Bearer <accessToken>
                                  ↓
                          authenticate middleware:
                            1. Verify JWT signature
                            2. Load user from DB
                            3. enrichUserAuthorization()
                            4. Set req.user
                                  ↓
                          On 401 → POST /auth/refresh
                                  ↓
                          Old refresh revoked (revokedAt)
                          New tokens issued, old access invalid
                                  ↓
                          On refresh failure → clear all, redirect login
```

---

## 3. Role & Permission System

### Dual Role Storage (Transitional)

The system has **two parallel role mechanisms**:

1. **Legacy `user.role` column** — string: `super_admin`, `admin`, `customer`
2. **DB-backed RBAC** — `roles` + `permissions` tables with M2M through `UserRole` + `RolePermission`

The bridge is in `server/src/config/permissions.js`:
- `getRolesForUser(user)` — checks `user.roles` array first, falls back to `user.role`
- `getPermissionsForUser(user)` — checks `user.permissions` first, else derives from roles
- `enrichUserAuthorization(user)` — normalizes `roles[]` and `permissions[]` on the user object

### Role Definitions (`shared/authorization.json`)

| Role | Base Role | Permissions |
|---|---|---|
| `customer` | `customer` | `account.self`, `cart.self`, `wishlist.self`, `checkout.self`, `reviews.create` |
| `admin` | `admin` | All operational: dashboard, products, orders, customers, coupons, reviews, media, settings, pages, menus, notifications, audit, enquiries |
| `super_admin` | `super_admin` | ALL including `system_roles.manage`, `users.assign_roles` |

### All 42 Permission Keys

| Constant | Value | Category |
|---|---|---|
| `DASHBOARD_VIEW` | `dashboard.view` | Admin core |
| `PRODUCTS_READ` | `products.read` | Catalog |
| `PRODUCTS_CREATE` | `products.create` | Catalog |
| `PRODUCTS_UPDATE` | `products.update` | Catalog |
| `PRODUCTS_DELETE` | `products.delete` | Catalog |
| `PRODUCTS_BULK_SALE` | `products.bulk_sale` | Catalog |
| `CATEGORIES_READ` | `categories.read` | Catalog |
| `CATEGORIES_MANAGE` | `categories.manage` | Catalog |
| `ATTRIBUTES_READ` | `attributes.read` | Catalog |
| `ATTRIBUTES_MANAGE` | `attributes.manage` | Catalog |
| `ORDERS_READ` | `orders.read` | Orders |
| `ORDERS_UPDATE_STATUS` | `orders.update_status` | Orders |
| `ORDERS_REFUND` | `orders.refund` | Orders |
| `CUSTOMERS_READ` | `customers.read` | Customers |
| `CUSTOMERS_MANAGE` | `customers.manage` | Customers |
| `COUPONS_READ` | `coupons.read` | Marketing |
| `COUPONS_MANAGE` | `coupons.manage` | Marketing |
| `REVIEWS_READ` | `reviews.read` | Reviews |
| `REVIEWS_MODERATE` | `reviews.moderate` | Reviews |
| `REVIEWS_DELETE` | `reviews.delete` | Reviews |
| `REVIEWS_CREATE` | `reviews.create` | Reviews |
| `MEDIA_READ` | `media.read` | Media |
| `MEDIA_UPLOAD` | `media.upload` | Media |
| `MEDIA_UPDATE` | `media.update` | Media |
| `MEDIA_DELETE` | `media.delete` | Media |
| `SETTINGS_READ` | `settings.read` | Settings |
| `SETTINGS_MANAGE` | `settings.manage` | Settings |
| `SETTINGS_ADVANCED` | `settings.advanced` | Settings — **UNUSED** |
| `AUDIT_READ` | `audit.read` | Audit |
| `PAGES_READ` | `pages.read` | Content |
| `PAGES_MANAGE` | `pages.manage` | Content |
| `MENUS_READ` | `menus.read` | Content |
| `MENUS_MANAGE` | `menus.manage` | Content |
| `NOTIFICATIONS_MANAGE` | `notifications.manage` | Notifications |
| `ROLES_READ` | `roles.read` | Access Control |
| `ROLES_MANAGE` | `roles.manage` | Access Control |
| `SYSTEM_ROLES_MANAGE` | `system_roles.manage` | Access Control — reserved |
| `USERS_ASSIGN_ROLES` | `users.assign_roles` | Access Control — reserved |
| `ENQUIRIES_READ` | `enquiries.read` | Enquiries |
| `ENQUIRIES_MANAGE` | `enquiries.manage` | Enquiries |
| `ACCOUNT_SELF` | `account.self` | Customer — **UNUSED in routes** |
| `CART_SELF` | `cart.self` | Customer — **UNUSED in routes** |
| `WISHLIST_SELF` | `wishlist.self` | Customer — **UNUSED in routes** |
| `CHECKOUT_SELF` | `checkout.self` | Customer — **UNUSED in routes** |

### Permission Implication

Defined in `authorization.json` `implies` map. Examples:
- `categories.manage` → implies `categories.read`
- `orders.update_status` → implies `orders.read`
- `settings.advanced` → implies `settings.read` + `settings.manage`

The `expandImplied()` function resolves chains. **No cycle detection** — circular implies would cause infinite recursion.

---

## 4. Route Inventory — 206 Endpoints

### Summary by Module

| Module | Public | Auth (self) | Admin | Total |
|---|---|---|---|---|
| auth | 8 | — | — | 8 |
| user | — | 9 | 3 | 12 |
| product | 3 | — | 7 | 10 |
| productCombo | 1 | — | 3 | 4 |
| productTab | 1 | — | 5 | 6 |
| brand | 2 | — | 3 | 5 |
| category | 2 | — | 5 | 7 |
| attribute | — | — | 9 | 9 |
| productAttribute | — | — | 4 | 4 |
| categoryAttribute | — | — | 3 | 3 |
| productVariant | — | — | 7 | 7 |
| order | — | 7 | 7 | 14 |
| cart | 5 | 1 | — | 6 |
| wishlist | — | 6 | — | 6 |
| coupon | — | 3 | 5 | 8 |
| review | 1 | — | 4 | 5 |
| media | — | — | 4 | 4 |
| settings | 4 | — | 6 | 10 |
| search | 1 | — | — | 1 |
| seo | 3 | — | 5 | 8 |
| page | 2 | — | 5 | 7 |
| menu | 2 | — | 14 | 16 |
| payment | 4 | 2 | 3 | 9 |
| shipping | — | 2 | — | 2 |
| shipping.admin | — | — | 10 | 10 |
| shipping.webhook | 1 | — | — | 1 |
| notification | — | — | 8 | 8 |
| audit | — | — | 1 | 1 |
| admin | — | — | 11 | 11 |
| enquiry | 1 | — | 3 | 4 |
| **Total** | **41** | **30** | **135** | **206** |

### Permission Coverage by Route

All 206 endpoints were checked. **Result:** Every permission referenced in routes exists in `authorization.json`. No undefined permission references.

### Customer Self-Service Routes (No Middleware Permission Check)

These 30+ routes rely entirely on controller-level `req.user.id` scoping:

- All `/api/users/me/*` (9 routes) — profile, addresses, password
- All customer `/api/orders/*` (7 routes) — list, detail, cancel, returns, replacements
- All `/api/wishlist/*` (6 routes) — CRUD
- `/api/cart/merge`
- `/api/payments/create-order`, `/api/payments/verify/:orderId`
- `/api/shipping/calculate`, `/api/shipping/check-serviceability`
- `/api/coupons/validate`, `/api/coupons/public`, `/api/coupons/eligible`

**Risk:** If any controller fails to scope by `userId`, IDOR vulnerability.

---

## 5. Client-Side Access Control

### How Permissions Reach the Client

```
Server response from GET /users/me includes:
  user.roles = ["admin"]
  user.permissions = ["dashboard.view", "products.read", ...]

Client stores in AuthContext (state) + localStorage ("userProfile")
```

### Route Protection (`ProtectedRoute.jsx`)

```jsx
<ProtectedRoute permission={PERMISSIONS.PRODUCTS_READ} />
<ProtectedRoute permissions={[...]} requireAllPermissions />
<ProtectedRoute role="admin" />
```

Admin layout wraps sidebar navigation in permission checks:
```js
const isItemVisible = (item) => {
    if (item.permission && !hasPermission(item.permission)) return false;
    if (item.permissions && !hasAnyPermission(item.permissions)) return false;
    ...
};
```

### Permission Coverage in Admin Navigation

| Menu Item | Required Permission | Feature Gate |
|---|---|---|
| Dashboard | `DASHBOARD_VIEW` | — |
| Products | `PRODUCTS_READ` | — |
| Categories | `CATEGORIES_READ` | — |
| Brands | `PRODUCTS_READ` | — |
| Attributes | `ATTRIBUTES_READ` | — |
| Orders | `ORDERS_READ` | `orders` |
| Enquiries | `SETTINGS_READ` | — |
| Customers | `CUSTOMERS_READ` | — |
| Coupons | `COUPONS_READ` | `coupons` |
| Reviews | `REVIEWS_READ` | `reviews` |
| Media | `MEDIA_READ` | — |
| Pages | `PAGES_READ` | — |
| Menus | `MENUS_READ` | — |
| SEO | `SETTINGS_READ` | `seo` |
| Settings | `SETTINGS_READ` | — |
| Access Control | `ROLES_READ` / `ROLES_MANAGE` / `SYSTEM_ROLES_MANAGE` / `USERS_ASSIGN_ROLES` | — |
| Audit Log | `AUDIT_READ` | — |

---

## 6. Bugs & Security Issues

### CRITICAL

| # | Issue | File | Description |
|---|---|---|---|
| C1 | **`POST /logout` missing auth middleware** | `auth.routes.js:26` | Anyone with a valid refresh token string can revoke it without proving session ownership |

### HIGH

| # | Issue | File | Description |
|---|---|---|---|
| H1 | **Customer permission constants never enforced in routes** | `authorization.json` | `ACCOUNT_SELF`, `CART_SELF`, `WISHLIST_SELF`, `CHECKOUT_SELF` are defined but no route middleware checks them. All customer self-service routes rely on controller-only userId scoping |
| H2 | **Admin review routes bypass configurable prefix** | `app.js:134` vs `:139-141` | Review admin routes hardcoded to `/api/admin/reviews`. If `ADMIN_ROUTE_PREFIX` is changed, review routes stay exposed at default path |
| H3 | **User profile with permissions stored in localStorage** | `AuthContext.jsx` | Full `userProfile` with `roles[]` and `permissions[]` in localStorage. XSS vulnerability exposes complete auth model |
| H4 | **Complete authorization schema shipped to client** | `utils/permissions.js` | All 42 permission keys, role definitions, reserved perms, and the implies map are bundled in production JS |

### MEDIUM

| # | Issue | File | Description |
|---|---|---|---|
| M1 | **Order customer routes have no permission middleware** | `order.routes.js:29-36` | 7 customer endpoints use only `authenticate`. If any controller misses a `userId` scope, IDOR vulnerability |
| M2 | **`SETTINGS_ADVANCED` defined but never used** | `authorization.json:34` | "Danger zone" permission exists but no route requires it |
| M3 | **No 403 interceptor in API client** | `api.js` | Only 401 is intercepted globally. 403 responses show raw API errors |
| M4 | **`isAdmin` check in AdminLoginPage too broad** | `AdminLoginPage.jsx:58` | `isAdmin = permissions?.length > 0` — a customer with `reviews.create` would pass |
| M5 | **Notification service uses legacy role column** | `notification.service.js:247` | `where: { role: ['admin', 'super_admin'] }` — users with custom admin roles but legacy `role='customer'` miss notifications |
| M6 | **Settings service hardcoded super_admin string check** | `settings.service.js:196-212` | Bypasses permission system in favor of explicit role-string check |
| M7 | **Several admin pages lack page-level permission check** | `EnquiriesPage`, `AuditLogPage`, `ShippingPage`, `CustomerDetailPage` | Only protected by route guard. No defense-in-depth via `useAuth` + `hasPermission` |
| M8 | **`expandImplied()` has no cycle detection** | `permissions.js:30-37` | Circular implication would cause infinite recursion |

### LOW

| # | Issue | File | Description |
|---|---|---|---|
| L1 | **`authorize()` middleware defined but unused** | `role.middleware.js:10-23` | Role-string check function is exported, never imported |
| L2 | **Order controller has duplicate permission checks** | `order.controller.js` | `hasOrderAdminAccess()` checks `ORDERS_READ` after `authorizePermissions(ORDERS_UPDATE_STATUS)` already ran |
| L3 | **Product `GET /id/:id` requires auth (admin) but `GET /:slug` is public** | `product.routes.js` | Dual access patterns for same resource |
| L4 | **Settings endpoints are public (info disclosure)** | `settings.routes.js` | `GET /settings/:group` allows enumerating all setting groups |
| L5 | **Cart routes never check `cart.self` permission** | `cart.routes.js` | Uses only `optionalAuth` for all mutations |
| L6 | **`canAccessAdmin` unused in StoreLayout** | `StoreLayout.jsx:45` | Computed but never rendered |
| L7 | **Password reset tokens stored in plain text** | `auth.service.js:290,350` | DB leak exposes all outstanding reset tokens |
| L8 | **Token payload contains legacy `role` field** | `auth.service.js:40` | JWT has `{ role }` from legacy column, could confuse |

---

## 7. Recommendations

### Priority 1 — Fix Critical/Hard Bugs

**Fix `POST /logout`** — Add `authenticate` middleware:
```js
// auth.routes.js
router.post('/logout', authenticate, validate(logoutSchema), authController.logout);
```

**Fix admin review routes prefix** — Mount through `adminPrefix`:
```js
// app.js
app.use(adminPrefix, reviewAdminRoutes);  // instead of hardcoded /api
```

**Remove userProfile from localStorage** — Store only `{ roles, permissions }` not the full profile:
```js
// AuthContext.jsx
localStorage.setItem('userRoles', JSON.stringify(userData.roles));
localStorage.setItem('userPermissions', JSON.stringify(userData.permissions));
```

### Priority 2 — Tighten Authorization

**Add permission checks to customer routes**:
```js
// order.routes.js
router.get('/', authenticate, authorizePermissions(PERMISSIONS.ORDERS_READ), orderController.getOrders);
// Controller scopes by userId for customers, ORDERS_READ for admins
```

Or verify every customer controller properly scopes by `req.user.id`.

**Add defense-in-depth to all admin pages** — Every admin page should:
```js
const { hasPermission } = useAuth();
if (!hasPermission(PERMISSIONS.ENQUIRIES_READ)) return <NotAuthorized />;
```

**Fix `AdminLoginPage` isAdmin check**:
```js
const isAdmin = hasRole('admin') || hasRole('super_admin');
```

### Priority 3 — Remove Dead/Duplicate Code

- Remove `SETTINGS_ADVANCED` from `authorization.json` or add routes that use it
- Remove unused `authorize()` export or add routes that use it
- Remove `ACCOUNT_SELF`, `CART_SELF`, `WISHLIST_SELF`, `CHECKOUT_SELF` or enforce them in route middleware
- Consolidate `PAYMENT_SETTLED_STATUSES` into a single shared module

### Priority 4 — Security Hardening

- Add cycle detection to `expandImplied()`
- Store password reset tokens hashed, not in plain text
- Consider HttpOnly cookies for token storage instead of localStorage
- Add a global 403 interceptor in `api.js`
- Filter sensitive values from public settings endpoints
- Fix notification service to use RBAC roles, not legacy column

### Priority 5 — Consolidation

Extract shared permission utilities (`getRolesForUser`, `getPermissionsForUser`, `expandImplied`) into `shared/` so both client and server import from one source instead of maintaining duplicate copies.
