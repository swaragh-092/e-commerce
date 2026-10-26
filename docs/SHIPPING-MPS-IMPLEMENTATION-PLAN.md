# Configurable Shiprocket MPS implementation plan

Status: proposed; implementation has not started.

## Outcome

The merchant can choose whether to use Multi-Packet Shipment (MPS). A customer order needing several boxes can proceed when the configured delivery workflow supports that order. Checkout shows one delivery fee. Fulfillment books one supported shipment group, obtains the correct box labels, and tracks the group using the carrier's documented identifiers.

MPS enabled in the Shiprocket account and MPS implemented in this website are separate prerequisites. The merchant has reported account activation. Verify API eligibility rather than requesting activation again.

## Evidence and current behavior

- `shipping.packages.js` already plans parcels from measured packages, confirmed product quantities, and optional mix groups. Mixing products decides box contents; MPS decides how multiple boxes travel together.
- `shipping.service.js:createQuote` currently blocks more than one parcel with every API provider. `order.service.js` also blocks API fulfillment for such orders. These are unconditional guards, not configurable capabilities.
- `ShippingProvider.settings` can hold provider configuration. Existing shipments, shipment items, quote snapshots, operations, and tracking services provide reusable components, but currently handle ordinary shipment booking. Their existence does not establish MPS support.
- Shiprocket's public MPS guide describes account training/activation, panel order creation, one master AWB, individual package labels, and pickup. It does not provide the API request/response contract needed here. Searching public documentation did not establish that an MPS API is unavailable; availability remains unverified.
- The current carrier fee aggregation adds ordinary parcel quotes. That is not proof of an MPS group price and must not be reused as an MPS quote without carrier confirmation.

Sources checked on 2026-10-05:

