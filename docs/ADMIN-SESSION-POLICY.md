# Administrator session lifecycle

## Scope

Administrative users are classified on the server using their administrative roles
and permissions, not the requested URL. Customer session policy is unchanged.
Sensitive-action step-up verification is not part of this change.

## Policy

- An active administrative login lasts at most 12 hours from authentication.
- After 30 minutes without reported user activity, administrative access requires
  authentication again. Refresh and background profile polling do not extend activity.
- Refresh-token rotation preserves the original absolute deadline and last user activity.
- Remembering a device lasts at most 30 days and is separate from active access.
  Device recognition is not proof of identity and never skips password or required MFA.
- The server enforces deadlines; browser clocks and shared browser storage cannot
  authorize an expired session.

## Browser behavior

The administrator receives a warning before the inactivity deadline. At expiry, a
blocking reauthentication dialog leaves the current editor mounted so in-memory edits
are not discarded. No failed write is automatically resubmitted after authentication;
the administrator must review and explicitly save again. Closing or reloading the tab
can still lose unsaved in-memory edits. Lock/activity notifications synchronize tabs,
but unlocking requires a successful server check. Customer pages do not show this UI.

An activity report indicates a visible administrator tab received user input; it is
not intended as protection against malware actively operating an already compromised
browser. Absolute expiry remains enforced even with continuous activity.

## Rollout and rollback

Apply these additive database migrations before deploying the updated server:

- `20261113100000-add-absolute-session-expiry.js` adds the fixed session deadline.
- `20261113110000-create-remembered-devices.js` stores hashed, revocable device credentials.

The existing deployment workflow runs migrations before reloading the backend. Deploy the
server and client together through the existing release workflow. Existing admin
sessions may require signing in again when the new policy is applied. No customer
backfill or external provider setup is required.

Do not undo the schema migration while updated application workers are running.
Rollback application code first; old code can ignore additive session-policy fields.
Remembered-device credentials must never be treated as general access tokens.

## Verification checklist

- Idle and absolute expiry reject both protected requests and refreshes.
- Rotation never resets the absolute deadline or counts as user input.
- Customer session behavior is unchanged.
- Device recognition alone cannot issue an authenticated login.
- Password/MFA reauthentication retains the same administrator identity.
- Another tab cannot unlock by writing a fabricated storage message.
- Unsaved form values survive the lock; rejected writes are not replayed.

## Local verification

Run the focused client/session tests and backend auth tests, then execute
`server/tests/integration/adminSession.postgres.check.js` against a disposable local
PostgreSQL database with all migrations applied. The integration script creates and
removes test users, does not send email, and refuses production/nonlocal databases.
A test-only dashboard permission may remain in that disposable database.
