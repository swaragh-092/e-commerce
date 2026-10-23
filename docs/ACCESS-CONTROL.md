# Access Control & Role-Based Permissions (RBAC) Guide

> Canonical documentation for access control, staff delegation boundaries, permission hierarchy, and custom roles.

---

## 1. Overview & Architecture

The platform uses a unified, fine-grained Role-Based Access Control (RBAC) architecture.
The single source of truth for all roles, permissions, implication rules, and default assignments is:
- **`shared/authorization.json`**

Both backend (`server/src/config/permissions.js`) and frontend (`client/src/utils/permissions.js`) import this schema to ensure runtime enforcement parity across server endpoints, route guards, and UI action triggers.

---

## 2. Role Hierarchy

### System Roles vs. Custom Roles
| Role | Category | Scope & Behavior |
|:-----|:---------|:-----------------|
| `super_admin` | System | Full, unrestricted platform access. Bypasses permission checks. Immutable; cannot be modified, deleted, or assigned by non-superadmins. |
| `admin` | System | Default administrative role with baseline day-to-day operations permissions. Excludes sensitive tooling (`menus.*`, `api_builder.*`, `roles.*`, `users.assign_roles`). |
| `user` | System | Default customer storefront role. No administrative or staff capabilities. |
| Custom Roles | Tenant | Created and customized by authorized staff. Scoped strictly to explicitly granted permissions. |

---

## 3. Core Security Rules & Delegation Boundaries

### 3.1. Super Admin Exclusivity
- **Reserved Permissions:** `system_roles.manage` is strictly reserved for `super_admin`. Custom roles cannot be assigned reserved permissions.
- **Store Mode & Platform Features:** Changing `general.mode` (e-commerce vs catalog) and toggling platform feature switches in Platform Features is strictly restricted to `super_admin`.
- **Account Protection:** Non-superadmin staff cannot update, delete, or reassign roles for any `super_admin` account.
- **Base Role Restriction:** Non-superadmins cannot create or edit any role with `super_admin` as its base role.

### 3.2. Principle of Least Privilege Delegation
- **Possession Boundary:** An admin creating or updating a custom role can **only** grant permissions they personally possess.
- **Explicit Staff Management:** The capability to create staff users or assign roles to users requires the explicit permission `users.assign_roles`. This is **not** bundled into default `admin`.
- **System Role Tampering:** Only `super_admin` can edit system roles.

### 3.3. Zero-Permission Empty Role Guarantee
- A custom role with zero permissions (`permissionIds: []`) grants **zero administrative access**.
- Both `getPermissionsForUser` and `getRolesForUser` explicitly check for empty array instances and prevent falling back to default base-role permissions.
- Any request by a zero-permission user hitting an authorized route is rejected with `403 FORBIDDEN`.

---

## 4. Permission Catalog

### Administrative Tools & Builders
| Permission Key | Constant | Description | Implies |
|:---------------|:---------|:------------|:--------|
| `menus.read` | `PERMISSIONS.MENUS_READ` | View navigation menus and Menu Builder | — |
| `menus.manage` | `PERMISSIONS.MENUS_MANAGE` | Create, update, or delete menus and items | `menus.read` |
| `api_builder.read` | `PERMISSIONS.API_BUILDER_READ` | View custom API schemas and endpoints in API Builder | — |
| `api_builder.manage` | `PERMISSIONS.API_BUILDER_MANAGE` | Create, edit, publish, or delete custom API endpoints | `api_builder.read` |

> **Note:** Neither Menu Builder nor API Builder permissions are granted to the default `admin` role. They must be explicitly granted to trusted custom staff roles or used by `super_admin`.

### Access Control & Staff Administration
| Permission Key | Constant | Description | Implies |
|:---------------|:---------|:------------|:--------|
| `roles.read` | `PERMISSIONS.ROLES_READ` | View roles, permissions, and staff listings | — |
| `roles.manage` | `PERMISSIONS.ROLES_MANAGE` | Create and edit custom roles | `roles.read` |
| `users.assign_roles` | `PERMISSIONS.USERS_ASSIGN_ROLES` | Create staff users and assign roles to staff | — |
| `system_roles.manage` | `PERMISSIONS.SYSTEM_ROLES_MANAGE` | Reserved superadmin permission for system roles | — |

### Platform Operations & Content
| Permission Key | Constant | Description |
|:---------------|:---------|:------------|
| `products.read` / `products.manage` | `PRODUCTS_READ` / `PRODUCTS_MANAGE` | Catalog & product management |
| `categories.read` / `categories.manage` | `CATEGORIES_READ` / `CATEGORIES_MANAGE` | Category taxonomy |
| `orders.read` / `orders.manage` | `ORDERS_READ` / `ORDERS_MANAGE` | Order fulfillment and processing |
| `customers.read` / `customers.manage` | `CUSTOMERS_READ` / `CUSTOMERS_MANAGE` | Customer profile management |
| `coupons.read` / `coupons.manage` | `COUPONS_READ` / `COUPONS_MANAGE` | Discount codes & promotions |
| `reviews.read` / `reviews.manage` | `REVIEWS_READ` / `REVIEWS_MANAGE` | Product reviews moderation |
| `pages.read` / `pages.manage` | `PAGES_READ` / `PAGES_MANAGE` | CMS static pages |
| `settings.read` / `settings.manage` | `SETTINGS_READ` / `SETTINGS_MANAGE` | Store settings & configuration |
| `audit.read` | `AUDIT_READ` | Audit logs inspection |

---

## 5. Enforcement Layers

### 5.1. Server Route Protection
Routes use middleware located in `server/src/middleware/auth.middleware.js`:
- `authenticate`: Validates JWT session from HttpOnly cookies or authorization headers.
- `authorize(roles)`: Role-based gate (e.g. `authorize(ROLES.SUPER_ADMIN)` for platform features and system roles).
- `authorizePermissions(perms)`: Requires every specified permission.
- `authorizeAnyPermission(perms)`: Requires at least one of the specified permissions.

### 5.2. Client Navigation & Route Guards
In `client/src/routes/AppRoutes.jsx` and `client/src/layouts/AdminLayout.jsx`:
- Navigation items and page routes are guarded by `ProtectedRoute`.
- Menu Builder requires `PERMISSIONS.MENUS_READ` (view) and `PERMISSIONS.MENUS_MANAGE` (modify).
- API Builder requires `PERMISSIONS.API_BUILDER_READ` (view) and `PERMISSIONS.API_BUILDER_MANAGE` (modify).
- Platform Features requires `role="super_admin"`.
- Buttons and modification actions are conditionally hidden or disabled when the user lacks manage permissions.

---

## 6. Public vs. Admin Endpoints
- Public storefront routes (e.g. `/api/api-builder/public/:slug`, `/api/products`, `/api/categories`) remain publicly accessible without administrative permissions.
- In Catalog Mode or when `showPrice` is disabled, prices are automatically scrubbed from public responses, while authenticated admin routes continue to provide operational access to authorized staff.
