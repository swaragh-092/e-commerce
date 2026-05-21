# Authentication System — Complete A-Z Audit

**Date:** 2026-05-21  
**Scope:** Full-stack authentication architecture, security, and test coverage  
**Severity Legend:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | ✅ Compliant

---

## 1. ARCHITECTURE OVERVIEW

The authentication system uses **JWT-based access + refresh token rotation** with bcrypt password hashing, role-based access control (RBAC), email verification, password reset flows, rate limiting, and audit logging. No OAuth/third-party auth exists (the `socialLogin` feature flag is a placeholder).

### Token Flow
```
Client Login → Server issues { accessToken (15m), refreshToken (7d) }
                    ↓
Client stores both in localStorag
                    ↓
Every API call → Authorization: Bearer <accessToken>
                    ↓
On 401 → POST /api/auth/refresh with refreshToken → new token pair
                    ↓
On refresh failure → Clear storage, redirect to /login
```

### Middleware Pipeline
```
helmet → compression → requestId → CORS → globalLimiter → json → morgan →
  [rateLimiter] → [validate] → [authenticate] → [authorizePermissions] →
  controller
```

---

## 2. COMPLETE FILE MAP

### 2.1 Server — Auth Module Core

| File | Lines | Purpose |
|------|-------|---------|
| `server/src/modules/auth/user.model.js` | 99 | Sequelize User model — bcrypt hooks, paranoid soft-delete, password excluded from default scope |
| `server/src/modules/auth/auth.service.js` | 433 | All business logic — JWT generation, token rotation, password hashing, email verification, audit logging |
| `server/src/modules/auth/auth.controller.js` | 95 | 8 route handlers — register, login, refresh, logout, forgotPassword, resetPassword, resendVerification, verifyEmail |
| `server/src/modules/auth/auth.validation.js` | 64 | Joi schemas for all 8 endpoints |
| `server/src/modules/auth/auth.routes.js` | 38 | Route definitions with rate limiters + validation middleware |
| `server/src/modules/auth/refreshToken.model.js` | 46 | RefreshToken model — token, expiresAt, createdByIp, revokedAt |
| `server/src/modules/auth/passwordResetToken.model.js` | 35 | PasswordResetToken model |
| `server/src/modules/auth/emailVerificationToken.model.js` | 35 | EmailVerificationToken model |

### 2.2 Server — Access Control (RBAC)

| File | Purpose |
|------|---------|
| `server/src/modules/access/role.model.js` | Role model — name, slug, baseRole, isSystem, isActive. M:N with Permission + User |
| `server/src/modules/access/permission.model.js` | Permission model — key, name, group, description. M:N with Role |
| `server/src/modules/access/userRole.model.js` | UserRole junction — userId, roleId |
| `server/src/modules/access/rolePermission.model.js` | RolePermission junction — roleId, permissionId |

### 2.3 Server — Middleware

| File | Purpose |
|------|---------|
| `server/src/middleware/auth.middleware.js` | JWT authentication — `authenticate` (required) + `optionalAuth` (best-effort) |
| `server/src/middleware/role.middleware.js` | Authorization — `authorize` (unused), `authorizePermissions`, `authorizeAnyPermission` |
| `server/src/middleware/rateLimiter.middleware.js` | 9 distinct rate limiters for critical endpoints |
| `server/src/middleware/validate.middleware.js` | Joi validation — validates req.body, sets req.validated |
| `server/src/middleware/featureGate.middleware.js` | Feature gating — TTL-cached feature flag resolution |
| `server/src/middleware/sanitize.middleware.js` | HTML sanitization — `deepSanitize`, `sanitizeRichText`, `sanitizePageContent` |
| `server/src/middleware/errorHandler.middleware.js` | Global error handler — maps Sequelize errors, DB timeout/connection handling |

### 2.4 Server — Config & Utils

