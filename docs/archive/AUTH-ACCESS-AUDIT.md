# Authentication & Access Control Audit Report

**Date:** 2026-04-30
**Auditor:** Antigravity (Senior Full-Stack Engineer)
**Scope:** End-to-end audit of Authentication (AuthN) and Authorization (AuthZ) mechanisms.

---

## 1. Executive Summary
The authentication and access control systems of the e-commerce platform are robustly architected, following modern security best practices and the project's strict non-negotiable rules. The system uses a JWT-based authentication flow with refresh token rotation and a granular Role-Based Access Control (RBAC) system.

## 2. Authentication (AuthN)

### 2.1 Password Security
- **Hashing:** Implemented using `bcryptjs` with a cost factor of `12`.
- **Model Hooks:** Hashing is handled automatically in the `User` model's `beforeCreate` and `beforeUpdate` hooks, ensuring passwords are never stored in plain text.
- **Exposure Control:** The `User` model includes a `defaultScope` that excludes the `password` field from all queries by default. A specific `withPassword` scope is required for authentication checks.

### 2.2 Token Management
- **Flow:** Uses short-lived Access Tokens and long-lived Refresh Tokens.
- **Rotation:** Refresh token rotation is implemented. Upon refreshing an access token, the old refresh token is revoked, and a new one is issued.
- **Revocation:** All refresh tokens for a user are revoked upon password reset, forcing a re-authentication across all devices.

### 2.3 Account Protection
- **Rate Limiting:** Critical endpoints (`/login`, `/register`, `/forgot-password`) are protected by named rate limiters (`loginLimiter`, `registerLimiter`, etc.) to prevent brute-force attacks.
- **Discovery Protection:** `forgotPassword` and `resendVerification` operations return success even if the email does not exist, preventing account enumeration.
- **Verification:** Email verification flow is implemented with 32-byte random hex tokens and TTL enforcement.
Swaragh!93

---

## 3. Access Control (AuthZ)

### 3.1 Role-Based Access Control (RBAC)
- **Structure:** Granular permissions mapping to roles via a many-to-many junction (`RolePermission`).
- **Enrichment:** The `authenticate` middleware uses `enrichUserAuthorization` to flatten complex DB roles/permissions into simple string arrays on the `req.user` object, allowing for O(1) permission checks in middleware.
- **Middleware Gates:**
  - `authorize(...roles)`: Restricts routes to specific roles.
  - `authorizePermissions(...permissions)`: Restricts routes to users having *all* specified permissions.
  - `authorizeAnyPermission(...permissions)`: Restricts routes to users having *any* of the specified permissions.

### 3.2 Object-Level Access Control (OLAC)
- **Implementation:** Services (e.g., `user.service.js`) enforce ownership checks by including `userId` in `where` clauses for updates and deletions (e.g., `Address.findOne({ where: { id, userId } })`).
- **Self-Service Restriction:** Admins are prohibited from changing their own status to prevent lockout scenarios or privilege escalation.

---

## 4. Security Hardening

### 4.1 Input Sanitization
- **XSS Protection:** `sanitizeBody` middleware recursively strips HTML tags from all `req.body` string fields.
- **Rich Text:** `sanitizeRichText` and `sanitizePageContent` use a whitelist approach for administrative content (e.g., product descriptions, custom pages).

### 4.2 Audit Logging
- **Pervasive Logging:** Critical security events (Login, Logout, Password Reset, Status Change, etc.) are logged via `AuditService`.
- **State Tracking:** Logs capture "before" and "after" states for updates, facilitating forensic analysis.
- **Identifier Security:** `audit_logs.entity_id` is stored as `VARCHAR(255)` per rules, supporting both UUID and non-UUID entities.

---

## 5. Compliance with Project Rules

| Rule | Status | Evidence |
| :--- | :--- | :--- |
| **UUID for PKs** | ✅ Passed | All models (`User`, `Role`, `Permission`, etc.) use `UUIDV4`. |
| **Paranoid Mode** | ✅ Passed | `User` and sensitive entities use `paranoid: true`. |
| **Timestamps/Underscored** | ✅ Passed | Consistently applied across all auth-related models. |
| **Password Secrecy** | ✅ Passed | Excluded from default scope and never returned in API. |
| **Audit Log Entity ID** | ✅ Passed | `audit_logs.entity_id` is `VARCHAR(255)`. |
| **Standard Responses** | ✅ Passed | All auth controllers use `success()` and `error()` helpers. |

---

## 6. Recommendations
1. **MFA Support:** Consider adding Multi-Factor Authentication (MFA) for `admin` and `super_admin` roles in future phases.
2. **JWT Algorithm:** Ensure `JWT_ACCESS_SECRET` is sufficiently long and rotated periodically. Current implementation assumes HS256; for very high-security environments, consider RS256.
3. **Session Visibility:** Consider adding an endpoint for users to view and revoke active sessions (refresh tokens) individually.

---
**Audit Status:** 🟢 SECURE
