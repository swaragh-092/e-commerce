# Accounts and login security work

**Current update:** see [2026-11-03 implementation and verification](ACCOUNT-LOGIN-SECURITY-2026-11-03.md). The results below are historical unless explicitly dated otherwise.

Date: 2026-11-02. Scope: accounts/login only. Status: local implementation in progress; not deployed or certified complete.

## Confirmed requirements

- Administrators without MFA must be denied login until operator-assisted enrollment.
- Infrastructure in scope: AWS EC2, GitHub, PostgreSQL.
- Do not infer deployment topology, change live credentials, or suspend identities based only on an email address.
- PostgreSQL runs on the AWS EC2 instance. Test both locally and at `https://eshopadmin.swaragh.org.in/admin`.
- Google account policy confirmed: automatically match existing accounts using the same verified email (Option 1). Deployment remains a separate step; no deployment has been performed.

## Checklist and evidence

| Requirement | Repository evidence and local changes | Remaining verification/work |
|---|---|---|
| Remove demo/default accounts | Disabled `20260402100001-demo-users.js`; it no longer creates shared-password admin/customer accounts. Its rollback no longer deletes every user/profile. | Operator must identify and suspend any existing demo identities, revoke sessions, and rotate compromised credentials. No live database was inspected or changed. |
| Mandatory admin/infrastructure MFA | New MFA policy covers legacy admin/super-admin and custom roles based on those roles. Password, phone, Google, refresh, mandatory and optional authentication enforce the policy. Tokens record completed MFA. Admin trusted-device bypass and self-disable are denied. Fixed backup-code verification loading hashes through the default scope that excluded them; protected hashes are now loaded under lock. | Enroll actual admins; validate live flows. Infrastructure MFA is separate and unverified. Old admin sessions require a new MFA login. |
| Hashing/password rules/change | User model hashes with bcrypt cost 12. Registration/reset/change/staff creation retain the existing 8-character complexity rule and now share a 72 UTF-8 byte upper bound to prevent silent bcrypt truncation. | Agree whether to replace the existing minimum/complexity policy. Verify live password change and notification delivery. Existing longer passwords remain accepted at login. |
| Rate limits | Auth and abuse-prone route limiters use the shared PostgreSQL store; login failures and quiet reset/verification email throttles are persisted as hashed identifiers. High-volume global/public traffic shaping remains per-process. | Apply the shared-security-state migration. Confirm trusted proxy configuration and observe the added database writes under production traffic. |
| Reset/OTP expiry and single use | Reset token is hashed, expires after 15m and is consumed under a row lock. OTP expiry is 5m with 3 attempts. Fixed OTP consumption race using a transaction/row lock; failed-attempt increments and deletion commit before errors are returned. | Real PostgreSQL concurrency tests, exact expiry boundaries, concurrent OTP sends, reset/reissue race, and delivery failures still need verification. |
| Account discovery | Login uses a generic invalid-credentials response and dummy bcrypt for unknown users. Forgot-password success text is generic for known/unknown users. | Response timing and downstream notification failure behavior need measurement; successful-password inactive/verification responses are differentiated. Registration explicitly reveals duplicate email. |
| Rotation/reuse | Refresh rows are locked for rotation. Fixed reuse revocation being rolled back by a thrown transaction error. Reuse now commits revocation before rejection; authenticated requests check the durable refresh-session row. | Strict reuse policy treats a simultaneous legitimate refresh as replay. Cross-tab coordination and real DB race tests remain open. |
| Session revocation | Logout, password reset, and session-management flows revoke refresh rows; protected requests check `revoked_at` across workers and restarts. The in-memory blocklist remains a fast path for legacy tokens without session IDs. | Role/permission changes read current permissions on every request but do not consistently revoke sessions. Verify query cost and revocation behavior against a running database. |
| Cookies | Existing auth cookies are HttpOnly, Secure in production, SameSite lax by default; trusted-device cookie is Secure. New OAuth state cookie is HttpOnly, Secure in production, SameSite lax, callback-path scoped, 10m TTL. | Verify production HTTPS, domain, SameSite overrides, CSRF defenses and cookie clearing in browser. Existing trusted-device crypto has default secret fallbacks that still need removal with configuration tests. |
| Google/OAuth | Added browser-bound signed expiring state verification. Missing/false verified-email claims now fail before any account lookup. Redirects use configured server/client URLs, not request redirect parameters. | Live provider callback allowlist/configuration unverified. Existing verified-email auto-linking remains unchanged, as explicitly selected by the user (Option 1). Validate configured URL parsing, deletion grace checks, and linked-account recovery. |
| Expiry/tabs/concurrency | Added regression tests for OTP concurrency and commit-before-error, MFA bypasses and token evidence, OAuth state/email evidence, password byte limits, and demo seeding. Existing API queues refreshes within one tab. | Multiple tabs are not coordinated; browser/session-expiry and simultaneous refresh scenarios are not yet tested against a running target. |

