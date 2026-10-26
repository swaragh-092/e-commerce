# 0005 - Provider-backed refund reconciliation

**Status:** proposed
**Date:** 2026-10-06
**Spec:** `docs/ORDER-SHIPPING-AUDIT-2026-10-05.md`
**Deciders:** Store owner and engineering

## Context

An admin refund action must not mark an order refunded before the payment provider confirms that money was returned. Provider requests can time out after acceptance, so repeating a refund blindly can return the same money twice. Cash-on-delivery payments have no payment gateway to issue the refund.

## Decision

- Send supported online refunds through the provider that captured the payment.
- Persist each refund request before calling the provider. Keep uncertain or asynchronous results in a processing state and reconcile them from provider status on a scheduled job.
- Prevent a second refund request while an earlier refund remains unresolved.
- Require staff to confirm an offline COD refund and enter its transfer reference; record the confirmation without claiming a gateway issued it.
- Finalize the order and payment refund state only after provider success or explicit staff confirmation for COD.

## Consequences

- Provider timeouts remain visible as pending work and require reconciliation; staff must not retry them without checking the recorded provider reference.
- COD refunds require an external transfer and accurate staff input.
- Provider reconciliation depends on valid gateway credentials and provider APIs being available.

## Alternatives considered

- Mark the refund complete immediately when the admin clicks. Rejected because the provider may reject or delay the refund.
- Automatically retry an uncertain provider request. Rejected because a timeout does not reveal whether the first request was accepted and could create duplicate refunds.
