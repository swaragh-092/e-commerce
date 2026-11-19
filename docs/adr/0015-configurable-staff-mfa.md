# 0015 - Configurable staff MFA policy

**Status:** proposed
**Date:** 2026-11-05

## Decision

Expose a dedicated Security tab in administrator settings. Only a super administrator with settings management permission may save the policy, after verifying the current password and an authenticator code when enrolled. Customers retain voluntary MFA and cannot be included in mandatory scopes.

Persist the policy in the existing settings table as `auth.mfaPolicy`. Before the first explicit save, preserve the deployment's `REQUIRE_ADMIN_MFA` fallback. Saved policy takes precedence over the environment. Read it on administrative authentication, refresh, and protected actions without a worker-local cache. A failed or invalid policy read fails closed.

Distinguish system administrators from persisted custom staff roles, even when staff also have the legacy `admin` user role. Allow optional staff enrollment, all staff, or selected active custom staff role IDs. Verify all affected active accounts are enrolled before saving stricter requirements. Serialize policy readiness checks with factor changes using account row locks. Block generic settings endpoints from changing this policy without re-verification. Audit the change without storing confirmation credentials.

Expose existing authenticator setup and backup-code management in the admin profile. Factor enable/disable revokes older sessions and creates a verified replacement session in the same transaction for authenticated requests; send credentials only through protected cookies. Keep one-time backup codes visible until explicitly acknowledged. Role-required MFA cannot be disabled through profile controls. The private operator enrollment tool remains available independently of optional policy. Newly created or reassigned required-scope staff retain the owner's deny-until-operator-enrollment flow; there is no pre-login setup bypass.

## Limits

This does not enable mandatory MFA on any deployment, enroll users automatically, configure AWS/GitHub MFA, add passkeys, or automate identity-verification recovery. Lost administrator factors still require the operator recovery procedure. Existing TOTP replay/challenge hardening is separate work.
