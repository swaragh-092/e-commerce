# Shipping Integration Plan

This document describes how to build a fully customizable shipping system for the ecommerce platform.

The intended model is:

- Customers do not choose the courier or shipping partner.
- Admin configures delivery partners, shipping rules, serviceable locations, COD rules, and pricing.
- Checkout only shows delivery availability, shipping charge, COD availability, and estimated delivery.
- The system or admin assigns the actual delivery partner internally.
- Third-party partners such as Shiprocket, Ekart, Delhivery, DTDC, BlueDart, or a manual courier flow should plug into one common shipping interface.

## Goals

- Validate delivery availability by pincode before order placement.
- Calculate shipping charges from admin-configured rules.
- Support manual shipping first, then Shiprocket, then Ekart or other partners.
- Keep customer checkout simple.
- Keep vendor-specific API logic outside checkout and order creation.
- Store a shipping snapshot on each order so future admin setting changes do not alter past orders.
- Support tracking updates through webhooks or manual admin updates.

## Non-Goals

- Customers should not see courier comparison or choose a courier.
- Checkout should not call Shiprocket, Ekart, or any vendor directly.
- The frontend should not decide shipping charge or serviceability.
- Vendor API credentials should never be exposed to the frontend.

## High-Level Flow

```txt
Admin configures shipping settings
        |
Customer selects delivery address
        |
Frontend asks backend to check serviceability and calculate shipping
        |
Backend applies admin rules and optional partner serviceability
        |
Checkout shows delivery availability, charge, ETA, and COD availability
        |
Customer places order
        |
Backend revalidates shipping before creating order
        |
Order stores shipping snapshot
        |
After payment/COD confirmation, admin or system creates shipment
        |
Shipping partner returns AWB/tracking/label
        |
Tracking is shown to customer
```

## Customer Experience

Customer should see:

```txt
Delivery available to 560001
Estimated delivery: 3-5 days
Shipping: Rs. 49
COD available
```

Customer should not see:

```txt
Shiprocket - Rs. 52
Ekart - Rs. 48
BlueDart - Rs. 90
```

## Admin Experience

Admin should be able to configure:

- Enabled shipping partners.
- Default shipping partner.
- Manual courier mode.
- Auto partner selection rules.
- Serviceable pincodes, cities, states, and countries.
- Blocked pincodes.
- Shipping charge rules.
- COD availability rules.
- Pickup locations.
- Package defaults.
- Partner credentials.
- Shipment creation behavior.
- Tracking behavior.

Admin should be able to manage order shipment:

- Create shipment.
- Use default partner.
- Override partner.
- Enter manual courier and tracking number.
- Generate AWB.
- Generate label.
- Cancel shipment.
- Update tracking status manually if needed.

## Core Concepts

### Shipping Provider

A provider is a delivery integration or shipping method.

Examples:

- Manual
- Shiprocket
- Ekart
- Delhivery
- DTDC
- BlueDart
- Custom partner

Every provider should implement the same backend adapter interface:

```js
getServiceability(input)
calculateRate(input)
createShipment(input)
cancelShipment(input)
getTracking(input)
handleWebhook(payload)
```

### Shipping Rule

A rule decides whether delivery is allowed and how much shipping should cost.

Examples:

- Free shipping above Rs. 999.
- Flat Rs. 49 shipping for all India.
- Rs. 99 shipping for remote pincodes.
- COD disabled above Rs. 5,000.
- COD disabled for selected pincodes.
- Ekart for local deliveries.
- Shiprocket for prepaid orders.
- Manual courier for same-city orders.

### Shipping Quote

A quote is the backend's temporary shipping decision for the current cart and address.

It should include:

- Serviceability.
- Shipping cost.
- COD availability.
- Estimated delivery range.
- Internal provider decision.
- Expiry time.
- Raw rule or partner response.

The customer does not choose between quotes. The backend returns one final checkout shipping decision.

Quote expiry rules:

- Default quote TTL should be 10 minutes.
- For high-volatility partner rates, use 5 minutes.
- `POST /orders` must reject expired `shippingQuoteId`.
- If a quote expires while the customer is on checkout, the frontend must re-fetch the quote before allowing order placement.
- Expired quotes should not be refreshed silently during order creation unless the request contains enough current checkout context (cartHash, addressHash, paymentMethod, shippingMethod, couponHash, and customerConsent flag) to safely recalculate and return a clear response.

