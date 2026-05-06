# Comprehensive Access Control Audit Report

**Date:** 2026-05-06
**Auditor:** Antigravity (Senior Full-Stack Engineer)
**Scope:** End-to-end audit of Authentication (AuthN), Authorization (AuthZ), Access Control mechanisms, Audit Logging, and compliance with industry security standards.

---

## 1. Executive Summary

This audit provides a comprehensive analysis of the e-commerce platform's access control systems. The platform employs a robust JWT-based authentication flow with refresh token rotation, a granular Role-Based Access Control (RBAC) system, and an extensive audit logging mechanism. While the architecture demonstrates strong security foundations, several gaps and improvement opportunities have been identified across authentication hardening, authorization granularity, route-level protections, and audit coverage.

**Overall Security Posture:** 🟡 **MODERATE-HIGH** — Strong foundations with actionable improvements needed.

---

## 2. Authentication (AuthN) Architecture

### 2.1 Password Security
| Aspect              | Implementation                                             | Status   |
| ------------------- | ---------------------------------------------------------- | -------- |
| Hashing Algorithm   | `bcryptjs` with cost factor `12`                           | ✅ Strong |
| Model Hooks         | Automatic hashing in `beforeCreate`/`beforeUpdate`         | ✅ Secure |
| Password Exposure   | Excluded from default scope; `withPassword` scope required | ✅ Secure |
| Password Complexity | Not enforced in model (relies on validation)               | ⚠️ Review |
| Password History    | Not implemented                                            | 🔴 Gap    |
| MFA Support         | Not implemented                                            | 🔴 Gap    |

### 2.2 Token Management
| Aspect                       | Implementation                            | Status           |
| ---------------------------- | ----------------------------------------- | ---------------- |
| Access Token                 | Short-lived JWT (default 15 min)          | ✅ Secure         |
| Refresh Token                | Long-lived JWT (default 7 days)           | ✅ Secure         |
| Token Rotation               | Yes — old refresh revoked on new issuance | ✅ Secure         |
| Revocation on Password Reset | Yes — all refresh tokens destroyed        | ✅ Secure         |
| Token Storage                | Client-side (localStorage not confirmed)  | ⚠️ Review         |
| JWT Algorithm                | HS256 (symmetric)                         | ⚠️ Consider RS256 |
| Token Binding (Device/IP)    | Partial — `createdByIp` tracked           | ⚠️ Enhance        |

### 2.3 Session & Account Protection
| Aspect                         | Implementation                                                                                | Status   |
| ------------------------------ | --------------------------------------------------------------------------------------------- | -------- |
| Rate Limiting                  | `loginLimiter` (5 requests/15 min), `registerLimiter` (20/hr), `forgotPasswordLimiter` (3/hr) | ✅ Good   |
| Account Enumeration Prevention | `forgotPassword` returns success even if email missing                                        | ✅ Secure |
| Email Verification             | 32-byte random hex token with TTL                                                             | ✅ Secure |
| Concurrent Session Control     | Not implemented                                                                               | 🔴 Gap    |
| Suspicious Activity Detection  | Not implemented                                                                               | 🔴 Gap    |
| Idle Session Timeout           | Not implemented                                                                               | 🔴 Gap    |

### 2.4 AuthN Gaps & Recommendations
1. **[HIGH] Concurrent Session Limiting**: Implement max active sessions per user (e.g., 3-5).
2. **[HIGH] Password Complexity Enforcement**: Add server-side validation for minimum length, mixed case, numbers, special chars.
3. **[MEDIUM] Token Storage Hardening**: Ensure tokens are stored in `httpOnly` cookies or `sessionStorage` (not `localStorage`).
4. **[MEDIUM] JWT Algorithm Upgrade**: Consider RS256 for asymmetric verification in high-security environments.
5. **[LOW] MFA Implementation**: Add TOTP-based MFA for admin/super_admin roles.
6. **[LOW] Idle Session Timeout**: Auto-logout after 30 minutes of inactivity.

---

## 3. Authorization (AuthZ) Architecture

### 3.1 RBAC Implementation
| Aspect                     | Implementation                                            | Status             |
| -------------------------- | --------------------------------------------------------- | ------------------ |
| Role System                | `customer`, `admin`, `super_admin` via DB + `role` column | ✅ Robust           |
| Permission Granularity     | ~40 granular permissions across all modules               | ✅ Excellent        |
| Permission Enrichment      | `enrichUserAuthorization()` flattens DB to arrays         | ✅ O(1) checks      |
| System Role Definitions    | Defined in `shared/authorization.json`                    | ✅ Centralized      |
| Reserved Super Admin Perms | `system_roles.manage`, `users.assign_roles`               | ✅ Proper isolation |
| Role-Permission Junction   | `RolePermission` many-to-many via DB                      | ✅ Normalized       |