## Learning notes

A transaction is an all-or-nothing boundary. Sequelize managed transactions roll back if the callback throws. Revoking stolen tokens and then throwing inside that callback undid the security action. The fix returns a failure result, lets the transaction commit, and raises the public error afterward.

Single-use means more than deleting a token after reading it: two requests can both read before either deletes. A database row lock serializes OTP verification. Failed attempts also need to survive the rejection response, so those changes commit before returning the validation error.

MFA enrollment and an MFA-authenticated session are different facts. A user enabling MFA must not make older password-only sessions administrative. The server signs MFA evidence only after the MFA verifier succeeds and preserves that evidence during rotation. Enabling MFA alone does not mint a session.

bcrypt limits input by bytes, not characters. The new upper bound checks UTF-8 bytes, including multibyte characters, across all new-password schemas. Login intentionally retains compatibility with existing credentials.

OAuth state connects a callback to the browser that initiated login. A verified Google email claim proves provider verification; it does not decide the product's account-linking policy. The user selected automatic matching by the same verified email. Google notes that external non-Gmail/non-Workspace email verification may not establish current mailbox ownership; the selected policy is retained, and this limitation remains documented.

## Operator-assisted enrollment

Run on the intended server with its configured environment and dependencies, in a private interactive terminal:

```bash
cd server
node src/scripts/enrollAdminMfa.js
```

Use the actual server checkout path when deployed. This command writes MFA enrollment data to that environment's database; it has NOT been run here. Verify the owner's identity out of band, enter the administrator email, and explicitly confirm enrollment. Transfer the provisioning URI privately to the owner, collect their current code, and transfer the one-time backup codes securely. The tool refuses noninteractive use and refuses to reset existing MFA. Do not record terminal output in CI, logs, tickets, or this chat. If verification fails, MFA remains disabled; rerun setup with the owner.

Recovery of an already enrolled administrator requires a separately defined identity-verification procedure. The new tool intentionally cannot disable/reset their existing factor. Customers retain the existing self-service MFA setup/disable flow.

## Infrastructure work requiring live evidence

- AWS: verify root and human administrator MFA, IAM Identity Center/federation settings, and privileged role access. Check EC2 administrative entry paths separately; a console MFA setting does not prove SSH is protected. Prefer temporary workload credentials through instance roles. Identify the actual account/instance and access method before changing policies.
- GitHub: verify owner/admin 2FA and organization policy if this repository belongs to an organization. Inspect deployment credentials separately; human MFA does not make unattended SSH/deploy credentials MFA protected. Repository workflow has read-only GitHub contents permissions and deploys through SSH; no live organization policy was read.
- PostgreSQL: EC2-local deployment is confirmed; next verify the installed PostgreSQL version. Verify human administrative access is gated by the MFA-protected infrastructure path. Check `pg_hba.conf`, SCRAM, least-privilege service roles, network reachability and TLS where needed. SCRAM is password authentication, not MFA. The repository deployment script mentions SCRAM; this is not evidence of the running server's configuration. Do not add interactive MFA to an application's unattended DB login.

## Files changed in this work

Paths relative to the repository root:

