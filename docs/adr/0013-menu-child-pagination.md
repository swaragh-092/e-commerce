# 0013 — Configurable menu child batches

**Status:** proposed
**Date:** 2026-10-31
**Spec:** [Menu child pagination](../api/menu-child-pagination.md), implementing the user's confirmed requirement to show an initial batch and load more on demand.

## Context

Large manual and category-synced branches currently send/render every child. Customers need an expandable list, while staff must retain the full editable hierarchy. Category hierarchy and link resolution follow ADR-0007 and the existing category-sync implementation.

## Decision

Store an optional `childDisplayLimit` on menu items. Null preserves current behavior. Keep full trees in the existing internal cache and admin responses; paginate clones at the public response boundary. Include child pagination metadata and provide a rate-limited public endpoint scoped to an active menu and publicly reachable parent, including opaque generated category IDs. Generated branches inherit their sync root's batch size.

Use one shared storefront loading control and immutable tree update helper across header, mobile, sidebar and footer. Failed requests remain retryable and duplicate/stale pages cannot roll back progress.

## Consequences

A nullable column migration must precede server deployment. Existing API consumers only receive limited branches after staff explicitly configures a limit and must then use pagination metadata. Full tree construction remains internal; database-level lazy expansion is deferred. Offset pagination preserves a stable unchanged tree but an administrative reorder between requests requires refreshing that tree.