### 3.2 Authorization Middleware
| Middleware                         | Function                           | Usage                                  |
| ---------------------------------- | ---------------------------------- | -------------------------------------- |
| `authenticate`                     | JWT validation + user enrichment   | All protected routes                   |
| `optionalAuth`                     | JWT validation without enforcement | Public routes with auth-aware behavior |
| `authorize(...roles)`              | Role-based gate                    | Legacy/transition routes               |
| `authorizePermissions(...perms)`   | ALL permissions required           | Most admin routes                      |
| `authorizeAnyPermission(...perms)` | ANY permission required            | Read-only access routes                |

### 3.3 Route-Level Authorization Matrix

| Module                                          | Authz Middleware                        | `authenticate` | `authorizePermissions` | `authorizeAnyPermission` | Status                   |
| ----------------------------------------------- | --------------------------------------- | -------------- | ---------------------- | ------------------------ | ------------------------ |
| **Auth (auth.routes)**                          | —                                       | Login/Register | —                      | —                        | ✅ Public by design       |
| **Users (user.routes)**                         | `CUSTOMERS_READ`, `CUSTOMERS_MANAGE`    | ✅              | ✅                      | —                        | ✅ Secure                 |
| **Products (product.routes)**                   | `PRODUCTS_READ/CREATE/UPDATE/DELETE`    | ✅              | ✅                      | —                        | ✅ Secure                 |
| **Brands (brand.routes)**                       | `PRODUCTS_CREATE/UPDATE/DELETE`         | ✅              | ✅                      | —                        | ✅ Secure                 |
| **Categories (category.routes)**                | `CATEGORIES_MANAGE`                     | ✅              | ✅                      | —                        | ✅ Secure                 |
| **Orders (order.routes)**                       | `ORDERS_UPDATE_STATUS`, `ORDERS_REFUND` | ✅              | ✅                      | —                        | ✅ Secure                 |
| **Coupons (coupon.routes)**                     | `COUPONS_READ/MANAGE`                   | ✅              | ✅                      | —                        | ✅ Secure                 |
| **Reviews (review.routes)**                     | `REVIEWS_READ/MODERATE/DELETE`          | ✅              | ✅                      | —                        | ✅ Secure                 |
| **Media (media.routes)**                        | `MEDIA_READ/UPLOAD/DELETE`              | ✅              | ✅                      | —                        | ✅ Secure                 |
| **Settings (settings.routes)**                  | `SETTINGS_MANAGE`                       | ✅              | ✅                      | —                        | ✅ Secure                 |
| **SEO (seo.routes)**                            | `SETTINGS_READ/MANAGE`                  | ✅              | ✅                      | —                        | ✅ Secure                 |
| **Audit (audit.routes)**                        | `AUDIT_READ`                            | ✅              | ✅                      | —                        | ✅ Secure                 |
| **Pages (page.routes)**                         | `PAGES_READ/MANAGE`                     | ✅              | —                      | ✅                        | ✅ Secure                 |
| **Admin (admin.routes)**                        | `DASHBOARD_VIEW`, `ROLES_READ`, etc.    | ✅              | ✅                      | ✅                        | ✅ Secure                 |
| **Notifications (notification.routes)**         | `SETTINGS_READ`, `NOTIFICATIONS_MANAGE` | —              | ✅                      | —                        | ⚠️ Mixed — see §4         |
| **Enquiries (enquiry.routes)**                  | `ENQUIRIES_READ/MANAGE`                 | ✅              | ✅                      | —                        | ✅ Secure                 |
| **Shipping Webhooks (shipping.webhook.routes)** | —                                       | —              | —                      | —                        | 🔴 **No auth** — see §4   |
| **Cart (cart.routes)**                          | `optionalAuth`                          | ✅              | —                      | —                        | ✅ Good — supports guests |
| **Wishlist (wishlist.routes)**                  | `authenticate` at router level          | ✅              | —                      | —                        | ✅ Secure                 |

### 3.4 Object-Level Access Control (OLAC)
| Aspect                            | Status                                                             |
| --------------------------------- | ------------------------------------------------------------------ |
| Ownership checks in services      | ✅ Implemented (e.g., `Address.findOne({ where: { id, userId } })`) |
| Self-service restrictions         | ✅ Admins cannot change own status                                  |
| Cross-user data access prevention | ✅ Enforced at service layer                                        |
| Resource-level permissions        | 🔴 Not implemented (e.g., "can edit own orders only")               |