Quote stale-state protection:

- Every quote should store `checkoutSessionId`.
- Every quote should store `cartVersion` or a deterministic `cartHash`.
- Every quote should store `addressVersion` or an address snapshot hash.
- Every quote request must use an idempotency key generated from `checkoutSessionId + cartHash + addressHash + paymentMethod + couponHash`.
- If an identical calculate request arrives within the active quote TTL, backend should return the existing quote instead of creating a duplicate row.
- Backend validation must reject a quote if the cart, address, payment method, or coupon context no longer matches the current order request.
- The frontend should ignore older `/shipping/calculate` responses if a newer request has already been sent.

Quote pricing consistency:

- A quote is authoritative until it expires.
- If admin changes a shipping rule after the quote is created, existing unexpired quotes should still be accepted.
- New quote requests after the rule change should use the new rule.
- This gives the customer stable checkout pricing while still limiting exposure through the short quote TTL.
- If the business needs immediate invalidation for emergency cases, add an explicit `invalidateActiveQuotes` admin action rather than invalidating all quotes on every rule edit.

### Shipping Snapshot

When an order is created, save the final shipping decision into the order.

This protects old orders if admin changes shipping settings later.

Example:

```json
{
  "provider": "shiprocket",
  "providerName": "Shiprocket",
  "mode": "auto",
  "shippingCost": 49,
  "pickupPincode": "600001",
  "deliveryPincode": "560001",
  "codAvailable": true,
  "estimatedDeliveryDays": "3-5",
  "serviceable": true,
  "ruleId": "uuid",
  "quoteId": "uuid"
}
```

## Production Hardening Rules

### Quote Expiry

Shipping quotes must be short-lived.

Recommended default:

```txt
Quote TTL: 10 minutes
Partner live-rate quote TTL: 5 minutes
```

On expiry:

- Frontend must call `/shipping/calculate` again.
- Backend must reject expired `shippingQuoteId`.
- Backend should return a specific error code such as `SHIPPING_QUOTE_EXPIRED`.

### Checkout Concurrency

Checkout can trigger overlapping shipping calls when a customer changes address, payment method, coupon, or cart quickly.

Use both client and server protection:

- Frontend should debounce shipping calculation calls.
- Frontend should track a request sequence number and ignore stale responses.
- Backend should attach each quote to `checkoutSessionId`.
- Backend should validate `cartHash`, `addressHash`, `paymentMethod`, and coupon context during order placement.
- Backend should make `/shipping/calculate` idempotent for identical active requests.

Recommended quote identity fields:

```txt
checkout_session_id
cart_hash
address_hash
payment_method
coupon_hash
idempotency_key
```

Recommended idempotency key:

```txt
checkoutSessionId + cartHash + addressHash + paymentMethod + couponHash
```

If the same key is received and the existing quote is not expired, return that quote.

### Provider Fallback

Shipping must still be recoverable if a provider is down.

Fallback order:

```txt
1. Rule-selected primary provider
2. Rule-selected secondary provider
3. Store default provider
4. Manual provider fallback
```

If all providers fail:

- Checkout should show delivery unavailable or temporarily unavailable.
- Admin should still be able to create a manual shipment after order review if the business allows it.
- Vendor timeout/failure details should be logged for admin/debug use, not shown raw to the customer.

### Rule Conflict Resolution

Shipping rules must resolve deterministically.

Resolution order:

```txt
1. Only enabled rules are considered.
2. Rules must match zone and conditions.
3. Highest priority wins.
4. If same priority, a rule with strictOverride=true wins.
5. If still tied, latest created rule wins.
6. If still tied, fail validation in admin rule preview and require admin cleanup.
```

Admin UI should warn when two enabled rules have the same priority and overlapping conditions.

### Serviceability Cache

Partner serviceability calls can be expensive and rate-limited.

Cache serviceability checks:

```txt
Cache key: provider + pickupPincode + deliveryPincode + paymentMethod
TTL: 6-24 hours
```

Recommended TTL:

