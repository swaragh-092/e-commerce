# 0004 - Order submission idempotency and late payment settlement

**Status:** proposed
**Date:** 2026-10-05
**Spec:** `docs/ORDER-SHIPPING-AUDIT-2026-10-05.md`
**Deciders:** Store owner and engineering

## Context

Order submissions can be retried after network or payment-provider failures. Without a stable key and payload comparison, retries can create duplicate orders, while guest retries cannot be scoped safely to a browser session. Payment providers may also confirm a capture after the reservation timeout has cancelled the order and released its inventory.

## Decision

- Give each logical order submission a UUID key. Reuse it for retries of the same payload and use a new key when the order intent changes.
- Scope authenticated keys to the account and guest keys to the guest session. Enforce UUID format and uniqueness in PostgreSQL as well as validating requests.
- Persist a hash of the normalized order intent. Return HTTP 422 when a key is reused with a different intent; preserve replay behavior for legacy rows without a hash during rollout.
- Treat confirmed gateway capture as money received even if the order is already cancelled. Record a late-settlement event, keep the order cancelled, prevent fulfillment, and surface refund review to staff and the customer.
- Serialize payment capture and reservation expiry through the order lock so exactly one transition wins. A capture observed after the deadline may settle only while the order remains payable and its reservation has not been released.

## Consequences

- Clients must preserve the submission key over transport retries and create a new one for a changed order.
- A captured payment on a cancelled order requires operational refund review; it must not silently recreate inventory or reopen fulfillment.
- The idempotency migration must be applied before deploying code that writes the new fields and constraints.

## Alternatives considered

- Use the checkout-session ID as the order key. Rejected because a shipping quote/session can span changed order contents and does not represent one order submission.
- Reject all provider captures after expiry. Rejected because a provider may have captured funds even when the application learns about it late; that capture must be reconciled rather than hidden.
- Reopen cancelled orders on late capture. Rejected because stock may already have been released or sold to another customer.