- `server/seeders/20260402100001-demo-users.js`
- `server/src/middleware/auth.middleware.js`
- `server/src/modules/admin/admin.validation.js` (existing local edits preserved)
- `server/src/modules/auth/auth.service.js` (existing local edits preserved)
- `server/src/modules/auth/auth.validation.js`
- `server/src/modules/auth/mfaPolicy.js` (new)
- `server/src/modules/auth/oauth.service.js`
- `server/src/modules/auth/oauthState.js` (new)
- `server/src/modules/auth/otp.service.js`
- `server/src/modules/auth/passwordPolicy.js` (new)
- `server/src/modules/auth/tokenUtils.js`
- `server/src/modules/auth/twoFactor.service.js`
- `server/src/modules/user/user.validation.js`
- `server/src/scripts/enrollAdminMfa.js` (new)
- `server/tests/unit/auth.edge.test.js` (Google fixtures now explicitly verified)
- `server/tests/unit/auth.security.test.js` (new)
- `docs/ACCOUNT-LOGIN-SECURITY.md` (new)
- `docs/SECURITY-LEARNING-GUIDE.md` (new, prepared with the Luna agent)
- `docs/INDEX.md` (added links; existing edits preserved)

## Commands and verification

From the repository root:

```bash
cd server
npm test -- --run tests/unit/auth.security.test.js tests/unit/auth.service.test.js tests/unit/auth.edge.test.js tests/unit/auth.cookies.test.js tests/unit/auth.passwordRecovery.test.js tests/unit/user.auth.fixes.test.js
npm test -- --run
```

Focused suite: 68 tests passed. The initial five new regression cases failed before fixes and passed afterward. Tests use database/transaction mocks; they do not establish real PostgreSQL concurrency correctness or live MFA/provider behavior.

Broad server run before the final backup-code regression addition: 96 files passed, 1 failed, 1 skipped; 1240 tests passed, 2 failed, 5 skipped. Both failures are in `tests/unit/product.catalogValidation.test.js`, where `req.validated` is undefined in the two variable-product POST cases; they reproduce in that file alone. No product source was changed by this work. These failures have not been established against a clean baseline, so they are not claimed to be pre-existing.

`git diff --check` and Node syntax checks passed. No deployment, account suspension, credential rotation, database reset, commit, or push was performed.

## Browser verification update: 2026-11-02

- Live admin page: first supplied password returned HTTP 401 with a generic invalid-credentials message. The corrected password returned HTTP 200 and opened the admin dashboard **without an MFA challenge**. This verifies password-only access for this tested account, not the MFA state of every account.
- Live access and refresh cookies both had `HttpOnly=true`, `Secure=true`, `SameSite=Lax`, and path `/`. Only metadata was recorded; no token values were saved in this report.
- Logout of the browser test session returned HTTP 200. Revisiting `/admin` redirected to `/admin/login`. This does not establish copied-token invalidation across processes or restart.
- Local PostgreSQL was reachable. A read-only query found two active legacy administrator accounts with MFA disabled. Initial and corrected-live-password login attempts both returned invalid credentials locally. Local browser MFA enrollment denial has therefore **not** been verified. Local and live credentials are independent; no existing password was changed.
- Local frontend and API were started for this test. The API test process did not start scheduled jobs. No database migrations, live MFA enrollment, or live Google account linking were performed.
- Re-ran focused server auth tests: **68 passed**. Focused client authentication/recovery tests: **6 passed**. The live and local observations above are separate from those automated results.

For beginner explanations and the learning roadmap, read [Security Learning Guide](SECURITY-LEARNING-GUIDE.md).

## Primary references

- [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [Sequelize managed transaction behavior](https://sequelize.org/docs/v6/other-topics/transactions/)
- [AWS IAM security practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [GitHub organization 2FA policy](https://docs.github.com/en/organizations/keeping-your-organization-secure/managing-two-factor-authentication-for-your-organization/requiring-two-factor-authentication-in-your-organization)
- [PostgreSQL password authentication](https://www.postgresql.org/docs/17/auth-password.html) — verify installed version before applying configuration changes.