- Manual/admin pincode rules: cache until settings version changes.
- Partner serviceability: 6 hours.
- Partner serviceability with rate estimate: 15-60 minutes.
- Failed provider calls: 1-5 minutes to prevent repeated outages from hammering APIs.

Cache must be invalidated when:

- Shipping provider is disabled.
- Pickup location changes.
- Serviceable pincode list changes.
- Shipping rule changes.
- COD settings change.

### Rate Limiting

Shipping calculation APIs must be protected from abuse.

Backend:

- Rate limit by user ID for logged-in users.
- Rate limit by IP for anonymous or failed-auth requests.
- Use stricter limits for vendor-backed live rate calls.
- Return `429` with a user-friendly retry message.

Frontend:

- Debounce address and pincode-driven calculate calls.
- Do not call calculate on every keystroke until pincode is structurally valid.
- Reuse the latest valid quote until checkout input changes.

### Multi-Package And Split Shipments

Do not assume one order always maps to one shipment.

Target relationship:

```txt
order
  └── fulfillments
        └── shipments
              └── shipment_items
```

This supports:

- Multiple warehouses.
- Partial fulfillment.
- Backordered items.
- Different couriers for different packages.
- Replacement or return shipments.

Initial implementation may create one fulfillment and one shipment per order, but the schema and service layer should not block multiple shipments later.

### Payment Dependency

Prepaid shipment creation must wait for successful payment.

Rules:

- Quote is created before payment.
- Order stores locked shipping snapshot at order creation.
- Prepaid shipment is created only after payment success.
- Before creating prepaid shipment, backend must verify the order still has a valid shipping snapshot and serviceable destination. Note: Authoritative quote pricing remains locked after order placement and must not change, but physical serviceability (e.g., provider availability, blocked pincodes, outages) must be revalidated immediately before creating a prepaid shipment. Revalidation does not alter the locked customer charge. Admin should either use fallback provider or manual shipping.
- If payment fails, no shipment should be created.
- If payment is retried after a long delay, backend should re-check serviceability before final shipment creation.

### Pricing Consistency

Shipping quote pricing should be stable for the customer during the quote TTL.

Recommended decision:

```txt
Quote is authoritative until expiry.
```

Example:

```txt
10:00 Customer receives quote: Rs. 49
10:02 Admin changes matching rule to Rs. 99
10:05 Customer places order with unexpired quote
Result: order uses Rs. 49
```

Why:

- Checkout remains predictable.
- Customer does not see surprise price changes while placing the order.
- Business exposure is limited by short TTL.
- Emergency invalidation can still be handled through an explicit admin action.

### Shipping Tax And Currency

Shipping cost must be stored with currency and tax context.

Every quote, order shipping snapshot, and shipment charge record should include:

```txt
shipping_cost
currency
tax_included
tax_amount
tax_breakdown
```

Rules:

- `shipping_cost` should represent the customer-facing shipping charge.
- `currency` should match the order currency.
- `tax_included` tells whether the charge already includes shipping tax.
- `tax_amount` stores the calculated tax component.
- `tax_breakdown` stores GST or other tax details when applicable.
- Backend must include shipping tax rules in the final order total calculation.

### Provider Capabilities

Shipping rules decide business behavior, but providers have their own operational limits.

Provider configuration should include capability flags and limits:

```txt
supports_cod
supports_returns
supports_reverse_pickup
supports_heavy_items
supports_fragile_items
max_weight_kg
max_length_cm
max_breadth_cm
max_height_cm
supported_regions
blocked_regions
```

The rule engine must check both:

```txt
Admin rule allows shipment
Provider capability allows shipment
```

If a rule selects a provider that cannot support the package, pincode, COD, return, or weight, the system should try fallback providers or return unavailable.

### Webhook Idempotency

Provider webhooks may be delivered more than once.

Store provider event identity:

```txt
provider
provider_event_id
provider_shipment_id
awb
event_type
event_timestamp
payload_hash
processed_at
```

Rules:

- If the same `provider_event_id` is received again, ignore it.
- If provider does not send a stable event ID, generate a dedupe key from provider, AWB, status, event timestamp, and payload hash.
- Webhook processing should be safe to retry.
- Status transitions should be idempotent.

### Audit Trail

Shipping rules affect price, COD, and delivery availability, so admin changes must be auditable.

Track changes for:

