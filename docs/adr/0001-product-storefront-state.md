# 0001 - Unify product storefront state

**Status:** accepted
**Date:** 2026-09-26
**Spec:** none
**Deciders:** Product owner

## Context

Product administration exposed publication status and an enabled toggle as separate controls. Since public product queries require both a published status and an enabled flag, the two controls allowed combinations that were difficult to interpret and made the storefront outcome unclear.

## Decision

Represent the effective storefront state with one selector in the product list, Quick Edit, and the full product editor. Persist each selection using the existing product fields:

- **Draft** maps to `status: draft` and `isEnabled: true`.
- **Published** maps to `status: published` and `isEnabled: true`.
- **Paused** maps to `status: published` and `isEnabled: false`; this is a derived state that preserves publication.
- **Archived** maps to `status: archived` and `isEnabled: false`. Existing products may be archived or restored; new products cannot be created as Archived.

Public product queries continue to require Published and enabled. Admin filters, summary counts, dashboard totals, bulk actions, and CSV exports use the same effective state mapping.

## Consequences

Admins can see the storefront outcome from one control and can temporarily pause or restore a product without changing its publication status. Archived is a supported persisted status, while Paused remains derived from the existing status and enabled fields. The database column is already string-backed, so this decision does not require a schema migration.

## Alternatives considered

- Keep the two controls and document their interaction. This retains the confusing combinations that prompted the change.
- Replace the existing fields with a single persisted enum. This would require a broader data migration and API compatibility work without improving the single-control admin workflow.
