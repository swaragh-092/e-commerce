# Email notifications

## Configure delivery and recipients

1. Apply the pending database migrations from the repository root with `npm --prefix server run migrate`. This installs the new notification templates and the campaign, invitation-token, and assignment fields. Apply migrations before deploying the application code.
2. Open **Admin Settings → Notifications**. Configure SMTP, sender address, and email delivery, then send a test email.
3. Use **Admin and staff email recipients** to choose recipients for order alerts, payment failures, returns and replacements, and enquiries. The default selection uses active admins and configured admin addresses. An explicit selection replaces those defaults for that email category; selecting nobody disables that category. Selected staff must be active, verified, and have the relevant read permission. These email choices do not change SMS or WhatsApp routing.
4. Open **Admin → Templates** to edit or disable individual templates. Inventory alert recipients remain in inventory alert settings.

Customers can opt in with the unchecked-by-default newsletter box during registration or email/password login, or change their choice under **My Account → Email Preferences**. Login saves the choice only after authentication succeeds, including two-factor authentication. Leaving the box unchecked does not unsubscribe an existing subscriber. Newsletter consent controls marketing messages only; account and order notices remain independent.

## Email triggers and recipients

| Template | Trigger | Recipient |
| --- | --- | --- |
| `payment_failed_customer` | Payment failure recorded | Customer |
| `admin_order_failed` | Payment failure recorded | Configured payment recipients |
| `order_refunded` | Refund recorded | Customer |
| `password_changed` | Password changed or reset successfully | Account email |
| `email_changed` | New account email confirmed | Previous account email |
| `return_requested` | Return or replacement request created | Customer |
| `return_status_updated` | Return/replacement status changes, including approval, rejection, and replacement shipment | Customer |
| `admin_return_requested` | Return or replacement request created | Configured return recipients |
| `delivery_exception` | Shipment enters delivery-failed or return-to-origin status | Customer |
| `newsletter_confirmation` | New or renewed newsletter subscription | Subscriber |
| `newsletter_campaign` | Campaign sent to active subscribers | Active subscribers at queue time; consent is checked again at delivery |
| `staff_invitation` | Admin creates a staff account with invitation enabled | New staff member |
| `order_assigned_staff` | An order is assigned to eligible staff | Assigned staff member |
| `enquiry_assigned_staff` | An enquiry is assigned to eligible staff | Assigned staff member |

Account, return, invitation, assignment, and campaign jobs are queued as part of the database transaction that creates or changes the related record. Delivery also requires the notification worker, active template, enabled email delivery, and valid SMTP credentials. Assignment and invitation jobs are checked again before delivery so stale assignments, expired invitations, and replaced invitation links are skipped.

## Campaigns, invitations, and assignments

- **Campaigns:** Open the newsletter subscribers page in the admin area. Create and edit drafts, send a test to your own account, send immediately, schedule for a future time, or cancel a draft/scheduled campaign. The scheduler checks for due campaigns each minute. Campaign messages are plain text and safely escaped in the email template. The unsubscribe link opens a confirmation page; the subscriber is removed only after clicking its button. Delivery counts are shown on the campaigns list.
- **Staff invitations:** In **Access Control → Users**, enable “Email an invitation to set their own password.” The new staff account remains unverified until the recipient uses the emailed setup link. Links expire after 24 hours; requesting a new password link from login replaces the old invitation. Admins can still create staff with a manually set password by leaving invitation mode off.
- **Assignments:** Assign orders from the admin order detail page and enquiries from their detail dialog. Only active, verified staff with the corresponding order-read or enquiry-manage permission can be selected. Reassignment or clearing the assignment prevents the old assignee from receiving a queued notification.

## Migrations and verification

New migrations are:

- `20261012090000-add-customer-payment-failure-email.js`
- `20261012100000-add-account-and-return-emails.js`
- `20261012110000-add-newsletter-campaigns.js`
- `20261012120000-add-staff-invitations.js`
- `20261012130000-add-staff-assignments.js`

Run the focused checks from the repository root:

```sh
npm --prefix server test -- --run tests/unit/notificationRecipients.test.js tests/unit/notificationLifecycle.test.js tests/unit/user.auth.fixes.test.js tests/unit/passwordReset.notification.test.js tests/unit/order.service.test.js
npm --prefix client run build
git diff --check
```

The earlier recipient/lifecycle/auth/order test selection passed, and the frontend production build passed after the campaign, assignment, and invitation UI changes. Live SMTP delivery and applying these migrations to a database have not been verified in this workspace.