- Providers.
- Zones.
- Rules.
- Pickup locations.
- COD settings.
- Rate tables.

Minimum audit fields:

```txt
entity_type
entity_id
changed_by
old_value
new_value
reason
created_at
```

This can use the existing audit system if it supports JSON before/after values. If not, create dedicated `shipping_rule_history` and related history tables.

## Proposed Backend Structure

```txt
server/src/modules/shipping/
  shipping.routes.js
  shipping.controller.js
  shipping.service.js
  shipping.validation.js
  shippingProvider.model.js
  shippingRule.model.js
  shippingZone.model.js
  shippingQuote.model.js
  shippingServiceabilityCache.model.js
  shippingRuleHistory.model.js
  shipment.model.js
  shipmentItem.model.js
  providers/
    manual.provider.js
    shiprocket.provider.js
    ekart.provider.js
```

## Proposed API Endpoints

### Storefront APIs

```txt
POST /shipping/check-serviceability
POST /shipping/calculate
```

`POST /shipping/calculate` request:

```json
{
  "shippingAddressId": "uuid",
  "paymentMethod": "cod",
  "buyNowItem": {
    "productId": "uuid",
    "variantId": null,
    "quantity": 1
  }
}
```

Response:

```json
{
  "serviceable": true,
  "shippingCost": 49,
  "codAvailable": true,
  "estimatedDeliveryDays": "3-5",
  "message": "Delivery available",
  "quoteId": "uuid",
  "expiresAt": "2026-04-29T10:40:00.000Z"
}
```

### Order API Change

Extend order placement:

```txt
POST /orders
```

Add:

```json
{
  "shippingAddressId": "uuid",
  "paymentMethod": "razorpay",
  "shippingQuoteId": "uuid",
  "checkoutSessionId": "uuid"
}
```

Backend must revalidate the quote before creating the order. It must reject expired, stale, mismatched, or unavailable quotes.

### Admin APIs

```txt
GET    /admin/shipping/providers
POST   /admin/shipping/providers
PATCH  /admin/shipping/providers/:id

GET    /admin/shipping/rules
POST   /admin/shipping/rules
PATCH  /admin/shipping/rules/:id
DELETE /admin/shipping/rules/:id

GET    /admin/shipping/zones
POST   /admin/shipping/zones
PATCH  /admin/shipping/zones/:id
DELETE /admin/shipping/zones/:id

POST   /admin/orders/:id/shipments
PATCH  /admin/orders/:id/shipments/:shipmentId
POST   /admin/orders/:id/shipments/:shipmentId/cancel
```

### Webhook APIs

```txt
POST /shipping/webhooks/shiprocket
POST /shipping/webhooks/ekart
```

## Proposed Database Changes

### shipping_providers

```txt
id
code
name
type
enabled
is_default
mode
supports_cod
supports_returns
supports_reverse_pickup
supports_heavy_items
supports_fragile_items
max_weight_kg
max_length_cm
max_breadth_cm
max_height_cm
supported_regions
blocked_regions
credentials_encrypted
settings
created_at
updated_at
```

Example `code` values:

```txt
manual
shiprocket
ekart
delhivery
custom
```

### shipping_zones

```txt
id
name
country
state
city
pincodes
blocked_pincodes
enabled
created_at
updated_at
```

`pincodes` can start as JSONB arrays or ranges. Later, if pincode volume becomes large, move to a separate indexed `shipping_pincodes` table.

### shipping_rules

```txt
id
name
priority
enabled
zone_id
provider_id
condition_type
conditions
rate_type
rate_config
cod_allowed
cod_fee
estimated_min_days
estimated_max_days
created_at
updated_at
```

Example `condition_type` values:

```txt
all
subtotal
weight
pincode
state
city
payment_method
category
product
```

Example `rate_type` values:

```txt
free
flat
free_above_threshold
weight_based
order_value_based
custom_table
partner_rate
```

### shipping_quotes

```txt
id
user_id
address_id
provider_id
rule_id
serviceable
shipping_cost
currency
tax_included
tax_amount
tax_breakdown
cod_available
estimated_min_days
estimated_max_days
checkout_session_id
cart_hash
address_hash
payment_method
coupon_hash
idempotency_key
input_snapshot
decision_snapshot
raw_response
expires_at
created_at
updated_at
```