| File | Purpose |
|------|---------|
| `server/src/config/constants.js` | ROLES, ENTITIES, ACTIONS, AUTH_TIME values |
| `server/src/config/permissions.js` | Permission engine — enriches user authorization, implied permissions |
| `server/src/config/database.js` | PostgreSQL connection pool config with keepalive |
| `server/src/config/modes.js` | Two-tier feature architecture — `emailVerification`, `socialLogin`, `guestCheckout` |
| `server/src/utils/AppError.js` | Custom error class — code, statusCode, isOperational |
| `server/src/utils/response.js` | Standardized JSON response helpers |
| `server/src/utils/crypto.js` | AES-256-GCM encryption for credential storage |
| `server/src/utils/validateEnvironment.js` | Fails fast on weak JWT secrets |
| `server/src/utils/logger.js` | Winston logger |

### 2.5 Server — Supporting Services

| File | Purpose |
|------|---------|
| `server/src/modules/audit/audit.service.js` | Fire-and-forget audit logging for all auth actions |
| `server/src/modules/notification/notification.service.js` | Handlebars templates, queue-based email/SMS/WhatsApp dispatch |
| `server/src/modules/user/user.controller.js` | Profile CRUD, password change, address management |
| `server/src/modules/user/user.service.js` | Profile update, password validation, admin user management |
| `server/src/modules/user/user.routes.js` | Requires authenticate + ACCOUNT_SELF or CUSTOMERS_* for admin |

### 2.6 Server — Entry & Database

| File | Purpose |
|------|---------|
| `server/index.js` | Server entry — env loading, graceful shutdown, pool stats |
| `server/src/app.js` | Express app — Helmet, CORS, compression, all route mounting |
| `server/migrations/20260228100004-create-refresh-tokens.js` | refresh_tokens table |
| `server/migrations/20260402100000-create-password-reset-tokens.js` | password_reset_tokens table |
| `server/migrations/20260402100004-create-email-verification-tokens.js` | email_verification_tokens table |
| `server/migrations/20260411170000-add-refresh-token-audit-columns.js` | created_by_ip and revoked_at columns |

### 2.7 Client — Auth Services & State

| File | Purpose |
|------|---------|
| `client/src/services/authService.js` | Auth API calls — login, register, logout, forgotPassword, resetPassword, verifyEmail, resendVerification, changePassword. localStorage token management |
| `client/src/services/api.js` | Axios instance — Bearer token injection, 401 interceptor with auto-refresh + request queuing |
| `client/src/context/AuthContext.jsx` | Auth context provider — hydrates from localStorage, exposes user/isAuthenticated/roles/permissions/hasRole/hasPermission |
| `client/src/hooks/useAuth.js` | Auth hook — consumes AuthContext, exports useIsSuperAdmin |
| `client/src/utils/permissions.js` | Client-side permission mirroring — PERMISSIONS, ROLES, getRolesForUser, getPermissionsForUser, ADMIN_ROUTE_PERMISSION_MAP |
| `client/src/utils/authValidation.js` | Client-side email/password validation |
| `client/src/utils/apiErrors.js` | Error extraction from Axios responses |

### 2.8 Client — Route Protection & Auth Pages

| File | Purpose |
|------|---------|
| `client/src/routes/ProtectedRoute.jsx` | Route guard — isAuthenticated check, role/permission/permissions checks, redirect to /login |
| `client/src/routes/AppRoutes.jsx` | All routes — storefront auth pages, admin login, admin routes with permission + mode gates |
| `client/src/components/common/AuthRedirectListener.jsx` | Session expiry listener — auth:unauthorized event → redirect to /login |
| `client/src/pages/storefront/LoginPage.jsx` | Email+password, remember me, resend verification link, redirect to state.from |
| `client/src/pages/storefront/RegisterPage.jsx` | Name+email+password with live checklist, confirm password |
| `client/src/pages/storefront/ForgotPasswordPage.jsx` | Email input → sends reset link |
| `client/src/pages/storefront/ResetPasswordPage.jsx` | Token from URL, new password+confirm, redirect after 3s |
| `client/src/pages/storefront/VerifyEmailPage.jsx` | Token from hash/query, auto-verifies on mount |
| `client/src/pages/admin/AdminLoginPage.jsx` | Admin login with role check, redirect to first accessible admin path |
| `client/src/components/storefront/AuthPageShell.jsx` | Hero image + glassmorphism layout |

### 2.9 Shared & Documentation

