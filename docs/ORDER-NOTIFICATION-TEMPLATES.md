# Order notification templates

The backend generates `order_url`, `admin_order_url`, and `payment_recovery_url` from the order ID. Storefront links use the first entry in `CLIENT_URL`. Set `NOTIFICATION_ADMIN_URL` to the admin frontend base URL when it runs on a different host. The `/admin` frontend route is separate from `ADMIN_ROUTE_PREFIX`, which configures the backend API.

Use `{{#if order_url}}` around the customer order button: guest orders do not have an account order URL. Use `{{#if support_email}}` around support links. Refund templates can use `refund_amount_display`, `refund_reference`, and `refund_is_partial`. The existing `refund_amount` variable remains available.

Saved templates and notification rule overrides are not rewritten. In the admin template editor, review the saved copy against the updated default. Update the variables in customized templates manually, or reset a template only if you intend to replace its saved copy. Review rule overrides separately. Preview the HTML and text, then send a test email to a controlled inbox before enabling the updated copy.