### shipments

```txt
id
order_id
fulfillment_id
provider_id
provider_order_id
provider_shipment_id
awb
courier_name
tracking_number
tracking_url
label_url
manifest_url
invoice_url
status
status_history
raw_response
created_at
updated_at
```

The existing `fulfillments` table can still represent item-level fulfillment. The new `shipments` table stores vendor-specific delivery details.

### shipment_events

```txt
id
shipment_id
provider_id
provider_event_id
awb
event_type
event_status
event_timestamp
payload_hash
raw_payload
processed_at
created_at
updated_at
```

Clarify and codify a preferred deduplication strategy:
1.  **Primary Dedupe**: Use the composite key `provider_id` + `provider_event_id` when `provider_event_id` is present and stable. Enforce with a unique index constrained to rows where `provider_event_id IS NOT NULL`.
2.  **Fallback Dedupe**: Use `provider_id` + `awb` + `event_status` + `event_timestamp` + `payload_hash` when `provider_event_id` is null or missing. Enforce with a separate unique index on these fields.

Update the webhook ingestion logic to first attempt lookup/insert using `provider_event_id` and only fall back to the composite when `provider_event_id` is absent.

### shipment_items

```txt
id
shipment_id
order_item_id
quantity
created_at
updated_at
```

This table makes split shipments and multi-package fulfillment possible.

### shipping_serviceability_cache

```txt
id
cache_key
provider_id
pickup_pincode
delivery_pincode
payment_method
serviceable
cod_available
estimated_min_days
estimated_max_days
raw_response
expires_at
created_at
updated_at
```

### shipping_rule_history

```txt
id
rule_id
changed_by
change_type
old_value
new_value
reason
created_at
```

If the existing audit log can capture this cleanly, use the shared audit system instead of a dedicated table.

### orders

Add:

```txt
shipping_quote_id
shipping_snapshot
shipment_status
checkout_session_id
shipping_currency
shipping_tax_included
shipping_tax_amount
shipping_tax_breakdown
```

The existing `shipping_cost` column should continue to store the final charged shipping amount.

### products / product_variants

Add package fields:

```txt
weight_kg
length_cm
breadth_cm
height_cm
```

Optional later:

```txt
fragile
dangerous_goods
requires_cold_chain
```

## Phase 1: Shipping Foundation

### Objective

Create the base shipping module without third-party integrations.

### Backend Tasks

- Create `shipping` module.
- Add provider, zone, rule, quote, and shipment models.
- Add shipment item model so split shipment support is not blocked later.
- Add serviceability cache model.
- Add shipping rule history or connect shipping entities to the existing audit system.
- Add provider capability fields.
- Add quote idempotency key and quote identity fields.
- Add shipping currency/tax fields to quote and order shipping snapshot.
- Add migrations.
- Add validation schemas.
- Add admin CRUD APIs for providers, zones, and rules.
- Add `manual` provider adapter.
- Add service methods:
  - `checkServiceability`
  - `calculateShipping`
  - `createShippingQuote`
  - `validateShippingQuote`

### Frontend Admin Tasks

- Add Shipping Settings page or section.
- Allow admin to configure:
  - Manual shipping provider.
  - Flat rate.
  - Free shipping threshold.
  - Serviceable pincodes/states.
  - Blocked pincodes.
  - COD allowed or disabled.

### Checkout Tasks

- Keep current flat-rate logic temporarily as fallback.
- Add backend call after address selection:
  - Check serviceability.
  - Show shipping cost.
  - Show COD availability.
- Debounce shipping calculate requests.
- Ignore stale calculate responses when a newer request is in flight.
- Disable place order if delivery is unavailable.

### Acceptance Criteria

- Admin can configure manual shipping.
- Checkout blocks unavailable pincodes.
- Checkout displays backend-calculated shipping cost.
- Order stores shipping snapshot.
- No third-party API is required.
- Quote responses include `quoteId` and `expiresAt`.
- Expired quote handling is implemented.
- Identical active quote requests return the same quote instead of creating duplicates.

## Phase 2: Order Integration

### Objective

Make order placement depend on backend shipping quote validation.

### Backend Tasks

