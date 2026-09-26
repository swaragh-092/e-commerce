# ADR-0001: Normalize catalog search and rank structured matches

**Status:** proposed
**Date:** 2026-09-26
**Deciders:** Project maintainers
**Context:** Product audit follow-up; see docs/PRODUCT_AUDIT_2026-09-26.md

## Context

The storefront search path and the product-list filter normalize and match queries differently. Product categories, brands, and tags are stored outside the product search vector, so users can receive irrelevant partial-name results or miss products that match catalog metadata. Search inputs also need consistent handling of Unicode variants, control characters, whitespace, and length limits across the browser and API.

## Decision

Normalize search input consistently at the client and server boundaries: apply Unicode NFKC normalization, remove invisible formatting characters, replace control characters with spaces, collapse whitespace, and trim. Enforce the 2–100 character query bounds after normalization.

Use escaped, parameterized partial matching for product text and associated category, brand, and tag names/slugs. Rank exact category and brand matches above broader metadata, product-text, and fuzzy matches. Keep the full-search endpoint and product-list search filter aligned on the fields they search.

## Consequences

- Equivalent Unicode and whitespace variants produce consistent suggestions and result sets.
- Searches can find products through their category, brand, or tags, including partial terms.
- Exact category and brand searches are less likely to be displaced by unrelated partial product-name matches.
- Broader LIKE predicates may add database work; keep result limits and query bounds in place and monitor search latency.
- Escaping wildcard characters preserves literal user intent for %, _, and backslash in partial-match queries.

## Alternatives considered

- Keep full-text and trigram search only. This does not cover related catalog metadata consistently.
- Normalize only in the browser. API callers would still get inconsistent behavior.
- Match only exact category and brand values. This misses useful partial searches.