| File | Purpose |
|------|---------|
| `shared/authorization.json` | Single source of truth — roles (customer/admin/super_admin), 40+ permissions, implies rules |
| `shared/constants.js` | Shared constants |
| `.env.example` | Environment template |
| `SECURITY.md` | Security policy (placeholder) |
| `docs/fix-auth-timeout-plan.md` | Auth timeout fix plan |

### 2.10 Tests

| File | Purpose |
|------|---------|
| `client/src/test/services/authService.test.js` | **1 test** — verifyEmail sends token in POST body |
| `client/src/test/pages/storefront/VerifyEmailPage.test.jsx` | **2 tests** — fragment token read + missing token error |
| `server/tests/unit/permissions.config.test.js` | Permissions config test (not auth-specific) |

---

## 3. ALL AUTH ENDPOINTS

| Method | Endpoint | Auth Required | Rate Limiter | Purpose |
|--------|----------|:---:|:---:|---|
| POST | `/api/auth/register` | No | `registerLimiter` (60m/20) | Register + auto-login + verification email |
| POST | `/api/auth/login` | No | `loginLimiter` (15m/20) | Login, returns access+refresh tokens |
| POST | `/api/auth/refresh` | No | **None** ❌ | Refresh token rotation |
| POST | `/api/auth/logout` | `authenticate` | None | Revoke refresh token |
| POST | `/api/auth/forgot-password` | No | `forgotPasswordLimiter` (60m/3) | Send password reset email |
| POST | `/api/auth/reset-password` | No | **None** ❌ | Reset password with token |
| POST | `/api/auth/resend-verification` | No | `forgotPasswordLimiter` (60m/3) | Resend verification email |
| POST | `/api/auth/verify-email` | No | **None** ❌ | Verify email with token |
| GET | `/api/users/me` | `authenticate` + `ACCOUNT_SELF` | None | Get current user |
| PUT | `/api/users/me` | `authenticate` + `ACCOUNT_SELF` | None | Update profile |
| PUT | `/api/users/me/password` | `authenticate` + `ACCOUNT_SELF` | None | Change password |
| CRUD | `/api/users/me/addresses/*` | `authenticate` + `ACCOUNT_SELF` | None | Address management |

---

## 4. DETAILED SECURITY FINDINGS

### 🔴 CRITICAL

#### C1: Sensitive Tokens Stored in Plaintext in Database / No Hashing
**Files:** `auth.service.js` lines 44, 149, 242, 308  
**Impact:** If the database is compromised, all refresh tokens, password reset tokens, and email verification tokens are immediately usable by an attacker.

- **Refresh tokens** are stored as raw JWT strings in `refresh_tokens.token`. Should store `SHA-256(token)` and look up by hash.
- **Password reset tokens** (`crypto.randomBytes(32).toString('hex')`) stored raw in `password_reset_tokens.token`. Should hash before storage.
- **Email verification tokens** same issue — stored raw.

#### C2: `sanitizeBody()` Middleware Never Mounted Globally — No XSS Protection
**File:** `server/src/app.js` (confirmed — no import or `app.use` of sanitize middleware)  
**Impact:** Every request body passes through unsanitized by default. While Joi validation strips unknown fields, the HTML sanitizer (`sanitize-html`) that strips `<script>`, `onerror`, etc. from string inputs is **never applied**. Any endpoint that doesn't manually call `sanitizeBody()` receives raw, unsanitized input.

The `sanitize.middleware.js` implementation is correct (`deepSanitize` recursively walks objects, whitelist-based tag/attribute filtering). It's just not wired up in `app.js`.

#### C3: Weak/Default Secrets in .env + No Default Detection
**Files:** `.env.example`, `server/src/utils/validateEnvironment.js`  
**Impact:** Default secrets (`change_me_to_a_random_32_char_string` — 38 chars) pass the `>= 32` length check. There's no check against known-default values. If these defaults reach production, all JWT tokens are forgeable.