- Add `shippingQuoteId` to `POST /orders`.
- Recalculate or revalidate quote in `OrderService.placeOrder`.
- Reject expired, mismatched, or unavailable shipping quotes.
- Reject quotes whose `checkoutSessionId`, `cartHash`, `addressHash`, payment method, or coupon context does not match.
- Treat unexpired quote pricing as authoritative even if admin rules changed after quote creation.
- Save:
  - `shippingCost`
  - `shippingCurrency`
  - `shippingTaxIncluded`
  - `shippingTaxAmount`
  - `shippingTaxBreakdown`
  - `shippingQuoteId`
  - `shippingSnapshot`
  - `checkoutSessionId`
- Pass final shipping cost into coupon resolution so free-shipping coupons work correctly.

### Frontend Tasks

- Update checkout to request shipping quote when:
  - Address changes.
  - Cart changes.
  - Payment method changes.
  - Coupon changes if shipping discount depends on coupon.
- Include `shippingQuoteId` in `placeOrder`.
- Include `checkoutSessionId` in quote and order requests.
- If COD is not available for the selected pincode, hide or disable COD.
- If backend returns `SHIPPING_QUOTE_EXPIRED`, re-fetch the quote and ask the customer to place the order again.

### Acceptance Criteria

- Frontend no longer calculates authoritative shipping cost.
- Backend rejects stale or invalid shipping quotes.
- Orders have correct shipping cost snapshots.
- Orders preserve quote currency and shipping tax details.
- COD is blocked where not allowed.
- Fast address/cart/payment changes cannot place an order using a stale quote.

## Phase 3: Admin Shipment Management

### Objective

Allow admin to create and manage shipments manually.

### Backend Tasks

- Add shipment creation API for admin.
- Support one order with multiple fulfillments and shipments.
- Support manual shipment:
  - Courier name.
  - Tracking number.
  - Tracking URL.
  - Notes.
- Link shipment to fulfillment.
- Link shipment items to order items.
- Update fulfillment status.
- Add shipment status history.

### Frontend Admin Tasks

- In admin order detail page, add:
  - Create Shipment button.
  - Manual courier form.
  - Tracking number field.
  - Tracking URL field.
  - Shipment status update.
- Display shipment details in order detail.

### Storefront Tasks

- Show shipment tracking info in customer order detail.

### Acceptance Criteria

- Admin can create a manual shipment.
- Customer can see courier and tracking number.
- Fulfillment status remains consistent.
- Data model supports more than one shipment per order.

## Phase 4: Shiprocket Integration

### Objective

Add Shiprocket as a provider behind the shipping adapter interface.

### Shiprocket Flow

```txt
1. Authenticate and cache token.
2. Check courier serviceability.
3. Create Shiprocket order.
4. Assign AWB.
5. Generate pickup.
6. Generate label.
7. Store AWB, courier, label, and tracking details.
8. Receive tracking webhook.
```

### Backend Tasks

- Add encrypted credential storage for Shiprocket.
- Implement `shiprocket.provider.js`.
- Add token caching and retry handling.
- Add serviceability mapping.
- Enforce provider capability flags such as COD, return support, max weight, and regions.
- Add serviceability cache reads and writes.
- Add shipment creation.
- Add AWB assignment.
- Add label generation.
- Add webhook endpoint.
- Normalize Shiprocket statuses into internal shipment statuses.
- Add fallback behavior when Shiprocket times out or fails.
- Add provider request timeout and retry limits.

### Frontend Admin Tasks

- Add Shiprocket provider settings:
  - API email.
  - API password.
  - Pickup location.
  - Default package dimensions.
  - Enable COD.
  - Auto-create shipment setting.
- Add button:
  - Create Shiprocket Shipment.
  - Generate Label.
  - Download Label.

### Acceptance Criteria

- Admin can enable Shiprocket.
- Checkout serviceability can use Shiprocket rules where enabled.
- Admin can create Shiprocket shipment from an order.
- AWB and label are stored.
- Tracking updates update shipment/order status.
- Shiprocket outage can fall back to secondary/manual provider according to admin settings.

## Phase 5: Ekart Integration

### Objective

Add Ekart as another provider without changing checkout or order logic.

### Notes

Ekart usually requires merchant onboarding. API documentation and credentials are provided by Ekart after approval.

### Backend Tasks

