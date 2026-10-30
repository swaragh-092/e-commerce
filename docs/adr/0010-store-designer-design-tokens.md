# 0010 - Shared Store Designer Design Tokens

**Status:** proposed
**Date:** 2026-10-30
**Spec:** none linked
**Deciders:** Store Designer maintainers

## Context

Storefront appearance is edited in the admin Store Designer and rendered in both its preview and the live storefront. Separate color and button implementations can make those views disagree, while storefront theme state can unintentionally affect the admin interface. Editors also need clear behavior for button roles, appearances, and interaction states.

## Decision

Resolve storefront colors, button roles, appearances, interaction states, and preview tokens through one shared design-token system. Keep admin theming separate from storefront theme state, and have editable previews consume the current draft tokens.

## Consequences

- Designer previews and the live storefront can use the same token rules.
- Button role and appearance behavior is defined centrally, including interaction states and text contrast.
- Admin controls remain stable when storefront theme values change.
- Persisted token validation must accept supported designer fields and reject unknown fields.

## Alternatives Considered

- Keep separate token handling in the designer preview and storefront, which risks visual mismatches.
- Apply storefront theme state to the whole admin tree, which can alter admin controls unexpectedly.
