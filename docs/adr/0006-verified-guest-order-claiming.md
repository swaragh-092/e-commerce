# 0006 - Verified guest order claiming

**Status:** proposed  
**Date:** 2026-10-12  
**Deciders:** Store owner and engineering

## Context

Guest checkouts are scoped to a browser session and are not automatically visible after a customer creates or signs into an account. Matching an order to an account using only an email string would let anyone who can create an account claim another person's guest checkout before proving control of that email.

## Decision

- Preserve guest-session ownership for unauthenticated checkout and order access.
- Backfill a normalized guest email onto unowned orders from the checkout email snapshot, without assigning any order during migration.
- Require an active account with a verified email and send a one-time, short-lived claim link to that account's email.
- After the link is redeemed in the authenticated account, transactionally attach only unowned guest orders with the exact normalized email; clear the guest-session identifier and add an order-history event.
- Hash claim tokens at rest, make them single use, and reveal matching order counts only after email-link proof.
- Leave guest orders without a captured email untouched; resolve them through support or a future explicit recovery flow.

## Consequences

- Existing guest checkouts need a migration to copy their checkout email into a queryable field; no customer order ownership changes during migration.
- Email delivery and verified account email are prerequisites for the customer self-service recovery flow.
- Linking changes order ownership and must be auditable and serialized to prevent duplicate claims.
