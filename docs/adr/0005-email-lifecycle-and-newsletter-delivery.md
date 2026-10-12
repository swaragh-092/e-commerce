# 0005 - Email lifecycle and newsletter delivery

**Status:** proposed
**Date:** 2026-10-12
**Spec:** Email notification workflows requested for customers, administrators, and staff
**Deciders:** Project maintainers

## Context

The application had notification templates and queue infrastructure, but several customer account, order, staff, and marketing email workflows were missing. Recipient selection also needed to respect staff permissions, and newsletter campaigns needed to honor opt-out changes even when messages were already queued.

## Decision

Use the existing notification queue and editable notification templates for lifecycle mail. Persist campaign state, staff invitations, and order/enquiry assignments in the application database. Queue related notifications in the same transaction as the change that triggers them, and recheck newsletter consent, invitation validity, and assignment eligibility immediately before delivery. Keep marketing consent separate from required account and order notifications.

## Consequences

- Administrators configure templates and event recipients through the existing admin settings.
- Customers manage newsletter consent from registration, login, and account preferences.
- Campaigns support drafts, tests, scheduled sends, cancellation before queueing, and per-recipient delivery counts.
- New database fields and tables require migrations before deploying the application code.
- SMTP delivery still depends on configured transport credentials and the notification worker.

## Alternatives considered

- Sending lifecycle emails directly from business services was rejected because it would bypass the existing queue, template controls, and retry behavior.
- Treating login without newsletter opt-in as an unsubscribe was rejected because it could silently revoke an existing consent choice.