- Add Ekart credentials to provider settings.
- Implement `ekart.provider.js` using the official API docs received from Ekart.
- Map serviceability, shipment creation, cancellation, labels, and tracking to the common provider interface.
- Enforce provider capability flags such as COD, return support, max weight, and regions.
- Use serviceability cache to reduce repeated Ekart calls.
- Add Ekart webhook endpoint if supported.
- Normalize Ekart statuses.
- Add fallback behavior when Ekart times out or fails.

### Frontend Admin Tasks

- Add Ekart provider settings:
  - Merchant ID.
  - API key.
  - Pickup location.
  - Enabled services.
- Add Ekart shipment action in order detail.

### Acceptance Criteria

- Ekart can be enabled or disabled independently.
- Admin can create Ekart shipment.
- Checkout remains unchanged.
- Tracking displays through the same shipment UI.

## Phase 6: Advanced Rules And Automation

### Objective

Make shipping fully customizable for real operations.

### Backend Tasks

- Add priority-based rule engine.
- Enforce deterministic rule conflict resolution:
  - Highest priority wins.
  - Same priority uses `strictOverride`.
  - Remaining ties use latest created rule.
  - Unsafe ties are rejected by admin validation.
- Add rule preview/testing API.
- Add partner selection strategy:
  - Manual only.
  - Default provider.
  - Cheapest provider.
  - Fastest provider.
  - COD-preferred provider.
  - Rule-based provider.
- Add support for:
  - State-wise rates.
  - Pincode-wise rates.
  - Weight slabs.
  - Product/category restrictions.
  - Remote area surcharge.
  - COD fee.
  - Return pickup support.

### Frontend Admin Tasks

- Add rule builder UI.
- Add pincode import/export.
- Add test panel:
  - Enter pincode.
  - Enter cart value.
  - Enter payment method.
  - Preview shipping decision.

### Acceptance Criteria

- Admin can define multiple shipping rules.
- Highest-priority matching rule is applied.
- Same-priority conflicts are handled deterministically or rejected before activation.
- Admin can test rules before enabling them.
- Shipping behavior is configurable without code changes.

## Phase 7: Tracking, Returns, And RTO

### Objective

Improve post-shipment operations.

### Backend Tasks

- Add tracking webhook processor.
- Add webhook event table with `provider_event_id` dedupe.
- Add scheduled tracking sync fallback.
- Add shipment event table if needed.
- Add statuses:
  - pending
  - ready_to_ship
  - pickup_scheduled
  - picked_up
  - in_transit
  - out_for_delivery
  - delivered
  - delivery_failed
  - rto_initiated
  - rto_delivered
  - cancelled
- Add return shipment support.
- Add RTO handling.

### Frontend Admin Tasks

- Show shipment timeline.
- Show delivery exceptions.
- Add return shipment creation.
- Add RTO indicators.

### Storefront Tasks

- Show clean customer tracking timeline.
- Notify customer on major shipment events.

### Acceptance Criteria

- Tracking updates automatically.
- Duplicate webhook events do not create duplicate timeline entries or invalid status transitions.
- Failed deliveries and RTO are visible to admin.
- Customer order detail shows current shipment status.

## Phase 8: Monitoring And Reliability

### Objective

Make shipping reliable in production.

### Backend Tasks

- Log all vendor API requests and responses safely.
- Mask credentials and tokens.
- Add retry policies for temporary vendor failures.
- Add provider fallback priority:
  - Primary provider.
  - Secondary provider.
  - Store default provider.
  - Manual fallback.
- Add idempotency keys for shipment creation.
- Prevent duplicate AWB creation.
- Add alerting for failed shipment creation.
- Add webhook signature/token validation.
- Add webhook idempotency by provider event ID or generated dedupe key.
- Add rate limit handling.
- Add serviceability and rate cache monitoring.
- Add admin audit trail for shipping provider/rule/zone changes.

### Admin Tasks

- Show failed shipment creation reason.
- Add retry shipment action.
- Add fallback to manual courier.

### Acceptance Criteria

- Duplicate shipment creation is prevented.
- Vendor failures are visible and recoverable.
- Admin can fall back to manual shipping.
- Shipping rule changes are auditable.
- Shipping calculate APIs are rate limited.

## Shipping Rule Examples