#### C4: Encryption Key Falls Back to JWT Signing Secret — Key Reuse
**File:** `server/src/utils/crypto.js` line 14  
```js
const keyStr = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_ACCESS_SECRET;
```
**Impact:** If `CREDENTIAL_ENCRYPTION_KEY` is not set, payment gateway credentials are encrypted with the JWT access token signing secret. Anyone who obtains `JWT_ACCESS_SECRET` can decrypt stored payment credentials. Key separation is a fundamental cryptographic requirement.

#### C5: Near-Zero Test Coverage for Authentication
**Files:** `client/src/test/services/authService.test.js` (1 test), `client/src/test/pages/storefront/VerifyEmailPage.test.jsx` (2 tests)  
**Server:** Zero auth service/controller/middleware tests exist.  
**Impact:** No regression safety net. Token rotation, password reset, email verification, rate limiting, authentication middleware — none of it is tested. A single change can silently break auth.

#### C6: Tokens in localStorage — XSS-Extractable
**Files:** `client/src/services/authService.js`, `client/src/services/api.js`, `client/src/context/AuthContext.jsx`  
**Impact:** Both `accessToken` and `refreshToken` are stored in `localStorage`, readable by any JavaScript running on the page. A successful XSS attack trivially steals both tokens. No CSP headers are configured to mitigate this. The `userProfile` object (including roles/permissions) is also cached in localStorage and is client-tamperable.

### 🟠 HIGH

#### H1: No Rate Limiting on `/refresh`, `/reset-password`, `/verify-email`
**File:** `server/src/modules/auth/auth.routes.js` lines 26, 28  
**Impact:** These three endpoints have zero rate limiting:
- `/refresh` — An attacker with a stolen refresh token can hit it at full speed to brute-force or sustain access.
- `/reset-password` — Token-guessing endpoint with no throttle.
- `/verify-email` — Token-guessing endpoint with no throttle.

Contrast with `/login` (20/15min), `/register` (20/60min), and `/forgot-password` (3/60min) which are properly rate-limited.

#### H2: `resendVerification` Leaks Email Verification State
**File:** `server/src/modules/auth/auth.service.js` lines 299–303  
**Impact:** Throws `'Email is already verified'` for verified users, leaking user state. The `forgotPassword` endpoint correctly returns a generic response regardless of whether the email exists. `resendVerification` should do the same.

#### H3: No `algorithms` Whitelist on `jwt.verify()`
**File:** `server/src/middleware/auth.middleware.js` lines 32, 69  
**Impact:** `jwt.verify(token, secret)` is called without specifying `{ algorithms: ['HS256'] }`. While `jsonwebtoken` v9+ defaults to rejecting `none`, there's no explicit enforcement. An `alg: none` vulnerability in a future jsonwebtoken regression would bypass authentication.

#### H4: `optionalAuth` Silently Swallows All Errors Including DB Failures
**File:** `server/src/middleware/auth.middleware.js` lines 58–86  
**Impact:** If the database is down or the JWT secret is misconfigured, `optionalAuth` silently proceeds as unauthenticated with zero logging. All requests silently downgrade to guest access with no observability. This masks infrastructure failures.

#### H5: Login Timing Side-Channel — Email Enumeration
**File:** `server/src/modules/auth/auth.service.js` lines 125–130  
**Impact:** `User.findOne` followed by `validatePassword` creates a timing difference — non-existent emails return faster than valid emails with wrong passwords. While `bcrypt.compare` is constant-time, the DB query happens first and only if the user exists. An attacker can enumerate valid emails through timing analysis.

#### H6: `logout` Doesn't Revoke Sibling Refresh Tokens
**File:** `server/src/modules/auth/auth.service.js` lines 222–238  
**Impact:** Logout only revokes the single presented refresh token. Other active refresh tokens for the same user remain valid. A user logging out from device A leaves device B's session intact. The `refresh()` function handles reuse detection well, but logout is not a full session termination.

#### H7: No Access Token Invalidation on Logout (No Blocklist)
**File:** `server/src/modules/auth/auth.service.js` lines 222–238  
**Impact:** Logout revokes the refresh token only. The access token (stateless JWT, 15-min expiry) remains valid for its remaining lifetime. This is the standard JWT trade-off, but there's no token blocklist mechanism to invalidate access tokens immediately.

### 🟡 MEDIUM

