# Low stock alert ownership and email plan

Status: proposed implementation plan. No recipient routing or job behavior is changed by this document.

## Goal and default decision

Send actionable inventory alerts to the staff responsible for restocking. Customers must never receive operational stock emails. A super admin receives alerts only when no eligible inventory recipient is configured, so alerts cannot silently disappear. Start with email; SMS and WhatsApp are opt-in follow-ups, not automatic channels for every stock event.

## Current behavior and gaps

- `server/src/jobs/lowStockAlert.job.js` runs daily at 09:00 server time. It sends one notification per low-stock variant or simple product, on email, SMS, and WhatsApp.
- `sendToAdmins` in `server/src/modules/notification/notification.service.js` selects users by the legacy `role` column (`admin`/`super_admin`) and appends `ADMIN_NOTIFICATION_EMAIL`/`ADMIN_NOTIFICATION_PHONE`. It does not account for custom RBAC roles, inactive accounts, email verification, recipient preferences, or duplicate addresses.
- The job checks raw `stockQty` or `quantity` with `< threshold`. The dashboard checks published, enabled products using available quantity (`total - reserved`) and `<= threshold`, and distinguishes low stock from out of stock. Inactive variants are also handled differently.
- The job can queue the same alert every day, for every recipient, with no alert history or acknowledgement. It logs an item count as “sent” even when queueing was skipped. The queue retries delivery, but queued jobs do not represent a human acknowledgement.
- Both `low_stock_alert` and `low_stock_admin` templates exist; the job uses `low_stock_admin`. The admin template UI labels `low_stock_alert`, which can mislead an editor into changing an unused template.

## Recipient policy

1. Add an **Inventory alerts** configuration under Admin Settings > Notifications. A super admin (or a staff user with a dedicated `inventory_alerts.manage` permission) selects one or more active staff users as primary recipients. Each selection stores a user ID, not a copied email address; resolve the current verified email when sending.
2. Eligible staff must have an active account, a verified email, and `products.read` plus `products.update` through current RBAC roles/permissions. A custom staff role may qualify. A customer with no inventory permissions cannot be selected, even if they have an email address. Exclude deleted, banned, and inactive users.
3. If there are no eligible selected recipients, send to active, verified super admins and surface a configuration warning in the admin UI. If that also yields no address, record a visible failed/no-recipient event and emit an operations log/metric. Do not silently fall back to a public support address.
4. Keep `ADMIN_NOTIFICATION_EMAIL` as a documented optional emergency address only if explicitly enabled for inventory alerts; validate and deduplicate it with staff addresses. Do not use `ADMIN_NOTIFICATION_PHONE` for the initial email-only rollout.
5. Display a read-only recipient preview (name, role, masked email, eligibility reason) and offer a test email. Never expose full addresses to staff who cannot manage notification routing.

## Alert rules and ownership workflow

1. Create a shared stock evaluation service used by the dashboard and alert job. Scope it to published, enabled products; account for active variants; calculate `available = max(stock - reserved, 0)`; classify `0` as out of stock and `1..threshold` as low stock. Decide at variant granularity for actionable SKU alerts while preserving product rollups for the dashboard. A configured threshold of `0` must remain valid.
2. Send a compact daily digest at a configured store timezone (default 09:00), grouped into **out of stock** and **low stock**, with product name, variant/SKU, available quantity, threshold, and a direct admin inventory link. For an initial backlog of many items, send one digest per recipient rather than one email per SKU.
3. Persist an alert event keyed by product/variant, state, threshold, and day (or a state transition ID). Re-running the scheduler or running multiple app instances must not create duplicate recipient jobs. A new out-of-stock transition may trigger an immediate alert; a recovery above threshold closes the alert. Daily reminders should include only still-open items and honor a configurable reminder interval.
4. Add an admin action to acknowledge an alert and record who owns replenishment, a note, and an expected restock date. Acknowledgement stops repeated reminders until the due date or the stock state worsens; it does not mark the stock healthy. Show unassigned, acknowledged, due, and resolved states in the dashboard.
5. Record routing and delivery separately: intended recipient, queue status, sent/failed status, and human acknowledgement. Log failures without recipient email or SMTP secrets. Treat the email as an operational cue; the dashboard remains the source of truth for current stock.

## Implementation slices

1. **Reconcile stock data:** extract and test the dashboard/job stock calculation; fix threshold, reservation, variant, and published/enabled mismatches. Add tests for zero, boundary equality, inactive variants, reserved quantities, and unpublished products.
2. **Recipient selection:** add settings/migration and API validation for selected user IDs, permission checks, fallback resolution, deduplication, and a preview endpoint. Add tests for custom RBAC staff, inactive/unverified users, missing recipients, and duplicate emails.
3. **Digest and delivery:** add one canonical inventory alert template, queue one email per recipient per digest, use an idempotency key/unique constraint, and update the admin template UI. Test scheduler retries, overlapping instances, queue failures, and a high-volume catalog.
4. **Ownership UI:** add recipient management in Notifications and acknowledgement/assignee controls in the low-stock dashboard. Audit configuration and acknowledgement changes. Keep recipients and stock records separate from customer notification settings.
5. **Rollout:** migrate current notification templates without discarding merchant edits; preview recipients and send a test email; enable digest only after SMTP and recipients are verified. Measure delivered/failed digests, duplicate rate, unassigned alerts, and time to acknowledgement. Document the store timezone and fallback behavior.

## Acceptance criteria

- A verified, active staff member with inventory permissions can be selected and receives the daily digest; a customer, inactive user, or unverified user does not.
- A custom RBAC inventory role works even when its legacy user `role` is `customer`.
- With no selected recipient, an eligible super admin receives the alert and the UI shows the fallback; with no eligible super admin, a visible no-recipient failure is recorded.
- A product with available quantity `0` is marked out of stock, and a product/variant with available quantity equal to the threshold is marked low stock in both dashboard and digest.
- One scheduled run produces at most one digest per recipient for that alert window, including across retries and multiple app instances.
- Acknowledgement, assignee, due date, and resolution are visible and audited. Delivery success never implies human acknowledgement.
- The template shown in admin is the template actually used, and test sends do not alter stock or create live alerts.

## Decisions to confirm before implementation

- Who should be the first primary recipient(s): existing staff user IDs, or a new inventory manager account?
- What is the store timezone and desired digest time? The current 09:00 schedule uses server time.
- Should out-of-stock transitions send an immediate email, or only the daily digest?

The defaults above are: eligible selected staff first, super admin fallback, daily email digest at 09:00 store time, and immediate email for new out-of-stock transitions.