### Flat Rate All India

```json
{
  "name": "Flat Rs. 49 All India",
  "priority": 100,
  "conditions": {
    "country": "India"
  },
  "rateType": "flat",
  "rateConfig": {
    "amount": 49
  },
  "codAllowed": true,
  "estimatedMinDays": 3,
  "estimatedMaxDays": 7
}
```

### Free Shipping Above Rs. 999

```json
{
  "name": "Free Shipping Above Rs. 999",
  "priority": 200,
  "conditions": {
    "subtotalGte": 999
  },
  "rateType": "free",
  "rateConfig": {
    "amount": 0
  },
  "codAllowed": true
}
```

### COD Disabled For Remote Pincodes

```json
{
  "name": "Remote Area Prepaid Only",
  "priority": 300,
  "conditions": {
    "pincodes": ["194101", "744101"]
  },
  "rateType": "flat",
  "rateConfig": {
    "amount": 149
  },
  "codAllowed": false
}
```

### Use Manual Courier For Local City

```json
{
  "name": "Local Manual Delivery",
  "priority": 400,
  "provider": "manual",
  "conditions": {
    "city": "Chennai"
  },
  "rateType": "flat",
  "rateConfig": {
    "amount": 30
  },
  "codAllowed": true,
  "estimatedMinDays": 1,
  "estimatedMaxDays": 2
}
```

## Important Validation Rules

- Pincode must be stored as a string.
- Backend must validate pincode serviceability.
- Backend must validate COD serviceability.
- Backend must revalidate shipping quote during order placement.
- Shipping quote TTLs: Default quote TTL is 10 minutes; Partner live-rate quote TTL is 5 minutes.
- Backend must reject expired quotes with a clear error code.
- Backend must reject stale quotes when cart, address, payment method, or coupon context changes.
- `/shipping/calculate` must be idempotent for identical active quote requests.
- Unexpired quote pricing should remain authoritative even if admin changes shipping rules after quote creation.
- Shipping cost must be calculated on backend.
- Shipping cost must store currency, tax inclusion, tax amount, and tax breakdown.
- Checkout must debounce shipping calculation requests.
- Checkout must ignore stale calculate responses.
- Vendor credentials must be encrypted.
- Vendor APIs must only be called from backend.
- Provider capability flags must be checked before selecting a provider.
- Shipment creation must be idempotent.
- Webhook processing must be idempotent by provider event ID or generated dedupe key.
- Order should not create prepaid shipment before payment success.
- Payment failure must not create any shipment.
- Before prepaid shipment creation, backend must verify the order shipping snapshot is still serviceable or use an admin-approved fallback.
- COD shipment can be created after order placement if COD is serviceable.
- Serviceability should be cached by provider, pickup pincode, delivery pincode, and payment method.
- Shipping APIs must be rate limited by IP/user.
- Rule conflicts must be resolved deterministically.
- Admin shipping changes must be audited.
- The data model must allow multiple shipments per order.

## Recommended Build Order

1. Manual shipping rules and pincode serviceability.
2. Checkout shipping calculation from backend.
3. Order shipping snapshot and quote validation.
4. Manual shipment management in admin.
5. Shiprocket integration.
6. Ekart integration.
7. Advanced rule engine.
8. Tracking automation, returns, and RTO.
9. Monitoring, retry, and fallback handling.

## Files Likely To Change

Backend:

```txt
server/src/modules/order/order.service.js
server/src/modules/order/order.validation.js
server/src/modules/order/order.model.js
server/src/modules/order/fulfillment.model.js
server/src/modules/index.js
server/src/app.js
server/migrations/*
server/src/modules/shipping/*
```

Frontend:

```txt
client/src/pages/storefront/CheckoutPage.jsx
client/src/pages/admin/SettingsPage.jsx
client/src/pages/admin/OrderDetailPage.jsx
client/src/services/adminService.js
client/src/services/shippingService.js
```

Shared:

```txt
shared/order-workflow.json
```

## Final Recommendation

Build the shipping system as an admin-configurable rule engine with provider adapters.

Start with manual shipping and pincode validation. This makes the platform usable immediately. Then add Shiprocket and Ekart as providers behind the same interface. Checkout should remain simple and stable while shipping operations become more powerful over time.