---

## 4. Critical Security Findings

### 🔴 HIGH — Unprotected Webhook Routes
**File:** `server/src/modules/shipping/shipping.webhook.routes.js`
**Finding:** The Shiprocket webhook endpoint (`POST /api/webhook/shipping/shiprocket`) has **no authentication middleware**.
**Risk:** An attacker could spoof shipment status updates, marking orders as delivered when they are not, triggering customer notifications, and potentially closing chargeback windows.
**Mitigation:** Implement webhook signature verification (HMAC) using the `webhookSecret` stored in `ShippingProvider`. This is already implemented in `shipping.webhook.service.js` but should be enforced at the route level with an additional IP allowlist.

### 🔴 HIGH — Global Rate Limiter Applied Twice
**File:** `server/src/app.js` (lines 42, 60)
**Finding:** `app.use('/api', globalLimiter);` appears twice, potentially double-counting requests.
**Risk:** Unintended rate limiting behavior, potential for bypass if one instance is removed without the other.
**Mitigation:** Remove the duplicate line.

### 🟡 MEDIUM — Notifications Routes Partially Unprotected
**File:** `server/src/modules/notification/notification.routes.js`
**Finding:** Some notification template routes use `authorizePermissions` without `authenticate`, which would cause a 500 error if the middleware doesn't handle the missing user gracefully.
**Mitigation:** Add `authenticate` middleware to all notification routes or verify `authorizePermissions` handles `req.user === undefined`.

### 🟡 MEDIUM — Wishlist /items/:productId/to-cart Missing Validation
**File:** `server/src/modules/wishlist/wishlist.routes.js`

---

## 5. Audit Remediation Status (May 2026)

| Finding | Resolution | Status |
|---------|------------|:---:|
| Shipping Webhook (IP Allowlist) | Implemented IP restriction + HMAC verification | ✅ FIXED |
| Product Price Data Leakage | Server-side stripping in `serializeProductPricing` | ✅ FIXED |
| Wishlist-to-Cart Gating | `featureGate('cart')` added to routes + service | ✅ FIXED |
| Coupon Service Gating | Service-level flag checks added to `CouponService` | ✅ FIXED |
| Order Service Coupon Gating | `features.coupons` checked in `placeOrder` | ✅ FIXED |
| SEO Management Gating | `featureGate('seo')` applied to all SEO routes | ✅ FIXED |
| Enquiry Module Gating | `featureGate('enquiry')` applied to all routes | ✅ FIXED |
| Review Module Gating | Global `featureGate('reviews')` module-level gating | ✅ FIXED |
| Notification Auth Gating | `authenticate` middleware verified on all routes | ✅ FIXED |

---

## 6. Audit Logging

### 6.1 Implementation Overview
Audit logs are implemented via a centralized `AuditService` (`server/src/modules/audit/audit.service.js`) and a dedicated `audit_logs` table. The system captures atomic changes to entities by storing "before" and "after" snapshots as JSONB diffs.

### 6.2 Event Coverage
The system logs the following critical events:
- **Authentication**: Successful logins, failed attempts, password resets, and email verifications.
- **Authorization Decisions**: Role creations, permission updates, and role-user assignments.
- **Admin Actions**: CRUD operations on Products, Orders, Coupons, Settings, and CMS Pages.
- **Privilege Changes**: Modifications to user roles or sensitive system settings.

### 6.3 Sensitive Data Handling
- **Redaction**: Sensitive fields like `password`, `token`, and `secret` are automatically redacted or excluded from diffs before storage.
- **Encryption**: API keys and secrets are stored encrypted (AES-256-GCM) and are never stored in plain text within audit logs.
- **PII Exclusion**: Detailed customer PII is minimized in logs, focusing on entity IDs and action summaries.

### 6.4 Retention & Integrity
- **Access Controls**: Access to audit logs is restricted to the `audit.read` permission, reserved exclusively for the `super_admin` role.
- **Integrity**: Every log entry includes a server-generated `createdAt` timestamp and is linked to a `userId` for non-repudiation. Tamper-evidence is maintained through restricted DB write access (only via the `AuditService`).
- **Rotation/TTL**: Log rotation policies are currently managed at the database level (DBA-managed) with a recommended 90-day retention for operational logs and 1-year for security-critical events.

---

**CONCLUSION: All A-to-Z architectural enforcements for the Platform Feature Gating system have been successfully implemented and verified.**
