# Shipping packages and multi-parcel orders: implementation plan

## Goal

Allow the store to define more than one real package and ship an order in one or more parcels without inventing product measurements, promising a courier service that is not enabled, losing item quantities, or charging COD more than once.

## What exists today

- `shipping.packageProfiles` stores the measured preset catalog (dimensions, tare weight, max item count, max contents weight, interior dimensions, active state) and `shipping.defaultPackageId` marks the tiebreak preset. The legacy single `shipping.defaultPackage` and per-product fit matrices are removed.
- Checkout plans parcels from the preset catalog. If it cannot contain the order, quote creation stops with a packaging-capacity error. Physical orders cannot check out at all when no active preset exists.
- `Shipment` already stores parcel dimensions and actual/volumetric weight. `ShipmentItem` associates order lines and quantities with a shipment. Fulfillment logic already tracks dispatched quantities. This can represent multiple parcels, but current Shiprocket booking builds one provider request with whole-order items, totals, weight, and dimensions.
- Package count in shipping-rule calculations is currently `1`; it must not be mistaken for parcel planning.

## Implementation status

- Added a measured package catalog setting with server validation and admin editing. Each package records outside dimensions, optional interior dimensions, tare weight, item and content-weight limits, active state, and the default-preset tiebreak. Per-product fit declarations were removed: packing recommendations use measured dimensions, weight, volume, and item count. Volume checks do not prove spatial fit; warehouse staff must confirm the actual packed parcel.
- Checkout plans parcels physically: a unit without valid measured dimensions fits no preset and fails loudly. Goods share a parcel up to volume/weight/item limits; only explicitly incompatible item mix groups, or lines marked to ship each unit separately, stay separate (blank groups share). The planner splits quantities when necessary and computes actual and volumetric weight per parcel. Supported single-parcel Shiprocket quotes check serviceability and the live carrier rate.
- The checkout quote's parcel plan is copied to the order shipping snapshot. Staff explicitly select a planned parcel during fulfillment; the system saves its package ID/name with the shipment and records confirmed scale measurements. A recommendation is linked only when explicitly selected, so custom packing never consumes a recommendation or triggers a conflict on it. It rejects selecting a package twice. For carrier bookings, staff must type the packed scale weight (estimates are never pre-filled) and confirm the scale reading.
- For Manual / Own Delivery, staff pack with chosen item quantities and record the actual outer dimensions and packed weight. Tracking details are optional.
- COD parcels persist their actual collectable per shipment and later parcels reuse the persisted sum, so split fulfilment collects exactly the order total.
- The application permits multi-parcel API orders and ordinary fulfillment one measured parcel at a time, with independent AWBs and labels. This is not an automated MPS booking or a master-AWB shipment group. Live account compatibility still requires staging/operational verification; account-level MPS activation does not establish an implemented MPS API contract.
- Delivery pricing now accepts a carrier-calculated policy and applies storewide allowed/blocked pincode coverage and India-only restrictions to that policy. Carrier quotes are only accepted when each parcel has a numeric rate, including a valid zero rate.

## Industry patterns and confirmed carrier constraints

