# Shiprocket Integration

The application uses Shiprocket's External API flow and keeps provider calls outside the order database transaction.

## Runtime flow

1. Admin creates a fulfillment.
2. The order, inventory deduction, fulfillment, shipment, and a `shipping_operations` row commit together.
3. The operation worker validates live serviceability and runs:
   - `orders/create/adhoc`
   - `courier/assign/awb`
   - `courier/generate/pickup`
   - `courier/generate/label`
   - `orders/print/invoice`
   - `manifests/generate`
4. Provider IDs, AWB, courier, and document URLs are persisted.
5. Failed operations retry with exponential backoff up to eight attempts.
6. Shiprocket webhooks update the shipment only when the status is not stale. Order shipping status is derived from all shipments.

## Provider configuration

Configure the Shiprocket provider in Admin → Shipping:

- API email and password must be the API user credentials, not the normal panel login.
- Pickup pincode must match the warehouse registered in Shiprocket.
- Pickup location must exactly match the Shiprocket pickup-location name.
- Webhook Header Key and Header Value must match the Shiprocket webhook configuration.

The webhook route is:

```text
POST /api/v1/shipping/webhooks/shiprocket
```

`/api/webhook/shipping/shiprocket` remains available as a compatibility route.

Set `SHIPROCKET_WEBHOOK_IPS` to optional exact IPs or IPv4 CIDR ranges. Authentication remains required even when the IP allowlist is empty.

Mock Shiprocket behavior is disabled in production. For local development only, set the provider mode to `mock` or set `settings.allowMock=true`.

## Status handling

Webhook payloads are stored in `shipment_events` before applying a status. Duplicate events are ignored using provider event ID or a deterministic payload hash. A delivered, RTO, or cancelled shipment cannot regress to an earlier status.

Unknown provider statuses are retained as events but do not change the shipment state. They should be reviewed when Shiprocket adds a new status.

## Recovery behavior

- A timeout after Shiprocket creates the shipment does not roll back the local order.
- The operation remains retryable and uses a stable provider request ID.
- After the maximum attempts, the operation becomes `failed` and the shipment exposes `lastProviderError` for admin review.
- Webhook processing returns a 5xx for internal failures so Shiprocket can retry. Invalid authentication returns 403.

## Documentation references

- [Shiprocket API help sheet](https://support.shiprocket.in/support/solutions/articles/43000337456-shiprocket-api-document-helpsheet)
- [Shiprocket webhook configuration](https://support.shiprocket.in/support/solutions/articles/43000630544-introduction-to-account-settings-shiprocket-fulfillment)
- [Shiprocket status updates](https://support.shiprocket.in/support/solutions/articles/152000000322-which-shipment-status-updates-does-shiprocket-send-)
- [Shiprocket COD remittance timing](https://support.shiprocket.in/support/solutions/articles/43000463560-how-soon-can-i-receive-my-cod-amount-in-my-bank-account-)