- [Shiprocket MPS support guide](https://support.shiprocket.in/support/solutions/articles/152000000706-what-is-multi-packet-shipment-how-to-create-it-)
- [Shiprocket API documentation](https://apidocs.shiprocket.in/)

## 1. Confirm the provider contract before enabling live MPS

Obtain account-specific documentation or written confirmation covering:

1. MPS quote/serviceability and create-order endpoints, authentication, and example requests/responses.
2. Whether API-created store orders qualify; supported couriers, destinations, prepaid/COD, package counts, minimum/maximum weights, dimensions, and any account restrictions.
3. Exact measurement representation: per-box values or documented combined values, units, rounding, divisor, and how carrier eligibility uses actual versus billable weight.
4. MPS price representation, tax/COD/surcharges, quote lifetime, and whether a courier/rate choice is binding at booking.
5. Master and child identifiers, individual labels, manifest, pickup, and whether mixed box sizes are supported.
6. Lookup/recovery after timeout, duplicate request behavior, cancellation, partial delivery, loss, returns, and webhook/polling schemas.
7. Whether separately booked ordinary parcels are permitted as a fallback and how COD and order value must be represented if so.

Do not infer minimum weight, courier eligibility, or API fields from another account or an unrelated product. Save sanitized examples and confirmed restrictions in the integration documentation. Do not save credentials there.

## 2. Add a simple merchant control with verified capability

Location: Admin → Shipping → Shipping Providers → Shiprocket → Multi-package delivery.

- Merchant switch: **Use Shiprocket MPS when available**, initially off.
- Show integration readiness separately: **Not verified**, **Ready**, or **Needs attention**.
- Enabling requires an implemented, verified provider adapter and the necessary account configuration. The merchant switch must not bypass server checks.
- Choose an explicit fallback: **Do not accept unsupported multi-box orders**, or **Manual / Own Delivery** when the merchant has deliberately configured that workflow and its pricing. Offer separate ordinary bookings only after the provider confirms support and that workflow is implemented.
- Display why an order is ineligible and the permitted next action. Do not tell a customer to change address for a packaging or integration error.
- Keep configuration in validated provider settings unless implementation reveals a reason for a separate capability table. Do not add guessed endpoints as editable admin fields.

Configuration changes invalidate affected checkout quotes. Saved order snapshots retain their quoted workflow. Disabling MPS stops new MPS checkout selection; outstanding operations must enter a visible review state rather than silently changing to ordinary shipments.

## 3. Resolve one workflow consistently

Use a shared server resolver in checkout, admin preview, order validation, and fulfillment:

| Parcel plan | Merchant setting and capability | Selected workflow |
|---|---|---|
| No physical items | Any | Digital delivery |
| One parcel | Ordinary service eligible | Ordinary shipment |
| Several parcels | MPS on, adapter ready, carrier confirms eligibility | MPS group |
| Several parcels | MPS off, unverified, or ineligible | Explicit eligible fallback, otherwise unavailable |

The resolver considers pickup origin, destination, payment method, every box, and confirmed carrier restrictions. Return a stable reason code plus merchant/customer appropriate text. Remove the two unconditional multi-parcel blocks only when they are replaced by this resolver and the matching booking implementation.

## 4. Quote the actual selected workflow

- Use the existing confirmed parcel plan without inventing measurements or compatibility.
- For MPS, request the provider's documented group serviceability and rate. Do not presume that summing ordinary rates equals the MPS charge.
- Standard customer pricing charges its configured fee once per order. Carrier pricing uses the confirmed price of the selected workflow. Advanced rules need an explicit charging basis: order or parcel, with parcel charging available only for appropriate rate types.
- Separate order-level weight filters from per-parcel carrier limits. Preserve existing rule behavior through an explicit migration/legacy basis rather than silently changing historical settings.
- Fix the confirmed percentage/threshold-rule COD omission; apply a configured order COD fee once. Define whether a free-shipping promotion waives freight only or also COD, and make the admin wording explicit.
- Store customer fee and carrier cost separately. Do not add a second customer charge after payment because staff changes packing; require review when the saved plan no longer matches the physical parcels.
- Persist workflow, parcels, origin, provider/courier selection, quote reference/expiry, pricing basis, and configuration version/hash. Revalidate the applicable facts before order placement and booking.

## 5. Represent one shipment group and its boxes

Inspect existing shipment/fulfillment schema before choosing migrations. Model a shipment group with its provider booking reference, master AWB, quote reference, total collection amount, status, and durable operation state. Associate each parcel with its saved item quantities, measured dimensions/weight, provider child identifier when supplied, label, and status when supplied.

Do not treat each box as an unrelated order or schedule a separate pickup per child unless the verified provider contract requires it. Preserve current single-parcel records and identifiers. Add uniqueness constraints for booking references and parcel assignment to prevent duplicate dispatch.

The whole order must not become delivered merely because one child box is delivered. If the provider supplies only group tracking, show group tracking and explain that individual box statuses are unavailable; do not invent child statuses.

## 6. Book, recover, and track

Extend the provider adapter with distinct group quote, booking, recovery, labels, pickup, tracking, and cancellation behavior as supported by the confirmed contract. Reuse the durable shipping operation queue.

- Persist the request reference and parcel mapping before the external call.
- Retry a timeout through documented lookup/recovery before creating another booking. Unknown booking outcome needs reconciliation; it must not create duplicate labels.
- Track booking, AWB, labels, and pickup as separate recoverable stages. Expose partial failure and a safe retry action to staff.
- Authenticate webhooks, deduplicate events, and map master/child IDs unambiguously. Poll to reconcile missing events.
- Handle out-of-order events, delivery retries, partial delivery, cancellation, and returns using the documented statuses.
- Associate COD with the carrier's confirmed collection representation once; reconcile collected value at order level. Do not copy the full COD amount onto each child box.

## 7. Fulfillment and customer experience

Staff sees one order, its selected workflow, and every planned box with products/quantities. Before booking, staff confirms the actual packed boxes match the paid quote. A changed plan requires an explicit review/requote process; already booked parcels cannot be edited as if they were unbooked.

For MPS, staff receives all required labels and the supported pickup/manifest action for the group. Checkout shows one delivery charge and a package count only after a valid supported plan and quote. Tracking shows the master tracking number plus any carrier-supported box detail. Unsupported orders receive one clear actionable message without duplicate warnings.

## Delivery phases

1. **Contract and design:** confirm provider details, resolve pricing semantics, and document schema/API examples. This plan is the initial design artifact.
2. **Configuration and shared resolver:** merchant switch, readiness, explicit fallback, quote invalidation, and focused rule/COD corrections. Live MPS stays unavailable while adapter readiness is unverified.
3. **Quote and persistence:** confirmed group quotes and snapshots; backward-compatible shipment group/parcel storage.
4. **Booking and operations:** MPS booking, AWBs, labels, manifest/pickup, timeout recovery, staff confirmation.
5. **Tracking and reconciliation:** master/child events, partial status, COD, cancellation and return handling.
6. **Controlled release:** verify the account-supported workflow using approved test facilities; any real booking incurs account effects and requires explicit user authorization. Then enable it for this store and observe failures/reconciliation.

## Required acceptance checks

- MPS off/on; unverified adapter; enabled account but ineligible order; explicit fallback; stale quotes after settings change.
- One box; several identical boxes; mixed sizes where supported; mixed products with same/different/blank mix group; missing measurements; package/carrier capacity boundaries.
- Correct workflow pricing; standard flat once; advanced charging basis; percentage fee once; COD once; free threshold; total weight filters versus parcel limits.
- Quote unavailable/expired; rate missing; selected courier unavailable at booking; staff changes packed measurements; existing orders survive package configuration edits.
- Booking timeout before/after provider creation; duplicate staff clicks; label/pickup failure after successful booking; retry without duplicate order/AWB.
- Duplicate/out-of-order webhook; unknown child identifier; one box delivered and others pending; group-only tracking; cancellation/returns and COD reconciliation.
- Regression checks for ordinary single-parcel Shiprocket and Manual / Own Delivery.

## Open decisions and inputs

- Required external input: Shiprocket's account-specific MPS API contract and eligibility details. Existing account activation is already recorded.
- Decide whether legacy advanced flat rules remain per parcel or migrate to per order; present a clear basis rather than infer merchant intent.
- Decide whether free freight also waives the configured COD fee; current UI permits COD on several rule types whose implementation drops it.
- Merchant must explicitly select any alternative fulfillment workflow and accept its customer fee policy. A fallback cannot be silently enabled.

Completion means the switch controls a verified end-to-end workflow, not merely removal of the current block.