- Shopify lets merchants save package types. A merchant can assign a package to products/variants for single-item orders; for multiple items its documented checkout-rate calculation uses the store default package. This is a useful reference for a package library, but it does not prove automatic mixed-cart packing. [Shopify: setting up packages](https://help.shopify.com/en/manual/fulfillment/setup/packaging/setting-up-packages)
- Merchant confirms MPS is enabled for this account. Shiprocket support material adds operational constraints: MPS training/activation, Delhivery only, a 10 kg minimum applicable weight, and a custom-order workflow. The support article describes entry through the Shiprocket panel; it does not document an API request for MPS. Account activation alone does not establish that normal API-created checkout orders below 10 kg can use MPS. Verify account/API eligibility and retain a supported fallback for ineligible orders. [Shiprocket MPS support article](https://support.shiprocket.in/support/solutions/articles/152000000706-what-is-multi-packet-shipment-how-to-create-it-), [Shiprocket internal MPS SOP](https://sites.google.com/shiprocket.com/sop-shiprocket/multi-packet-shipment), [Merchant agreement](https://sr-website.shiprocket.in/wp-content/uploads/2025/02/Shiprocket-Merchant-Agreement-CBT.pdf)
- The documented `orders/create/adhoc` request accepts one shipment length, breadth, height, and weight and says to provide final total item weight for multiple items. Its published example does not document a parcel array. Do not send several parcel dimensions through this endpoint or assume MPS is enabled. Verify the account-specific MPS workflow/API with Shiprocket before implementing automatic carrier booking. [Shiprocket API documentation](https://apidocs.shiprocket.in/)

## Proposed phases

### 1. Package catalog

Add reusable package records alongside the existing single-package fallback: merchant name, outer L/W/H, empty tare weight, active state, item/content limits, and product/variant fit quantities. Validate units and ranges server-side. Preserve existing settings without generating guessed dimensions. Provide clear package examples only as examples, never as saved defaults.

### 2. Establish packing facts

Merchant selected a hybrid: suggest parcels automatically where explicit fit data supports a valid plan, and let staff review/edit the suggestion during fulfillment. Use staff entry for exceptions. This does not authorize guessing product dimensions, compatibility, or package capacity. Before enabling automatic packing, collect measured data that proves fit. Options:

- **Staff packs and confirms parcels:** select a saved package plan or manually enter item quantities and measured packed values when preparing own-delivery fulfillment. Manual changes cannot silently change a paid carrier quote.
- **Product packing profiles:** merchants declare which products and quantities fit each package; deterministic planning can use only those declarations.
- **Dimension-based packing algorithm:** requires reliable product dimensions, orientation/rotation rules, fragile/keep-together constraints, and a defined packing algorithm. Product dimensions alone do not imply a correct physical packing solution.

Do not silently infer product dimensions, compatibility, or box capacities from weight.

### 3. Parcel plan and checkout quote

Represent each parcel as package ID, item-line quantities, actual packed weight, dimensions, volumetric weight, selected courier, and booking state. Assert that all shippable order quantities appear exactly once, non-shipping items appear zero times, and every parcel meets the package and courier constraints. Aggregate confirmed per-parcel carrier quotes into one checkout delivery line and one order total. Quote parcels only where the chosen carrier workflow supports them. Keep store delivery coverage separate from rate zones and pickup origin. Explain a blocked order with the item/package reason and the action the merchant can take.

### 4. Confirm provider path and build booking

Merchant reports that MPS is enabled. Before enabling MPS bookings, confirm API-created order eligibility, minimum billable weight, supported courier, per-parcel rate behavior, AWB structure, labels, cancellation, pickup, and tracking/webhook events. The cited support SOP says MPS is Delhivery-only, minimum 10 kg applicable weight, and a custom-order workflow. If an order does not qualify, use one ordinary parcel when it fits. For multiple ordinary parcels, confirm Shiprocket account/API policy before booking them separately; do not assume MPS entitlement covers separate bookings. Persist parcel requests idempotently so a timeout or retry cannot create duplicate labels. Persist each parcel's AWB, label, provider status, retries, and tracking events.

### 5. Customer fee and COD

Merchant selected carrier-calculated delivery in the checkout total. Sum confirmed parcel quotes into one customer-visible delivery line and one order total; store carrier cost separately from any merchant/customer adjustment. Do not add a post-payment collection when staff adjusts parcel dimensions: flag differences for merchant review and apply the configured absorb/refund policy. COD must be collected once per order unless Shiprocket's confirmed MPS contract specifies another representation. Confirm GST treatment for delivery charges before release.

### 6. Admin and customer UX

Admin: package catalog → packing facts/constraints → test plan → fulfillment parcel confirmation. Show why each line was placed in each parcel and surface unassigned/oversized items. Checkout: show one delivery fee and a parcel-count/arrival note only when the count is confirmed. Order/tracking page: list every parcel and its independent status; the order is delivered only when all required parcels are delivered.

## Merchant decisions recorded

1. Use both automatic suggestions and staff review, based on the order situation. Suggestions use explicit fit data; staff can edit them and pack exceptions manually.
2. Use measured product-to-package fit profiles, a common deterministic way to automate packing without pretending dimensions alone prove fit. The store must define which products/quantities fit each package, whether unlike products can mix, and when a line can split across boxes.
3. Use carrier-calculated parcel quotes in checkout, aggregated into one delivery line in the order total. Confirm GST treatment and who absorbs/refunds differences if staff changes the parcel plan after payment.
4. Merchant reports Shiprocket MPS is enabled. Published support guidance lists Delhivery only, 10 kg minimum applicable weight, and a custom-order workflow. We must verify how MPS applies to the store's API-created checkout orders before relying on it.

> Update: decisions 1–2 (fit declarations) were later superseded. Fit matrices are removed from validation, planning, and the admin UI: the planner proves fit purely from measured product dimensions against preset volume/weight/item limits, missing dimensions always fail, and isolation uses the per-product separate-pack flag plus explicit item mix groups.

## Acceptance checks

- One item, multiple same-size items, mixed sizes, fragile/keep-together items, non-shipping items, missing product weight, oversized item, exact capacity boundary, and order beyond all configured package capacities.
- Every physical quantity assigned exactly once; each parcel's actual and volumetric weights independently checked against selected courier limits.
- One package booking fails while another succeeds; timeout/retry does not create duplicates; duplicate/out-of-order webhooks remain idempotent.
- COD, discounts, tax, cancellation/refund, partial fulfillment, partial delivery, return, and split shipment status reconcile once at order level and accurately at parcel level.
- Updating package definitions does not alter already confirmed parcel plans or booked shipments.
- If no verified package plan or carrier multi-parcel path exists, checkout and fulfillment show a clear limitation instead of fabricating dimensions or sending a misleading single-parcel booking.

## Release order

1. Get Shiprocket confirmation for API-created order eligibility, minimum billable weight, courier, rate quote format, and tracking/webhook behavior. Merchant reports MPS activation; verify how it applies to this store's orders.
2. Define measured presets and product dimensions: which preset sizes and capacities the warehouse stocks, and accurate per-product weights and dimensions. Isolation uses the product “ship each unit separately” flag and explicit item mix groups, not a fit matrix.
3. Decide how to handle package-plan changes after checkout and how to absorb/refund quote differences without surprise post-payment charges.
4. Implement a package catalog and migrate the current default package without changing existing order snapshots.
5. Implement deterministic checkout parcel suggestions from measured presets and product dimensions, plus staff review/edit for exceptions.
6. Add carrier quote aggregation, verified MPS or eligible per-parcel booking, per-parcel tracking, COD/payment reconciliation, and recovery.
7. Enable booking only after controlled-provider verification covers labels, AWBs, webhooks, cancellation/refunds, and idempotent retries.
