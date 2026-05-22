# Authentication & Account Security — Complete Guide

> All auth endpoints, flows, and security features in one place.

---

## Table of Contents

1. [Authentication Endpoints](#authentication-endpoints)
2. [Two-Factor Authentication (2FA)](#two-factor-authentication)
3. [Phone OTP Login](#phone-otp-login)
4. [Google OAuth](#google-oauth)
5. [Session Management](#session-management)
6. [Account Changes (Email & Phone)](#account-changes)
7. [Account Deletion](#account-deletion)
8. [Security Features](#security-features)
9. [Environment Variables](#environment-variables)
10. [Database Migrations](#database-migrations)

---

## Authentication Endpoints

### Register
```
POST /api/auth/register
Body: { firstName, lastName, email, password, confirmPassword }
Response: { user, tokens: { accessToken, refreshToken } }
```
- Auto-logs in after registration
- Sends email verification link
- Rate limit: 20 requests / 60 min

### Login (Email + Password)
```
POST /api/auth/login
Body: { email, password, rememberMe? }
Response: { user, tokens } OR { requiresTwoFactor: true, tempToken }
```
- `rememberMe: true` → refresh token lasts 30 days (default: 7 days)
- Email pre-filled on next visit from localStorage
- If 2FA enabled → returns `tempToken` instead of full tokens
- Rate limit: 20 requests / 15 min
- New device/IP triggers email notification

### Refresh Token
```
POST /api/auth/refresh
Body: { refreshToken }
Response: { accessToken, refreshToken }
```
- Rotates refresh token (old one invalidated)
- Reuse detection: replaying a revoked token revokes ALL user sessions
- Rate limit: 30 requests / 15 min

### Logout
```
POST /api/auth/logout (requires auth)
Body: { refreshToken }
```
- Revokes ALL refresh tokens for the user
- Access token added to blocklist (immediate invalidation)

### Forgot Password
```
POST /api/auth/forgot-password
Body: { email }
Response: Always returns success (anti-enumeration)
```
- Sends reset link valid for 15 minutes
- Rate limit: 3 requests / 60 min

### Reset Password
```
POST /api/auth/reset-password
Body: { token, newPassword }
```
- One-time use token
- Revokes all refresh tokens after reset
- Rate limit: 5 requests / 15 min

### Email Verification
```
POST /api/auth/verify-email
Body: { token }

POST /api/auth/resend-verification
Body: { email }
Response: Always generic (no state leak)
```

---

## Two-Factor Authentication

### Setup (Step 1)
```
POST /api/auth/2fa/setup (requires auth)
Response: { qrCodeDataUrl, otpauth, secret }
```
- Returns QR code for authenticator app
- Secret stored encrypted (AES-256-GCM), NOT yet enabled

### Enable (Step 2)
```
POST /api/auth/2fa/enable (requires auth)
Body: { code } (6-digit TOTP)
Response: { enabled: true, backupCodes: ["b2ef58fb", "54388477", ...] }
```
- Verifies user can generate valid codes
- Returns 8 one-time backup codes — **shown only once**
- User must save/download these codes

### Login with 2FA
```
POST /api/auth/2fa/verify
Body: { tempToken, code }
```
- `code` accepts either:
  - **6-digit numeric** TOTP from authenticator app (e.g. `482901`)
  - **8-character hex** backup code (e.g. `b2ef58fb`)
- TOTP is tried first; if it fails/throws, backup code is attempted
- Backup codes are single-use (removed atomically with row lock after use)
- Rate limit: 5 requests / 15 min

### Disable
```
POST /api/auth/2fa/disable (requires auth)
Body: { code } (6-digit TOTP)
```

### Regenerate Backup Codes
```
POST /api/auth/2fa/backup-codes (requires auth)
Body: { code } (6-digit TOTP)
Response: { backupCodes: [...] }
```

### Emergency: Admin Disable
```sql
UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL WHERE email = 'user@example.com';
```

---

## Phone OTP Login

### Send OTP
```
POST /api/auth/otp/send
Body: { phone } (10-15 digits)
Response: { expiresIn: 300 }
```
- 6-digit OTP sent via SMS
- Rate limit: 1 request / 60 seconds per IP
- Service-level: 60s cooldown per phone number

### Verify OTP
```
POST /api/auth/otp/verify
Body: { phone, code }
Response: { user, tokens }
```
- Max 3 failed attempts per OTP, then invalidated
- Auto-creates account if phone is new
- Rate limit: 5 requests / 15 min

### Security
- OTP stored as SHA-256 hash (never plaintext)
- Expires after 5 minutes
- Previous OTPs invalidated on new request

---

## Google OAuth

### Initiate
```
GET /api/auth/google → Redirects to Google consent screen
```

### Callback
```
GET /api/auth/google/callback → Redirects to client with tokens in URL fragment
```
- Client URL: `/oauth/callback#accessToken=...&refreshToken=...`
- Creates account if email is new (email auto-verified)
- Links to existing account if email matches
- Only active when `GOOGLE_CLIENT_ID` is set

---

## Session Management

### List Active Sessions
```
GET /api/users/me/sessions (requires auth)
Response: [{ id, deviceName, ipAddress, lastActiveAt, isCurrent }, ...]
```

### Revoke Specific Session
```
DELETE /api/users/me/sessions/:id (requires auth)
```

### Revoke All Other Sessions
```
DELETE /api/users/me/sessions (requires auth)
Response: { revoked: 3 }
```

### Admin: Force Logout User
```
POST /api/users/:id/force-logout (requires customers.manage permission)
Response: { revoked: 5 }
```

---

## Account Changes

### Change Phone (OTP Verified)
```
POST /api/users/me/phone/request (requires auth)
Body: { phone }  (10-15 digits)
→ Sends OTP to new phone number

POST /api/users/me/phone/confirm (requires auth)
Body: { phone, code }  (6-digit OTP)
→ Updates phone after OTP verification
```
- Checks phone isn't already taken by another user
- Uses same OTP security (SHA-256 hashed, 3 attempts max, 60s cooldown)

### Change Email (Verification Required)
```
POST /api/users/me/email/request (requires auth)
Body: { newEmail, password }
→ Sends verification link to new email address

POST /api/users/me/email/confirm
Body: { token }
→ Switches email after clicking verification link
```
- Requires current password to initiate
- Checks new email isn't already taken
- Verification link valid for 24 hours
- Old email remains active until new one is verified

### Change Password
```
PUT /api/users/me/password (requires auth)
Body: { currentPassword, newPassword }
```
- Password policy: 8+ chars, uppercase, lowercase, digit, special char (!@#$%^&*)

---

## Account Deletion

### Request Deletion
```
DELETE /api/users/me (requires auth)
Body: { password } OR { oauthProvider: "google" }
Response: { scheduledDeletionAt: "2026-07-21T..." }
```
- **30-day grace period** — not immediate
- Blocked if user has active orders
- Sends confirmation email with cancel link
- Rate limit: 20 requests / 15 min

### Cancel Deletion
```
POST /api/users/me/cancel-deletion (requires auth)
```

### What Happens After 30 Days
- Cron job (every 6 hours) hard-deletes users past grace period
- All associated data is permanently removed

---

## Security Features

### Token Security
| Feature | Implementation |
|:--------|:---------------|
| Token storage | SHA-256 hashed before DB storage |
| Access token expiry | 15 minutes |
| Refresh token expiry | 7 days (30 days with Remember Me) |
| Token rotation | New refresh token on every `/refresh` call |
| Reuse detection | Replaying revoked token → all sessions revoked |
| Logout blocklist | Access token immediately invalidated on logout |
| JWT claims | `iss` + `aud` validated on every request |
| Algorithm | Explicit `HS256` whitelist (prevents alg:none) |

### Rate Limiting
| Endpoint | Limit |
|:---------|:------|
| Login | 20 / 15 min |
| Register | 20 / 60 min |
| Forgot password | 3 / 60 min |
| OTP send | 1 / 60 sec |
| OTP verify | 5 / 15 min |
| 2FA verify/enable/disable | 5 / 15 min |
| Refresh | 30 / 15 min |
| Global | 2000 / 15 min |

### Password Policy
```
Minimum 8 characters
At least 1 uppercase letter (A-Z)
At least 1 lowercase letter (a-z)
At least 1 number (0-9)
At least 1 special character (!@#$%^&*)
```

### Anti-Enumeration
- `/forgot-password` → always returns success
- `/resend-verification` → always returns success
- Login → constant-time bcrypt compare (no timing leak)

### Login Notifications
- Email sent on login from new device/IP
- Template: `new_login_alert`

### Account Events (Webhook)
Events emitted: `login`, `logout`, `2fa_enabled`, `2fa_disabled`

Set `ACCOUNT_EVENTS_WEBHOOK_URL` to receive POST payloads:
```json
{ "event": "login", "userId": "...", "ipAddress": "...", "device": "Chrome on Windows", "timestamp": "..." }
```
- Timeout: configurable via `ACCOUNT_EVENTS_WEBHOOK_TIMEOUT_MS` (default: 5000ms)
- PII sanitized: fields matching `password`, `token`, `secret`, `accessToken`, `refreshToken` are masked in logs and webhook payloads
- Non-blocking: webhook failures don't affect the auth flow

---

## Environment Variables

### Required
```env
JWT_ACCESS_SECRET=<random 32+ chars>
JWT_REFRESH_SECRET=<different random 32+ chars>
CREDENTIAL_ENCRYPTION_KEY=<another random 32+ chars — NOT same as JWT secrets>
```

### Auth Features (Optional)
```env
# Google OAuth (leave empty to disable)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SERVER_URL=http://localhost:5000

# JWT Claims (defaults shown)
JWT_ISSUER=ecommerce-pro
JWT_AUDIENCE=ecommerce-pro-client

# Token Expiry (defaults shown)
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Account Events Webhook (leave empty to disable)
ACCOUNT_EVENTS_WEBHOOK_URL=https://your-endpoint.com/events
ACCOUNT_EVENTS_WEBHOOK_TIMEOUT_MS=5000

# App Name (shown in authenticator apps for 2FA)
APP_NAME=My Store
```

---

## Database Migrations

Run all pending migrations:
```bash
cd server && npx sequelize-cli db:migrate
```

### Auth-Related Migrations (in order)
| Migration | Purpose |
|:----------|:--------|
| `20260521100000-hash-existing-tokens` | Hashes all plaintext tokens in DB |
| `20260521110000-add-two-factor-to-users` | `two_factor_enabled`, `two_factor_secret` |
| `20260521120000-add-phone-unique-and-otp-tokens` | Phone index + OTP table |
| `20260521130000-add-scheduled-deletion-to-users` | `scheduled_deletion_at` |
| `20260521140000-add-session-columns-to-refresh-tokens` | `user_agent`, `device_name`, `last_active_at` |
| `20260522110000-add-2fa-backup-codes` | `two_factor_backup_codes` |
| `20260522120000-add-pending-email-to-users` | `pending_email` for email change flow |

---

## Background Jobs

| Job | Schedule | Purpose |
|:----|:---------|:--------|
| `authCleanup` | Every 6 hours | Deletes expired tokens, OTPs, and users past deletion grace period |

---

## Client-Side (Account → Security Tab)

The Security tab contains:
1. **Two-Factor Authentication** — Setup, enable/disable, backup codes
2. **Active Sessions** — View all devices, revoke individual or all
3. **Delete Account** — Schedule deletion with 30-day grace period

---

## Quick Reference: Login Flow Decision Tree

```
User submits credentials
├── Email + Password
│   ├── 2FA enabled? → Show TOTP/backup code input → Verify → Full login
│   └── No 2FA → Full login
├── Phone + OTP
│   ├── Send OTP → Enter code → Verify → Full login
│   └── 2FA enabled? → Additional TOTP step
└── Google OAuth
    └── Redirect → Callback → Full login (2FA skipped for OAuth)
```
