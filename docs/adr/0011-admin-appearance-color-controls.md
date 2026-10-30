# 0011 - Admin Appearance Color Controls

**Status:** proposed
**Date:** 2026-10-30
**Spec:** none linked
**Deciders:** Store Designer maintainers

## Context

Administrators need to configure the visual brand of the admin interface without changing storefront appearance. Exposing every UI color would make the settings difficult to understand and could weaken familiar status meanings.

## Decision

Provide a brand color for admin navigation and accents. Primary buttons and focus/selection states follow the brand by default and may have independent overrides. Derive hover and pressed shades from the button color. Keep success, warning, error, and informational colors fixed to preserve their meaning. Apply these settings only on admin routes.

## Consequences

- Admin branding is configurable while storefront design tokens remain independent.
- Most users need to choose only one color; separate button and interaction colors are optional.
- Interaction shades stay visually related to the button color.
- Semantic status feedback keeps consistent colors across admin accounts.

## Alternatives Considered

- Let storefront tokens control the admin interface, which would couple merchant-facing and administrative appearance.
- Expose separate controls for every interaction and status color, which would increase complexity and permit inconsistent feedback.
