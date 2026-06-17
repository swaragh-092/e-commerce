# Authentication Hardening — Learning Journal

**Date:** 2026-05-21  
**Session Goal:** Tighten authentication — email verification flow, OAuth, 2FA, phone sign-in, and OTP authentication.

---

## Phase 1: Email Verification Security Fixes

### What We Did
- Hashed all tokens (refresh, password reset, email verification) with SHA-256 before storing in the database
- Added rate limiters to previously unprotected endpoints: `/refresh`, `/reset-password`, `/verify-email`
- Fixed information leak in `resendVerification` — no longer reveals if an email is already verified
- Added `{ algorithms: ['HS256'] }` to all `jwt.verify()` calls to prevent algorithm confusion attacks
- Created a migration to hash existing plaintext tokens in-place

### Why It Matters
- **Token hashing**: If the database is compromised, raw tokens are useless to an attacker — they can't reverse a SHA-256 hash
- **Rate limiting**: Without it, attackers can brute-force token-guessing endpoints at full speed
- **State leak**: Telling an attacker "email is already verified" confirms the account exists and its state
- **Algorithm whitelist**: Prevents `alg: none` attacks where a forged token bypasses signature verification

### Key Pattern Learned
```js
// Store hash, not raw token
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// On create: store hash
await Model.create({ token: hashToken(rawToken) });

// On lookup: hash the incoming token, then query
await Model.findOne({ where: { token: hashToken(incomingToken) } });
```

### Files Changed
- `server/src/modules/auth/auth.service.js` — hash before store, hash before lookup
- `server/src/modules/auth/auth.routes.js` — added rate limiters
- `server/src/middleware/auth.middleware.js` — algorithms whitelist
- `server/src/middleware/rateLimiter.middleware.js` — new limiters
- `server/migrations/20260521100000-hash-existing-tokens.js` — data migration

---

## Phase 2: Two-Factor Authentication (TOTP) Infrastructure

### What We Did
- Added `two_factor_enabled` (boolean) and `two_factor_secret` (JSONB, AES-256 encrypted) to users table
- Created `twoFactor.service.js` using `otplib` for TOTP generation/verification and `qrcode` for QR code generation
- Created endpoints: `POST /auth/2fa/setup`, `POST /auth/2fa/enable`, `POST /auth/2fa/disable`

### Why It Matters
- TOTP (Time-based One-Time Password) adds a second factor — even if password is stolen, attacker needs the authenticator app
- Secret is encrypted at rest with AES-256-GCM — not stored in plaintext
- Setup requires verification before enabling — prevents locking users out if they scan wrong QR

### Key Pattern Learned
```js
// Setup: generate secret, show QR, DON'T enable yet
const secret = authenticator.generateSecret();
const qr = await QRCode.toDataURL(authenticator.keyuri(email, appName, secret));
await user.update({ twoFactorSecret: encrypt(secret) }); // encrypted, not enabled

// Enable: user proves they have the secret by providing a valid code
const secret = decrypt(user.twoFactorSecret);
if (authenticator.verify({ token: code, secret })) {
  await user.update({ twoFactorEnabled: true });
}
```

### Files Created
- `server/src/modules/auth/twoFactor.service.js`
- `server/src/modules/auth/twoFactor.controller.js`
- `server/migrations/20260521110000-add-two-factor-to-users.js`

---

## Phase 3: Integrating 2FA into Login Flow

### What We Did
- Modified login to detect `twoFactorEnabled` and return a short-lived temp token (5min, purpose: '2fa') instead of full auth tokens
- Created `POST /auth/2fa/verify` that accepts `{ tempToken, code }` and completes login
- Temp token is validated for purpose claim to prevent misuse

### Why It Matters
- Full tokens are never issued until 2FA is verified — partial auth state prevents access
- Short expiry (5min) limits the window for brute-forcing the TOTP code
- Purpose claim (`purpose: '2fa'`) prevents using a regular access token as a 2FA bypass

### Key Pattern Learned
```js
// Login with 2FA: two-step flow
// Step 1: Password correct → issue temp token (NOT full access)
if (user.twoFactorEnabled) {
  return { requiresTwoFactor: true, tempToken: jwt.sign({ id, purpose: '2fa' }, secret, { expiresIn: '5m' }) };
}

// Step 2: Verify TOTP → issue real tokens
const decoded = jwt.verify(tempToken, secret);
if (decoded.purpose !== '2fa') throw new Error('Invalid token purpose');
// ... verify TOTP code, then issue full tokens
```

### Files Changed
- `server/src/modules/auth/auth.service.js` — login branching + `verifyTwoFactor()`
- `server/src/modules/auth/auth.controller.js` — new handler
- `server/src/modules/auth/auth.routes.js` — new route

---

## Phase 4: Google OAuth

### What We Did
- Installed `passport` + `passport-google-oauth20`
- Created `oauth.service.js` with Google strategy and `findOrCreateOAuthUser` logic
- Routes: `GET /auth/google` (redirect to Google) → `GET /auth/google/callback` (handle response)
- On callback: find user by email or create new one, mark email as verified, issue tokens, redirect to client

### Why It Matters
- OAuth eliminates password management for users who prefer social login
- Email is pre-verified by Google — no need for verification flow
- Conditional activation (`if (process.env.GOOGLE_CLIENT_ID)`) means no errors when credentials aren't configured

