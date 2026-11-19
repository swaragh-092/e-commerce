# Backend audit rollout (v1.2.1.0)

## Deploy order

Run `cd server && npm run migrate` against the deployment database **before deploying the code that requires the shared security tables**. Migration `20261102090000-add-shared-security-state.js` creates shared rate-limit windows, login attempt state, email throttles, and a newsletter delivery-count index. The index is created concurrently; do not wrap this migration in a transaction.

Keep the shared tables in place when reverting application code. Reverting the migration removes active throttle state; stop code that requires those tables before any schema rollback.

## Behavior changes

- Payment webhook deduplication and settlement now commit together, allowing provider retries after failed settlement.
- Auth and selected abuse-sensitive route limits, login failures, and email throttles use PostgreSQL across server instances. Session-bearing access tokens check durable session revocation.
- Newsletter campaign totals and API Builder relation lookups use fewer database queries.
- Media deletion returns HTTP 409 while tracked references exist. Public menu slugs are validated before lookup.

## Remaining limits

Existing webhook markers recorded before a failed settlement are not repaired automatically. Reconcile existing payment/order mismatches separately; the atomic processing change protects future events.

Global and public traffic-shaping limiters remain process-local. Legacy access tokens without a session ID still depend on the process-local token blocklist for immediate logout invalidation.

The media reference check and file deletion are separate operations: a concurrent attachment can still race with deletion. Coordinate those writes if stronger deletion guarantees are required.

## Release verification

Before publication, the backend suite passed **1,301 tests**, with **15 skipped**. Disposable PostgreSQL 18 checks verified migration up/down behavior and shared security-state concurrency. These checks do not replace running migrations against the deployment database or checking the deployed service.
