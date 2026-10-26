# 0003 - Shipping rule order and parcel pricing

**Status:** accepted
**Date:** 2026-10-05
**Spec:** `docs/SHIPPING-MPS-IMPLEMENTATION-PLAN.md`
**Deciders:** Store owner (accepted 2026-10-05) and engineering

## Context

Shipping quotes may contain more than one parcel. The rule engine previously applied several fees once per parcel, matched order weight conditions against only the largest parcel, and skipped COD fees in percentage and free-above-threshold paths. This made customer fees depend on the packing split and could select a weight rule that did not match the total order.

## Decision

- Treat flat, free-above-threshold, and percentage-of-order delivery fees as order-level charges, applied once regardless of parcel count.
- Calculate per-kg and volumetric delivery fees for each parcel, then add the parcel freight amounts.
- Match advanced rule weight conditions against the sum of parcel chargeable weights.
- Enforce a courier's maximum parcel weight against each parcel independently.
- Add a configured COD fee once per COD order for every non-`free` rule, including when a freight threshold makes delivery free.
- Explain these charging units in the admin rule editor.

## Consequences

- A multi-parcel order with a flat fee of ₹50 now has ₹50 delivery freight, not ₹50 per parcel.
- A COD fee configured as ₹40 is added once to the order for applicable rules.
- A 500 g maximum-weight rule does not match an order with two 500 g parcels, because its total chargeable weight is 1,000 g.
- Existing merchants relying on a flat advanced rule multiplying by parcel count will see a lower customer fee for multi-parcel orders. This is intentional order-level pricing and should be communicated in release notes.
- Historical saved quotes/orders keep their stored fee; new quotes use these semantics.

## Alternatives considered

- Preserve per-parcel flat fees. Rejected because a customer-facing flat rule is intended to price one order and the current editor did not disclose a per-parcel multiplier.
- Match weight conditions to the heaviest parcel. Rejected because it ignores total shipment weight and makes order weight thresholds misleading.
- Charge COD fees on every parcel. Rejected because COD is collected for the order and would be duplicated.

## Implementation evidence

Implemented in `server/src/modules/shipping/shipping.service.js`, with admin copy in `client/src/pages/admin/ShippingPage.jsx` and regression tests in `server/tests/unit/shipping.service.test.js`. The owner accepted this decision on 2026-10-05. The shipping suite passes 153 tests and the client production build succeeds.
