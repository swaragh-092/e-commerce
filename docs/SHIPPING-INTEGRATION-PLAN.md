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
  shipment.model.js
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
  "quoteId": "uuid"
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
  "shippingQuoteId": "uuid"
}
```

Backend must revalidate the quote before creating the order.

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
cod_available
estimated_min_days
estimated_max_days
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

### orders

Add:

```txt
shipping_quote_id
shipping_snapshot
shipment_status
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
- Disable place order if delivery is unavailable.

### Acceptance Criteria

- Admin can configure manual shipping.
- Checkout blocks unavailable pincodes.
- Checkout displays backend-calculated shipping cost.
- Order stores shipping snapshot.
- No third-party API is required.

## Phase 2: Order Integration

### Objective

Make order placement depend on backend shipping quote validation.

### Backend Tasks

- Add `shippingQuoteId` to `POST /orders`.
- Recalculate or revalidate quote in `OrderService.placeOrder`.
- Reject expired, mismatched, or unavailable shipping quotes.
- Save:
  - `shippingCost`
  - `shippingQuoteId`
  - `shippingSnapshot`
- Pass final shipping cost into coupon resolution so free-shipping coupons work correctly.

### Frontend Tasks

- Update checkout to request shipping quote when:
  - Address changes.
  - Cart changes.
  - Payment method changes.
  - Coupon changes if shipping discount depends on coupon.
- Include `shippingQuoteId` in `placeOrder`.
- If COD is not available for the selected pincode, hide or disable COD.

### Acceptance Criteria

- Frontend no longer calculates authoritative shipping cost.
- Backend rejects stale or invalid shipping quotes.
- Orders have correct shipping cost snapshots.
- COD is blocked where not allowed.

## Phase 3: Admin Shipment Management

### Objective

Allow admin to create and manage shipments manually.

### Backend Tasks

- Add shipment creation API for admin.
- Support manual shipment:
  - Courier name.
  - Tracking number.
  - Tracking URL.
  - Notes.
- Link shipment to fulfillment.
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
- Add shipment creation.
- Add AWB assignment.
- Add label generation.
- Add webhook endpoint.
- Normalize Shiprocket statuses into internal shipment statuses.

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

## Phase 5: Ekart Integration

### Objective

Add Ekart as another provider without changing checkout or order logic.

### Notes

Ekart usually requires merchant onboarding. API documentation and credentials are provided by Ekart after approval.

### Backend Tasks

- Add Ekart credentials to provider settings.
- Implement `ekart.provider.js` using the official API docs received from Ekart.
- Map serviceability, shipment creation, cancellation, labels, and tracking to the common provider interface.
- Add Ekart webhook endpoint if supported.
- Normalize Ekart statuses.

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
- Admin can test rules before enabling them.
- Shipping behavior is configurable without code changes.

## Phase 7: Tracking, Returns, And RTO

### Objective

Improve post-shipment operations.

### Backend Tasks

- Add tracking webhook processor.
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
- Failed deliveries and RTO are visible to admin.
- Customer order detail shows current shipment status.

## Phase 8: Monitoring And Reliability

### Objective

Make shipping reliable in production.

### Backend Tasks

- Log all vendor API requests and responses safely.
- Mask credentials and tokens.
- Add retry policies for temporary vendor failures.
- Add idempotency keys for shipment creation.
- Prevent duplicate AWB creation.
- Add alerting for failed shipment creation.
- Add webhook signature/token validation.
- Add rate limit handling.

### Admin Tasks

- Show failed shipment creation reason.
- Add retry shipment action.
- Add fallback to manual courier.

### Acceptance Criteria

- Duplicate shipment creation is prevented.
- Vendor failures are visible and recoverable.
- Admin can fall back to manual shipping.

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
- Shipping quote must expire.
- Shipping cost must be calculated on backend.
- Vendor credentials must be encrypted.
- Vendor APIs must only be called from backend.
- Shipment creation must be idempotent.
- Order should not create prepaid shipment before payment success.
- COD shipment can be created after order placement if COD is serviceable.

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