#### M1: Client/Server Password Validation Regex Mismatch
**Client** (`authValidation.js`): Requires uppercase + digit + 8 chars. Does NOT check for symbols or lowercase.  
**Server** (`auth.validation.js`): Requires lowercase + uppercase + digit + symbol + 8 chars.  
**Impact:** Client-side validation passes while server-side rejects, creating confusing UX and support burden.

#### M2: `userProfile` Cached in localStorage — Tamperable
**File:** `client/src/context/AuthContext.jsx` lines 18–21  
**Impact:** User roles and permissions are cached client-side. If used for UI-gating without matching server-side checks, an attacker can modify the cached profile to escalate UI privileges. The server re-validates on API calls, but client-only permission checks are vulnerable.

#### M3: Email Verification Token in URL Fragment — History Leak
**File:** `client/src/pages/storefront/VerifyEmailPage.jsx`  
**Impact:** Token arrives via URL fragment (`#token=...`). While fragments aren't sent to servers, they persist in browser history and could leak via referrer headers. The page scrubs the URL via `navigate(path, { replace: true })` but only after component mount — there's a race condition.

#### M4: No Negative Caching for Unknown Feature Keys — DoS Vector
**File:** `server/src/middleware/featureGate.middleware.js` lines 87–88  
**Impact:** Unknown feature keys are not cached. Repeated requests trigger DB queries. DoS vector: spam requests for non-existent feature keys → continuous DB load.

#### M5: `emailVerificationCache` Is Process-Local — Inconsistent in Cluster Mode
**File:** `server/src/modules/auth/auth.service.js` lines 26–34  
**Impact:** 5-second TTL cache for `isEmailVerificationRequired()` is stored in module-level variable. In a multi-process deployment (cluster mode), each process has its own cache, leading to inconsistent behavior where some requests see stale state.

#### M6: Silent `catch(e) {}` Blocks on Audit/Notification Errors
**File:** `server/src/modules/auth/auth.service.js` — multiple locations  
**Impact:** Audit log failures and notification dispatch failures are silently swallowed with empty `catch(e) {}`. This loses observability — if the audit system breaks, you'd never know. Some calls log to `logger.error()`, others are completely silent. Inconsistent.

#### M7: IP Address Dependency on `trust proxy` Configuration
**File:** `server/src/modules/auth/auth.controller.js` lines 16–17  
**Impact:** `req.ip` is used for refresh token IP logging and reuse detection. If behind a reverse proxy and `trust proxy` is not configured, all requests appear as `127.0.0.1`, making IP-based reuse detection useless. This is a deployment risk.

#### M8: JWT `aud` and `iss` Claims Not Validated
**File:** `server/src/middleware/auth.middleware.js` lines 32, 69  
**Impact:** No audience or issuer claim validation. If the same JWT secret is ever shared across services, tokens from one service would be valid on another.

#### M9: No `trust proxy` Configured in Express
**File:** `server/src/app.js`  
**Impact:** If deployed behind nginx/ALB without `app.set('trust proxy', ...)`, `req.ip` returns the proxy's IP instead of the client's real IP. Rate limiting becomes useless (all requests from same IP). X-Forwarded-For is ignored.

### 🟢 LOW

#### L1: `verifyEmail` Doesn't Check Already-Verified State
**File:** `server/src/modules/auth/auth.service.js` lines 357–374  
**Impact:** If a user is already verified, the token still works and triggers a no-op DB update. Harmless but wasteful.

#### L2: `stripUnknown: true` Silently Drops Fields
**File:** `server/src/middleware/validate.middleware.js` line 18  
**Impact:** Unknown fields are silently stripped from validated bodies. This can mask client bugs where the client sends misnamed fields. Consider logging stripped keys in development.

#### L3: No Token Format Validation Before Storage
**File:** `client/src/services/authService.js`  
**Impact:** Tokens are stored blindly without checking they're non-empty strings or valid JWT format. A compromised server response could store garbage.

#### L4: `SECURITY.md` Is a Placeholder
**File:** `SECURITY.md`  
**Impact:** Contains no actual security policy, reporting process, or vulnerability disclosure instructions.

---

