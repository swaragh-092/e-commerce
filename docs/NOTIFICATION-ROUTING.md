# Configuring event notifications

Open **Settings → Notifications** (the existing `/admin/email-templates` route).

1. Select an event, such as **Order placed**.
2. Open a notification or choose **Add different message** at the top of the message list.
3. Check **Customer involved in this event**, **Store administrators**, and select specific people, roles, and additional contacts in any combination. Everyone selected on a card shares that card's content. Additional contacts do not need an account. Customers are not selectable as internal people or roles.
4. Select Email, SMS, WhatsApp, or several channels. Write a separate message for each selected channel.
5. Use **Preview message** with sample data or **Send a test** to an explicitly entered address/number. Tests use the current draft and do not save or activate it.
6. Choose **Save event**. The event now uses these rules. Pause a card to stop that notification. Save an empty event to disable its notifications.
7. Open **Delivery history** for the latest 100 queued, processing, sent, failed or skipped deliveries and their reasons.

The mobile page uses an event dropdown. Unsaved event drafts are preserved while switching events. Conflicting saves show an error; reload after reviewing or copying the unsaved content.

## Different content for different recipients

For example, an order can send the customer a thank-you message, administrators an order summary, and Alex packing instructions. Use one message card for each version. Each has independent recipients, Email/SMS/WhatsApp content, activation, preview and testing.

Within a shared card, choose **Separate message** and select a recipient. This can be the involved customer, all store administrators, a role, an additional contact, or one individual staff member (including someone included through a role or the administrator selection). Channels and draft content are copied into a new card for editing. The original card excludes these recipients on every channel, so Alex receives the packing version instead of the shared version. Existing separate messages keep priority when splitting a broader group later.

Shared cards show links to their separate messages. A paused separate message keeps its recipients excluded from the shared message; pausing stops their version. Removing a separate message returns its recipients to the shared card when saved, while preserving any further separate messages beneath it. Changing a separate card's recipients also changes who is excluded from its shared card. The editor filters already-separated targets; open their own card to split them further.

## Supported business events

- Order placed, shipped, out for delivery, delivered, cancelled and refunded.
- Delivery exceptions and payment failures.
- Return/replacement requests and status changes.
- Enquiries received and replies.

**Account & system templates** keeps the existing editor for password resets, verification, account security, staff assignments/invitations, newsletters and inventory messages. Their established recipient restrictions and consent checks remain in force.

## Delivery behavior and edge cases

- The customer comes from the order/enquiry record, including guest contact details; the staff member who handles the event does not become its customer.
- Role selection uses active current members. Changed roles, inactive staff, removed contacts, paused/deleted rules and deselected channels are checked again before queued delivery.
- Repeated selection of the same address within one notification sends one copy per channel. Different notifications can intentionally send different messages to the same recipient.
- **Separate message** creates linked exclusions, including overlapping roles and people. **Add different message** creates an independent card; overlapping recipients on independently created cards can receive both. Shared exclusions apply even if the separate card uses fewer channels or is paused.
- A missing phone number, missing email or phone without a country code is recorded as skipped. Phone contacts should use international format, for example `+919876543210`.
- Online customer order confirmation waits for successful payment. COD confirmation is queued when the order is created. Internal new-order alerts retain their earlier order-created timing.
- Existing notification recipients/templates run until an event is saved. After saving, use the event's recipient controls rather than the older category-wide email recipient controls.
- Existing server-level admin contacts are imported as visible, editable additional contacts. Email-only recipient overrides remain separate from existing mobile admin alerts.
- Development email tests that use placeholder SMTP credentials are identified as simulated; they are not reported as inbox delivery.
- SMS/WhatsApp/Email must be enabled and configured in Messaging settings. Delivery still requires the existing notification worker. Provider test delivery is not part of automated verification.
- API and queue worker code must be updated together. No schema migration or seeding is required.

## Verification commands

From the repository root:

```sh
npm --prefix server test -- --run
npm --prefix client test -- src/test/pages/admin/NotificationEventsPage.test.jsx
npm --prefix client run build
git diff --check
```

Backend tests stub the queue/provider methods; frontend tests mock the notification API. They do not send messages or modify a live order.

## Files changed

Admin UI:

- `client/src/pages/admin/NotificationEventsPage.jsx`
- `client/src/components/admin/settings/NotificationRecipients.jsx`
- `client/src/components/admin/settings/NotificationRuleCard.jsx`
- `client/src/components/admin/settings/NotificationMessageEditor.jsx`
- `client/src/services/notificationService.js`
- `client/src/pages/admin/EmailTemplatesPage.jsx`
- `client/src/pages/admin/SettingsPage.jsx`
- `client/src/components/admin/settings/EmailRecipientsPanel.jsx`
- `client/src/layouts/AdminLayout.jsx`
- `client/src/routes/AppRoutes.jsx`

Backend:

- `server/src/modules/notification/notification.events.js`
- `server/src/modules/notification/notificationRules.service.js`
- `server/src/modules/notification/notificationRules.controller.js`
- `server/src/modules/notification/notification.routes.js`
- `server/src/modules/notification/notification.service.js`
- `server/src/modules/settings/settings.service.js`
- `server/src/modules/order/order.service.js`
- `server/src/modules/payment/payment.service.js`
- `server/src/modules/enquiry/enquiry.service.js`
- `server/src/modules/shipping/shipping.webhook.service.js`

Tests and documentation:

- `client/src/test/pages/admin/NotificationEventsPage.test.jsx`
- `server/tests/unit/notificationRules.test.js`
- `server/tests/unit/enquiry.variants.test.js`
- `server/tests/unit/passwordReset.notification.test.js`
- `server/tests/unit/shipping.webhook.test.js`
- `docs/adr/0008-notification-audiences-and-message-variants.md`
- `docs/NOTIFICATION-ROUTING.md`

## Internal admin alerts

The admin toolbar bell opens the inbox. **My notifications** controls inherited or personal channel choices and email quiet hours. **Assigned rules** lists rules a notification manager has delegated. In **Settings → Notifications → Internal alerts**, notification managers can select an event, add or edit rules, set channel defaults, preview and test messages, restore previous versions, delegate specific fields and recipients, and pause internal email.

Staff changes, order and enquiry assignments, and order and enquiry status changes start with inbox delivery enabled. The existing catalog of order, shipping, payment failure, refund, return and enquiry events is also available for internal rules. Enable the events your team wants to receive. Customer messaging and account or security templates continue to use their existing controls.

### Rollout

1. Run `npm --prefix server run migrate` and deploy the API and notification worker together. Leave `ADMIN_ALERTS_ENABLED=false` until the migration is in place.
2. Open **Settings → Notifications → Internal alerts** and turn on **Enable admin notification inbox**. The saved switch takes precedence over `ADMIN_ALERTS_ENABLED`, which supplies the default until the first change. Set `ADMIN_ALERTS_PILOT_USERS` to comma-separated staff UUIDs, including a notification manager. Leave `ADMIN_ALERTS_EMAIL_ENABLED=false` during the inbox pilot.
3. Configure the existing Messaging email sender and set `ADMIN_ALERTS_PUBLIC_URL` or `CLIENT_URL` to the shop's public application origin. Turn on **Internal email** under **Delivery channels**. The saved switch overrides the server default without a restart. Individual rules still need Email selected, and existing sender settings still apply.
4. Clear the pilot list to roll out to all staff. To move assignment email to internal rules, review both assignment rules. They retain the assignee and carry over compatible subject and summary text from stored assignment templates. Rich HTML, external links, and unsupported legacy variables use the seeded plain-text summary and sign-in link. Set `ADMIN_ALERTS_ASSIGNMENT_EMAIL=true` on API and worker processes in the same release. The switch applies to assignments made after cutover.
5. Turn **Internal email** off to suspend email while leaving the inbox available. The delivery history shows failed and uncertain sends and the age of the oldest unprocessed event. Investigate uncertain SMTP outcomes before sending a replacement message.

Run the PostgreSQL integration check against a fresh, migrated disposable database named `ecommerce_alert_verify` or `ecommerce_alert_verify_<suffix>`. It exercises real assignment and status updates with a stubbed SMTP sender.

```sh
node server/tests/integration/adminAlerts.postgres.check.js
npm --prefix client test -- src/test/pages/admin/AdminAlertsPage.test.jsx src/test/pages/admin/NotificationEventsPage.test.jsx
```
