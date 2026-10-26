# ADR-0008: Event notifications with independent audiences and channel messages

**Status:** proposed
**Date:** 2026-10-26
**Related:** ADR-0005, Email lifecycle and newsletter delivery

## Context

One order or enquiry can require different content for its customer, administrators, selected staff, a role, and an external contact. The template-per-channel editor and category-wide email recipient settings cannot express these independent messages. Existing queue retries, account security messages, and delivery timing must continue to work.

## Decision

- Group the existing business notification triggers into an explicit event catalog. Each message card can combine the involved customer, store administrators, selected people, roles and additional contacts using independent selections. Keep the existing customer/internal rule format readable and add a mixed audience for combined selections.
- Make independent message cards visible at the top of the editor. A separate-message action copies channels/content for a selected recipient or group, including individual role members, and links the new card through `separateRuleIds`. Shared cards exclude linked recipients on all channels, even if the linked card is paused; validate references and reject cycles. Splitting a broader group preserves existing narrower separate messages. Deleting a linked card reconnects its children so further individual versions stay separate.
- Resolve the customer from the actual order or enquiry. Internal people and role options exclude customer accounts and customer roles. Resolve active role membership at event time and recheck eligibility before delivery.
- Store each event's complete validated configuration in the existing JSONB settings table under `messaging.notificationRules_<event>`. Missing configuration preserves legacy delivery; an empty saved rule list explicitly disables that event. Generic settings updates cannot write these keys, and ordinary settings responses omit them.
- Save atomically, with a PostgreSQL transaction advisory lock per event and a revision token to reject concurrent stale updates. Record the change in the audit log. No database migration is required.
- Reuse the notification queue. Each queued delivery snapshots its rule name, actual recipient audience, event, message and allowed business variables. Generate a unique delivery key per event occurrence, notification, channel and normalized recipient. Overlap within one notification is deduplicated and linked separate recipients are excluded. Independently created notifications may intentionally have different content for the same person. Recheck current selections and linked exclusions before queued delivery.
- Keep the original COD and successful-payment acknowledgement timing. Include shipment/refund/return identity in repeatable event occurrences. Queue inside an existing business transaction where provided.
- Keep account credentials, password resets, verification tokens, invitations, newsletter consent checks and inventory digests on their existing protected delivery paths and template editor.

## Consequences

- Admins can configure different customer, staff, role and additional-contact messages on the same event, with draft preview, explicit test recipients, read-only access, revision conflict handling and delivery history.
- Missing or invalid contact details are skipped visibly. Disabling a rule, removing an internal recipient or changing their role prevents pending delivery. Channel failures retain the existing independent retry behavior.
- Existing notifications remain unchanged until an admin saves that event. Saving takes effect for new event occurrences; messages already queued retain their content snapshot and are checked against current activation and recipients.
- The queue worker and API must run the updated code before event rules are activated. Channel transport credentials and the existing notification worker are still required for actual delivery.

## Alternatives considered

- Adding more hard-coded template names or category-wide recipient lists does not support arbitrary independent messages.
- A second delivery system would duplicate the queue, retries and provider settings.
- New rule/template tables are unnecessary for the current bounded, event-scoped configuration; existing JSONB settings provide atomic persistence without a migration.
