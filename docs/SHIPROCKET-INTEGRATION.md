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
   - `manifests/print` (individual order's printable manifest)
4. Checkout's selected courier company ID is pinned on each planned parcel and sent as `courier_id` during AWB assignment. Before a new booking or recovery assignment, the worker checks that the same courier is still available for the destination, weight, dimensions, and payment mode. It does not silently switch couriers; staff must select a replacement if that courier is no longer available. An already-created carrier shipment is reconciled before a fresh serviceability check so temporary availability changes do not create duplicates.
5. The carrier `order_id` is the channel reference (maximum 50 characters). Long internal parcel references are converted deterministically to a numeric reference within that limit; reconciliation checks both the current reference and the historical raw reference. Shiprocket expects `weight` in kilograms and `length`, `breadth`, and `height` in centimetres. The `sub_total` is supplied explicitly from the allocated parcel item prices; Shiprocket does not calculate the order total for the caller.
6. Provider IDs, AWB, courier, and document URLs are persisted.
7. Failed operations retry with exponential backoff for up to eight attempts per retry cycle. An administrator's manual retry grants up to eight additional attempts.
8. Shiprocket webhooks update the shipment only when the status is not stale. Order shipping status is derived from all shipments.

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

Authentication checks the original request bytes. The fallback event hash uses sorted JSON object keys so differences in whitespace or field order do not create new events. Array order and changed values remain significant. Shipping webhook rate limits use a separate counter from payment webhooks.

Delivery notifications are sent after a status change commits, including when tracking polling recovers a missed webhook. Further scans with the same status do not repeat the notification. Delivery makes COD eligible for collection; admin confirmation records cash collected. Full collection and complete delivery close an order in Processing or Ready for shipment.

Unknown provider statuses are retained as events but do not change the shipment state. They should be reviewed when Shiprocket adds a new status.

## Recovery behavior

- A timeout after Shiprocket creates the shipment does not roll back the local order.
- The operation remains retryable and uses a stable provider request ID.
- After the maximum attempts, the operation becomes `failed` and the shipment exposes `lastProviderError` for admin review.
- Webhook processing returns a 5xx for internal failures so Shiprocket can retry. Invalid authentication returns 403.
- An explicit admin retry preserves the cumulative attempt count and adds up to eight more attempts. It refreshes parcel measurements from the shipment and retains the original provider request ID for duplicate recovery.
- A cancelled shipment cannot be retried. Create a replacement shipment from the order instead.

## Shipment cancellation and replacement

Admin cancellation is available before dispatch (Created or Packed). A booked carrier shipment requires carrier cancellation confirmation before the local cancellation commits. A booking currently being processed must finish before cancellation.

Cancelling a parcel keeps the order active. Ordinary product stock is restored and reserved again for that order; staff can create a replacement shipment or cancel the entire order to release that reservation. Combo constituent stock was deducted at order placement, so parcel cancellation keeps that allocation; order cancellation restores it once. Cancelled parcels do not consume fulfilled quantities or prevent selecting the same planned package for a replacement.

The primary Shiprocket shipment cancellation request is `POST /orders/cancel/shipment/awbs` with the AWB in `awbs`; Shiprocket publishes this as **Cancel a Shipment**. If that route is explicitly unavailable (HTTP 404, 405, or 501), the adapter falls back to the documented `POST /orders/cancel` with the Shiprocket order ID in `ids`. It does not fall back on timeouts, authorization failures, or business errors, because the first request's outcome may be ambiguous or meaningful. Both documented cancellation calls may return HTTP 204 with no body; the adapter treats that response as success. Carrier calls run outside database transactions: the shipment is briefly marked `cancelling`, the carrier is called, and local cancellation/inventory changes commit only after confirmation. If the carrier call fails, the prior local state and retryable booking operation are restored. ([Cancel a Shipment](https://www.postman.com/shiprocketdev/shiprocket-dev-s-public-workspace/request/4w7dpu1/cancel-a-shipment) · [Cancel an Order](https://www.postman.com/shiprocketdev/shiprocket-dev-s-public-workspace/request/mp59vq1/cancel-an-order))

After AWB assignment, pickup request, and manifest generation, the integration also calls `POST /manifests/print` with `order_ids: [shiprocketOrderId]` to obtain the order-level printable manifest. If printing is unavailable, the generated manifest URL is retained when available; manifest document generation does not invalidate an otherwise successful carrier booking. ([Print Manifest](https://www.postman.com/shiprocketdev/shiprocket-dev-s-public-workspace/request/2ouddb9/print-manifest))

## Guest contact and order confirmation

Shiprocket requires the billed customer's email. Guest checkout collects an email for physical orders and saves it in the order address snapshot. Bookings use that real contact email; missing or invalid email stops a new carrier order before it is created.

For an older guest order, open Admin → Orders → order detail → Customer → Guest email and save the customer's email. This also updates contact data in queued or failed booking operations. Retry the booking from Shipping → Operations & Failures.

Guest order confirmation requires the matching `X-Session-Id`. Orders store `guestSessionId` separately from `checkoutSessionId`; the checkout identifier does not grant access. Before deploying these changes, run `npm run migrate` from `server` to apply `20261005143000-add-guest-order-session.js`. The migration restores guest ownership from existing address or quote session data where available.

## Documentation references

- [Shiprocket create custom order parameters](https://www.postman.com/shiprocketdev/shiprocket-dev-s-public-workspace/request/idbyek4/create-custom-order)
- [Shiprocket generate AWB](https://www.postman.com/shiprocketdev/shiprocket-dev-s-public-workspace/request/mi8vn05/generate-awb-for-shipment)

- [Shiprocket API help sheet](https://support.shiprocket.in/support/solutions/articles/43000337456-shiprocket-api-document-helpsheet)
- [Shiprocket webhook configuration](https://support.shiprocket.in/support/solutions/articles/43000630544-introduction-to-account-settings-shiprocket-fulfillment)
- [Shiprocket status updates](https://support.shiprocket.in/support/solutions/articles/152000000322-which-shipment-status-updates-does-shiprocket-send-)
- [Shiprocket COD remittance timing](https://support.shiprocket.in/support/solutions/articles/43000463560-how-soon-can-i-receive-my-cod-amount-in-my-bank-account-)
