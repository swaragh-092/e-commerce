# Accounts and login: local implementation and verification

Date: 2026-11-03. This report supersedes the local implementation status in the 2026-11-02 report. No application deployment or live account modification was performed.

## Scope and decisions

- The live demo account is intentionally retained during testing, as requested. Remove or disable demo credentials before production.
- Administrators must enroll through an operator before they can sign in. Google continues to match accounts automatically by the same verified email, as selected by the user.
- PostgreSQL is hosted on EC2. Local work used the loopback PostgreSQL development database; production database configuration was not changed.
- Existing unrelated workspace edits were preserved.

## Changes made

1. Repaired authentication test isolation for the new database-backed throttle/session queries. Missing, revoked, and expired durable sessions have explicit coverage.
2. Role assignment, shared role permission/base-role changes, and role deletion/reassignment now revoke affected refresh sessions in the same database transaction. Description-only changes do not force logout. Protected requests already consult durable session rows, so revocation is effective across app workers.
3. Browser refresh uses one origin-wide Web Lock. A non-secret localStorage marker distinguishes token rotations from a change of signed-in session. Late 401s use the updated cookie instead of rotating again; old-account requests are rejected after a session switch rather than replayed under the new account. Retried requests are bounded and cannot loop.
4. Login, registration, OTP/MFA verification, password reset, and logout use the same browser lock as refresh. Browsers without Web Locks or usable storage do not attempt unsafe automatic refresh; they require sign-in again. Login/logout remain available. This compatibility tradeoff is intentional and must be included in browser support decisions.
5. Refresh records link to their successors. Refresh and logout lock the user before the token rows. Logout follows completed rotations and revokes that chain while preserving other devices. A late refresh of an already dead chain is rejected without treating it as theft of an active chain; a replay with an active successor still triggers account-wide refresh-session revocation.
6. Protected requests reject an expired durable session even when the signed access JWT itself is not expired.
7. Trusted-device signing/encryption no longer fall back to hard-coded secrets. Cookie SameSite settings are validated; SameSite=None requires Secure. Configured authentication redirect bases reject non-HTTP(S) schemes, credentials, query strings, and fragments; production bases require explicit HTTPS URLs. Multiple CLIENT_URL entries consistently select the first configured frontend base.
8. Applied only the shared-security-state and refresh-successor migrations to the local database. The shared-security-state migration was already present on the PR base; this PR adds only the refresh-successor migration.

## Checklist status

| Item | Local evidence | Before production / remaining evidence |
|---|---|---|
| Demo accounts/default passwords | Demo seeder disabled; trusted-device secret fallbacks removed. | Live demo retained intentionally; disable demo identities/default passwords before launch. |
| Administrator/infrastructure MFA | Real PostgreSQL check verifies password-only admin denial, enrollment, successful MFA, and one-time backup codes using a disposable administrator. | Actual admin enrollment and deployment still required. AWS/GitHub gaps below need owner action. |
| Password hashing/rules/change | bcrypt cost 12 and shared minimum/complexity/72-byte policy remain. Real password reset updates the hash and revokes sessions. | Existing password policy has not been redesigned or certified against a target standard; production delivery/configuration still need validation. |
| Authentication rate limits | Shared tables installed locally. Two store instances share atomic counts; account failures lock; concurrent email-throttle claims allow only one send. | Production migration, trusted proxy configuration and load/query-cost checks remain. |
| Expiring and one-use reset/OTP | Real concurrent OTP and reset consumption allow exactly one success. Expired OTP/reset values are rejected. | Concurrent issuance/reissue and provider delivery failures remain separate cases; no live messages were sent. |
| Account discovery | Generic invalid-credentials/reset response behavior exists. | Timing and notification-error side channels remain unmeasured; registration still reports duplicate email. |
| Refresh rotation/replay | Real simultaneous refresh test verifies one rotation and committed replay revocation. | Strict replay handling intentionally rejects duplicate direct refresh clients. Browser/provider deployment still required. |
| Security-event revocation | Durable logout/reset/suspension paths plus transactional permission-change revocation. Logout-after-rotation, logout/refresh concurrency, device isolation, and rollback verified locally. | Deploy schema/code together; inspect legacy session compatibility. |
| Cookies | Configuration safety tests pass. Live flags were observed 2026-11-02: HttpOnly/Secure/Lax. | No new deployment; verify actual production cookie domain, HTTPS, CSRF behavior and overrides during rollout. |
| Google/OAuth | State and verified-email tests plus redirect configuration validation. Automatic verified-email matching retained. | Actual Google provider callback allowlist and login flow unverified. External Google email verification is not always proof of current mailbox ownership; this limitation remains documented. |
| Expiry/multiple tabs/concurrency | Real PostgreSQL expiry/race checks; real Chromium origin-lock check with two tabs; mocked API tests cover bounded retries and account-switch isolation. | Chromium check uses a simulated refresh operation, not a complete credentialed multi-tab UI flow. Wider browser/device testing remains. |