### Key Pattern Learned
```js
// OAuth find-or-create pattern
let user = await User.findOne({ where: { email } });
if (!user) {
  user = await User.create({ email, password: randomBytes(32), emailVerified: true });
}
// Issue tokens same as regular login
```

### Files Created
- `server/src/modules/auth/oauth.service.js`

### Env Vars Added
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SERVER_URL=http://localhost:5000
```

---

## Phase 5: Phone Number Sign-in

### What We Did
- Added partial unique index on `user_profiles.phone` (only non-null values) for fast lookups
- Created `loginByPhone()` in auth service — finds user by phone or auto-creates account
- Phone-only users get a placeholder email (`{phone}@phone.local`) since email is required by the schema

### Why It Matters
- Phone login is essential for markets where users don't have email accounts
- Partial unique index avoids conflicts with NULL values while ensuring no duplicate phones
- Auto-creation reduces friction — user doesn't need a separate registration step

### Key Pattern Learned
```sql
-- Partial unique index: only enforces uniqueness on non-null values
CREATE UNIQUE INDEX user_profiles_phone_unique ON user_profiles (phone) WHERE phone IS NOT NULL;
```

### Files Created
- `server/migrations/20260521120000-add-phone-unique-and-otp-tokens.js`

---

## Phase 6: OTP Authentication

### What We Did
- Created `otp_tokens` table and model for storing hashed OTPs
- Built `otp.service.js` with generate/verify logic including:
  - 6-digit OTP via `crypto.randomInt(100000, 999999)`
  - SHA-256 hash before storage
  - 60-second cooldown per identifier (prevents SMS billing abuse)
  - Max 3 failed attempts per OTP (brute-force protection)
  - Auto-invalidation on expiry or attempt exceed
- Created endpoints: `POST /auth/otp/send` (1 req/min rate limit) and `POST /auth/otp/verify`

### Why It Matters
- **Hash before storing**: Same principle as tokens — if DB is compromised, OTPs are useless
- **3-attempt limit**: A 6-digit OTP has 1M combinations. Without limits, brute-force takes seconds. With 3 attempts, probability of guessing = 0.0003%
- **60s cooldown**: Prevents attackers from exhausting SMS API credits (each SMS costs money)
- **Rate limiter + service cooldown**: Double protection — express-rate-limit per IP, service-level per identifier

### Key Pattern Learned
```js
// OTP brute-force protection
if (record.attempts >= record.maxAttempts) {
  await record.destroy(); // Invalidate — force new OTP request
  throw new Error('Too many failed attempts');
}

if (hashOtp(input) !== record.otpHash) {
  await record.increment('attempts'); // Track failure
  throw new Error(`Invalid OTP. ${remaining} attempts left.`);
}

// Success — destroy immediately (one-time use)
await record.destroy();
```

### Files Created
- `server/src/modules/auth/otpToken.model.js`
- `server/src/modules/auth/otp.service.js`
- `server/src/modules/auth/otp.controller.js`

---

## Client-Side Changes (All Phases)

### What We Did
- **authService.js**: Added methods for 2FA (setup, enable, disable, verify), OAuth (getGoogleOAuthUrl), and OTP (sendOtp, verifyOtp)
- **AuthContext.jsx**: Added `verifyTwoFactor()` and exported `finalizeAuthenticatedSession()`
- **LoginPage.jsx**: Three login modes — email/password, phone/OTP, and 2FA verification step. Google OAuth button.
- **OAuthCallbackPage.jsx**: Receives tokens from URL params after Google redirect, stores them, finalizes session
- **TwoFactorSetup.jsx**: QR code display, enable/disable flow in account settings
- **AccountPage.jsx**: Added "Security" tab with 2FA setup component
- **AppRoutes.jsx**: Added `/oauth/callback` route

### Key UX Pattern Learned
```
Login Flow Decision Tree:
├── Email + Password
│   ├── 2FA enabled? → Show TOTP input → Verify → Full login
│   └── No 2FA → Full login
├── Phone + OTP
│   ├── Enter phone → Send OTP → Enter code → Verify → Full login
└── Google OAuth
    └── Redirect to Google → Callback → Full login
```

---

## Security Summary Table

| Protection | Implementation |
|:---|:---|
| Token theft from DB | SHA-256 hash before storage |
| Brute-force on endpoints | Rate limiters (express-rate-limit) |
| OTP brute-force | 3 attempts max, then invalidate |
| SMS billing abuse | 60s cooldown per identifier + 1 req/min per IP |
| Algorithm confusion (JWT) | Explicit `algorithms: ['HS256']` whitelist |
| State enumeration | Generic responses regardless of account state |
| Stolen password | 2FA (TOTP) as second factor |
| Password fatigue | OAuth + Phone OTP as passwordless alternatives |
| 2FA bypass | Purpose-scoped temp tokens with 5min expiry |
| Encrypted secrets | AES-256-GCM for TOTP secrets at rest |

---

## Migrations to Run
```bash
cd server && npx sequelize-cli db:migrate
```

## New Dependencies
```
otplib@12.0.1        — TOTP generation/verification
qrcode@1.5.4        — QR code generation for 2FA setup
passport@0.7.0      — Authentication middleware
passport-google-oauth20@2.0.0 — Google OAuth strategy
```
