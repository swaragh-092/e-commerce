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
| `super_admin` | System | Receives the full catalog initially. Permission middleware still checks its current grants. Its reserved `system_roles.manage` grant cannot be removed, and the role cannot be edited or assigned through Access Control. |
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
| Permission keys | Admin surface / actions |
|:---|:---|
| `products.read/create/update/delete/bulk_sale` | Products; detail pages; bulk sale operations |
| `categories.read/manage`, `attributes.read/manage`, `brands.read/manage` | Catalog taxonomy and product metadata |
| `orders.read/update_status/refund` | Order list/detail, status changes, refunds |
| `customers.read/manage`, `coupons.read/manage`, `reviews.read/moderate/delete` | Customer, coupon, and moderation tools |
| `media.read/upload/update/delete` | Media Library and file operations |
| `gallery.read/manage/delete` | Gallery albums; add image actions also require `media.read` |
| `newsletter.read/manage/subscribers_read` | Campaigns, campaign writes/sending, subscriber email list/export (separate grants) |
| `pages.read/manage`, `menus.read/manage`, `blogs.read/manage` | CMS, navigation, and blog pages; manage implies read where declared |
| `settings.read/manage/advanced` | General settings plus Store Templates, Store Designer, SEO Overrides, Payment Gateway status/configuration, Shipping, Sale Labels, and Email Templates (individual sections still share these settings grants) |
| `notifications.manage` | Email template writes/testing, notification recipients, and notification settings |
| `dashboard.view`, `audit.read` | Dashboard and audit log; Analytics additionally requires `orders.read` |
| `api_builder.read/manage` | API Builder definitions and mutations |
| `roles.read/manage`, `system_roles.manage`, `users.assign_roles` | Access Control role viewing, custom role editing, protected system role editing, staff creation/assignment |
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


## 7. Feature Permission Coverage

Newsletter and Gallery have dedicated permission switches. Existing installations use migration `20261024160000-split-gallery-newsletter-permissions.js`; it copies the former effective access into the new feature grants (Media grants map to Gallery, Settings Read maps to campaign reading, Notifications Manage maps to campaign management and subscriber access). It does not grant access to empty custom roles or give Settings-only readers subscriber emails. The migration is idempotent and does not re-add grants when its new permission row already exists.

`settings.read` and `settings.manage` still cover multiple admin sections listed above. These are shared permissions by current policy, so revoking one hides/blocks all the listed sections together. Feature flags and store mode are separate from staff permissions and remain Super Admin controlled. Public storefront/newsletter subscribe and unsubscribe endpoints are intentionally public; a signed-in customer can read and change only their own newsletter preference.

Permission coverage tests exercise direct API gates for Gallery, Newsletter, Blogs, and Email Templates; client tests cover menu/route selection, read versus manage views, and active-session revocation. They do not establish a formal audit of every controller or every production deployment.