## 5. WHAT'S DONE RIGHT ✅

| Feature | Implementation |
|---------|---------------|
| **Refresh token rotation with reuse detection** | Old token revoked on refresh; replaying revoked token revokes ALL user tokens — excellent theft detection |
| **`forgotPassword` anti-enumeration** | Returns generic response regardless of whether email exists |
| **Password reset revokes all refresh tokens** | Proper session invalidation on credential change |
| **Password hashing** | bcrypt with 12 salt rounds |
| **Password policy** | Server-side: 8+ chars, upper/lower/digit/symbol. Enforced via Joi |
| **Password excluded from default scope** | User model's default scope excludes password field |
| **User soft-delete** | `paranoid: true` on User model |
| **JWT secret validation at startup** | `validateEnvironment.js` fails fast on weak or identical secrets |
| **CSPRNG for token generation** | `crypto.randomBytes(32)` — 256 bits of entropy |
| **Helmet security headers** | Applied globally |
| **CORS whitelist** | Configurable origin validation |
| **Rate limiting on critical endpoints** | login, register, forgot-password appropriately throttled |
| **Audit logging** | All auth actions logged (LOGIN, LOGOUT, REFRESH, PASSWORD_RESET, EMAIL_VERIFIED, VERIFICATION_RESENT) |
| **Feature gates fail closed** | DB errors cause 403, not 200 — no feature bypass during outages |
| **Error handler discriminates operational vs programming errors** | 500 messages redacted in production |
| **DB connection hardening** | keepalive, pool validation, statement_timeout, idle_in_transaction_session_timeout |
| **Admin route masking** | `ADMIN_ROUTE_PREFIX` env var hides admin panel path |
| **Permission implies** | `categories.manage` → `categories.read`, etc. — defined in `shared/authorization.json` |
| **Client-side 401 interceptor with request queuing** | Concurrent requests queued during token refresh, replayed after |

---

## 6. TEST COVERAGE GAP ANALYSIS

### What Exists
- **1 test** in `client/src/test/services/authService.test.js`: `verifyEmail` sends token in POST body
- **2 tests** in `client/src/test/pages/storefront/VerifyEmailPage.test.jsx`: fragment token read + missing token
- **0 auth tests** on the server side (only `permissions.config.test.js` exists, which is RBAC, not auth)

### What's Missing (Server)
- `auth.service.js`: login, register, logout, refreshToken, forgotPassword, resetPassword, resendVerification, verifyEmail
- Token rotation: normal flow, reuse detection, expiry handling
- Password hashing: beforeCreate/Update hooks, password policy enforcement
- Email verification: required/optional modes, state transitions
- Password reset: token expiry, one-time use
- `auth.middleware.js`: valid token, expired token, missing token, malformed token, inactive user
- `role.middleware.js`: has permission, missing permission, implied permission, any match
- Rate limiter behavior on all protected endpoints

### What's Missing (Client)
- `authService.js`: login, register, logout, forgotPassword, resetPassword, resendVerification, changePassword
- LocalStorage interaction: token storage, retrieval, removal on logout/expiry
- Error path handling for all API calls
- `AuthContext.jsx`: login flow, register flow, logout, session hydration from localStorage, unauthorized event handling
- `api.js`: Bearer token injection, 401 interceptor, refresh queue serialization, refresh failure
- `authValidation.js`: email validation, password validation edge cases
- `ProtectedRoute.jsx`: authenticated redirect, unauthenticated redirect, role check, permission check
- `AuthRedirectListener.jsx`: unauthorized event → redirect

---

## 7. FIX PRIORITY MATRIX

