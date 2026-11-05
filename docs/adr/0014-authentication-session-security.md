# 0014 - Authentication and durable session security

**Status:** proposed
**Date:** 2026-11-03
**Deciders:** Store owner and engineering

## Context

Signed JWTs authenticate requests, but security events must invalidate sessions across workers. Refresh rotation, OTP consumption, and password recovery must remain correct under concurrent requests. Administrator MFA must not be bypassed by alternative login methods or older sessions.

## Decision

- Persist rate limits, login failures, and email throttles in PostgreSQL with atomic updates.
- Validate durable refresh-session records on protected requests; revoke sessions transactionally after security and permission changes.
- Rotate refresh tokens under database locks, commit replay revocation before returning an error, and track successors so logout revokes a concurrent rotation on that device.
- Serialize browser refresh and session mutations using Web Locks and a storage epoch. Disable automatic refresh when coordination is unavailable; reject requests from a previous account epoch.
- Require signed MFA evidence for administrative access by default. The owner may set `REQUIRE_ADMIN_MFA=false` to make administrator enrollment optional during rollout; set it to `true` after enrollment to enforce the policy again. Accounts that voluntarily enable MFA still use their verification flow.
- Consume reset tokens and OTPs once under row locks, enforce expiry, and preserve failed-attempt counters on rejection.
- Share the existing new-password rules and enforce bcrypt's 72-byte limit. Remove default cryptographic secrets and demo seeding.
- Bind OAuth callbacks to browser state, require explicit verified-email claims, and validate configured redirects. Retain automatic same-verified-email matching, as selected by the owner.

## Consequences

Apply migrations before serving the new code, drain older workers, and plan reauthentication for legacy sessions whose rotation chains cannot be reconstructed. Enroll administrators before rollout. Infrastructure MFA and live provider configuration require separate operational work; this PR does not deploy or certify production readiness. Browser coordination requires secure-context Web Locks and working local storage.

## References

- [Accounts/login requirements and implementation](../ACCOUNT-LOGIN-SECURITY.md)
- [Verification and rollout limitations](../ACCOUNT-LOGIN-SECURITY-2026-11-03.md)