## Infrastructure observations (read-only)

- AWS root-account MFA indicator: enabled.
- A connected AWS IAM user had no enrolled MFA devices. No IAM configuration was changed. Device enrollment requires the owner's authenticator/security key. MFA enrollment alone also does not establish MFA enforcement for all API/SSH administrative access.
- The connected GitHub organization did not require 2FA.
- GitHub reported that some members and outside collaborators lacked 2FA. Requiring 2FA can restrict member access and remove an outside collaborator's access; the user has been asked whether to wait for enrollment or enable enforcement now. No policy was changed.
- The connected GitHub user's personal MFA field was not exposed by the API. It is unknown, not confirmed disabled.
- EC2 SSH/SSM access, PostgreSQL pg_hba/SCRAM/TLS/role privileges, and the entire AWS user inventory were not audited by these limited reads.

## Verification

- Focused server auth/access-control suite: **120 tests passed across 10 files**.
- Focused client auth/recovery/refresh suite: **16 tests passed across 5 files**.
- Real local PostgreSQL checks: **18 passed**, including shared counters, five-failure lockout, quiet email throttle, OTP and reset consumption races, expiries, refresh replay, durable logout, successor-chain logout/device isolation, rollback, concurrent permission revocation versus rotation, and admin MFA enrollment/login/recovery.
- Disposable fixtures were cleaned up; no notifications were delivered. These tests do not reset a database or alter existing administrator credentials.
- Chromium two-tab checks use the real Web Locks API and localStorage with a simulated rotation, without any tokens. Both tabs shared exactly one rotation; logout completed afterward and the waiting old-session request was rejected with `SESSION_CHANGED`. Earlier pure-refresh checks completed both tabs with one rotation. This verifies real browser coordination, not a complete credentialed UI flow.
- Production client build passed. Node syntax checks and `git diff --check` passed.
- Fresh full server suite on the isolated PR branch: **106 files passed, 3 skipped; 1335 tests passed, 19 skipped**. Unchanged main with the same dependencies: **103 files passed, 3 skipped; 1297 tests passed, 19 skipped**. The earlier product-validation failures no longer reproduce on the current base.
- Fresh client focused suite: **16 tests passed across 5 files**. Full client suite: **683 passed, 3 failed across 4 failing files** (93 passing files). The same four files fail on unchanged main: AttributesPage soft-delete text, SettingsPage feature visibility, static catalog image fallback, and catalogFlows missing jquery. A focused unchanged-main rerun reproduced all four failures (27 passed, 3 failed; the missing dependency prevents one file from collecting). No security test failed.

## Commands

From the repository root:

