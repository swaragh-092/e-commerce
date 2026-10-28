# ADR-0009: Complete product tag management and public archives

**Status:** proposed
**Date:** 2026-10-28
**Spec:** [Product tags plan](../plans/product-tags.md)
**Related:** ADR-0001 (catalog search), ADR-0002 (storefront state)

## Context

The catalog already stores tags through a many-to-many product_tags table and
searches their names/slugs. Merchants need an admin workflow, bulk assignment and
customer browsing without changing categories, attributes or product visibility.

## Decision

- Reuse tags/product_tags and the existing product permissions for dictionary
  management and assignment. Keep dictionary enumeration authenticated.
- Normalize new labels with Unicode NFKC and whitespace normalization; reuse them
  case-insensitively. Bound products to 50 labels and bulk selections to 100 IDs.
- Use one transaction-scoped PostgreSQL advisory lock for dictionary mutations.
  Bulk edits acquire product rows in UUID order before the dictionary lock, matching
  product saves. All-or-nothing add/remove preserves unrelated associations.
- Preserve slugs during name/description updates. Slugs take priority in product
  filters; legacy exact names remain a fallback when no matching slug exists.
- Add an optional plain-text description through a migration with an empty default.
  Exclude long descriptions from product associations; fetch them for tag management
  and landing metadata.
- Reuse the catalog UI for /tags/:slug. Public metadata and sitemap entries require
  at least one published, enabled, non-deleted product, following ADR-0002. Unknown
  and non-public tag crawler URLs return 404/noindex.
- Support canonical collection metadata and existing SEO path overrides only after
  public visibility has been checked. Escape JSON-LD script boundaries.

## Consequences

The feature works with the current catalog model and permission grants. A new
migration must run before deploying the backend. The global dictionary lock
serializes tag writes across products; batches are bounded and transactions stay
short. Existing duplicate legacy labels are retained rather than silently merged.
Clearing other storefront filters keeps the route's tag in place.

## Alternatives considered

- Store labels directly on products: duplicates shared names and makes renaming and
  usage counts harder; the existing relational model already supports reuse.
- Add an independent product-grid implementation for archives: duplicates filtering
  and sorting behavior; a wrapper around the existing catalog keeps them aligned.
- Replace every selected product's tag set during bulk edits: risks removing
  unrelated labels; explicit add/remove operations preserve merchant intent.