| Priority | Finding | Effort | Files |
|:---:|---|:---:|---|
| **P0** | Hash tokens before DB storage (refresh, reset, verification) | Medium | `auth.service.js`, models |
| **P0** | Mount `sanitizeBody` globally in `app.js` | Trivial | `app.js` |
| **P0** | Rotate JWT secrets + add default-value detection to `validateEnvironment.js` | Trivial | `.env`, `validateEnvironment.js` |
| **P0** | Remove encryption key fallback to JWT secret | Trivial | `crypto.js` |
| **P1** | Add rate limiters to `/refresh`, `/reset-password`, `/verify-email` | Trivial | `auth.routes.js`, `rateLimiter.middleware.js` |
| **P1** | Fix `resendVerification` to not leak email state | Trivial | `auth.service.js` |
| **P1** | Add `algorithms: ['HS256']` to `jwt.verify()` calls | Trivial | `auth.middleware.js` |
| **P1** | Add error logging to `optionalAuth` catch block | Trivial | `auth.middleware.js` |
| **P1** | Add constant-time comparison for login email enumeration fix | Small | `auth.service.js` |
| **P2** | Write server-side auth service tests | Large | New test files |
| **P2** | Write server-side auth middleware tests | Medium | New test files |
| **P2** | Write client-side auth service tests | Medium | `authService.test.js` |
| **P2** | Write client-side AuthContext tests | Medium | New test file |
| **P2** | Fix client/server password validation regex mismatch | Trivial | `authValidation.js` |
| **P2** | Add negative caching for unknown feature keys | Small | `featureGate.middleware.js` |
| **P2** | Revoke all user refresh tokens on logout (optional — use dedicated session management) | Small | `auth.service.js` |
| **P3** | Configure CSP headers via Helmet | Medium | `app.js` |
| **P3** | Consider `httpOnly` cookie-based token storage to replace localStorage | Large | `authService.js`, `AuthContext.jsx`, `api.js`, middleware |
| **P3** | Add `aud`/`iss` claim validation to JWT verification | Small | `auth.middleware.js` |
| **P3** | Add `trust proxy` configuration with env var | Trivial | `app.js` |
| **P3** | Populate `SECURITY.md` with actual policy | Trivial | `SECURITY.md` |
| **P3** | Use shared cache (Redis) for `isEmailVerificationRequired` | Medium | `auth.service.js` |

---

## 8. VERIFICATION PLAN

After fixes are applied, verify:

1. **Token hashing**: Attempt to use raw refresh/password-reset/email-verification tokens from DB — should fail
2. **XSS protection**: Send `<script>alert(1)</script>` in body fields — should be stripped
3. **Secret validation**: Set JWT secrets to defaults — server should refuse to start
4. **Rate limiting**: Rapid-fire `/refresh`, `/reset-password`, `/verify-email` — should get 429 after threshold
5. **Anti-enumeration**: Call `/resend-verification` with verified email — should get generic success response
6. **JWT algorithm**: Send token signed with `alg: none` — should be rejected
7. **Test suite**: `npm test` passes with >80% coverage on auth modules
8. **CSP**: Check response headers in browser — `Content-Security-Policy` header present

---

## Appendix: Token Handling Deep Dive

### Token Generation
```
generateTokens(user):
  accessToken = jwt.sign({ id: user.id, role: user.role }, JWT_ACCESS_SECRET, 15m)
  refreshToken = jwt.sign({ id: user.id, role: user.role }, JWT_REFRESH_SECRET, 7d)
  return { accessToken, refreshToken }
```

### Token Rotation (`/refresh`)
```
1. jwt.verify(refreshToken, JWT_REFRESH_SECRET) → decoded
2. SELECT ... FOR UPDATE refresh_token WHERE token = refreshTokenStr
3. If !found → reject (expired or invalid)
4. If revokedAt is set → revoke ALL user tokens (theft detection!) → reject
5. Mark old token revokedAt = now
6. Generate new token pair, store new refresh token
7. Return new accessToken + refreshToken
```

### Client 401 Interceptor
```
Response 401 → is refresh pending?
  YES → queue request
  NO → try: POST /api/auth/refresh with stored refreshToken
    SUCCESS → update localStorage, retry all queued requests
    FAILURE → clear localStorage, dispatch 'auth:unauthorized', redirect to /login
```

### Password Reset Flow
```
1. POST /api/auth/forgot-password { email }
2. Silent return (always — anti-enumeration)
3. Create password_reset_token (15 min expiry), send email
4. User clicks link → POST /api/auth/reset-password { token, password, confirmPassword }
5. Find token, check expiry, check not used
6. Update password, revoke ALL refresh tokens, destroy the reset token
```