```bash
cd server
npm test -- --run tests/unit/auth.security.test.js tests/unit/auth.configuration.test.js tests/unit/auth.cookies.test.js tests/unit/auth.edge.test.js tests/unit/auth.service.test.js tests/unit/auth.passwordRecovery.test.js tests/unit/accessControl.sessions.test.js tests/unit/accessControl.plan.test.js tests/unit/accessControl.role.delete.test.js tests/unit/user.auth.fixes.test.js
node tests/integration/auth.postgres.check.js
```

The integration command requires a reachable local non-production PostgreSQL database with the migrations applied. It creates and cleans only disposable fixtures and stubs notification delivery.

```bash
cd client
npm test -- src/test/services/api.refresh.test.js src/test/services/refreshCoordinator.test.js src/test/services/authService.test.js src/test/context/AuthContext.test.jsx src/test/pages/admin/PasswordRecovery.test.jsx
npm run build
```

## Files changed in this continuation

- `client/src/services/api.js`
- `client/src/services/authService.js`
- `client/src/services/refreshCoordinator.js` (new)
- `client/src/test/services/api.refresh.test.js` (new)
- `client/src/test/services/refreshCoordinator.test.js` (new)
- `client/src/test/services/authService.test.js`
- `server/src/modules/admin/admin.service.js`
- `server/src/modules/auth/sessionRevocation.js` (new)
- `server/src/modules/auth/authRedirects.js` (new)
- `server/src/modules/auth/authCookies.js`
- `server/src/modules/auth/auth.routes.js`
- `server/src/modules/auth/oauth.service.js`
- `server/src/modules/auth/auth.service.js`
- `server/src/modules/auth/refreshToken.model.js`
- `server/src/middleware/auth.middleware.js`
- `server/migrations/20261103110000-track-refresh-token-successors.js` (new)
- `server/tests/unit/accessControl.sessions.test.js` (new)
- `server/tests/unit/accessControl.role.delete.test.js`
- `server/tests/unit/auth.configuration.test.js` (new)
- `server/tests/unit/auth.cookies.test.js`
- `server/tests/unit/auth.security.test.js`
- `server/tests/unit/auth.passwordRecovery.test.js`
- `server/tests/integration/auth.postgres.check.js` (new)
- `docs/ACCOUNT-LOGIN-SECURITY-2026-11-03.md` (new)
- `docs/ACCOUNT-LOGIN-SECURITY.md`
- `docs/SECURITY-LEARNING-GUIDE.md`
- `docs/INDEX.md`

The pre-existing shared-security-state migration, LoginAttemptStore, PostgresRateLimitStore and previous MFA work were inspected/used, not introduced by this continuation. Existing unrelated edits inside shared files were retained.

## Review follow-up outside this patch

Independent review identified existing behavior on the base branch that remains to be hardened: MFA challenge JWTs and valid TOTP time-step codes can be reused within their validity window; the Google MFA challenge travels in the login URL without immediate history removal; and initial OAuth account linking revokes prior sessions before MFA completion. These are follow-up items, not claims of complete MFA lifecycle coverage. This patch fixes the newly identified permission-revocation versus refresh race with consistent user-row locks and a real PostgreSQL regression check.

## Rollout limits

Apply migrations before starting the new application code. Drain/replace old workers: old code does not record rotation successors, so old/new workers must not rotate sessions concurrently during rollout. Historical rotation chains cannot be backfilled from the current schema. Plan reauthentication/revocation of legacy sessions during rollout rather than claiming retroactive coverage. These steps have not been performed on the live server.

Do not mark the production checklist complete until infrastructure enrollment/enforcement, actual administrator enrollment, live deployment, and remaining provider/browser checks are finished.

## Primary references

- [Web Locks API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API)
- [Sequelize transactions](https://sequelize.org/docs/v6/other-topics/transactions/)
- [GitHub organization 2FA enforcement and access effects](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-two-factor-authentication-for-your-organization/requiring-two-factor-authentication-in-your-organization)
- [AWS virtual MFA enrollment](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_enable_virtual.html)
