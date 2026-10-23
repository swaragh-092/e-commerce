# 0007 - Category Icons and Branch Sync for Catalog Navigation

**Status:** proposed
**Date:** 2026-10-23
**Spec:** none
**Deciders:** project maintainers

## Context

Categories can already store an icon value, but the admin flow only supported choosing an uploaded image. Synced category menus need to carry that icon to the storefront, and uploading a separate image for every category is inconvenient.

## Decision

Support both built-in icon identifiers and existing media URLs in the category icon field. Built-in identifiers use the `mui:<id>` format and resolve through a fixed client-side icon catalog. Synced category menu entries include the category icon, and storefront navigation renders either built-in icons or media images. Icon support requires no database migration. Custom SVG uploads are out of scope for this version.

Menu Builder also supports syncing children for an individual category menu item. The menu item points to the selected category, while its children are projected from that category's current descendants at read time. Category names, hierarchy, order, URLs, and icons remain sourced from Categories Management. Generated children are not stored as menu rows; any manually configured children stay stored and reappear if syncing is turned off.

## Consequences

- Admins can choose searchable built-in icons or reuse images already in the media library.
- Category icons appear in the admin category tree and synced storefront navigation.
- Existing image URLs remain valid.
- Built-in icon IDs must stay mapped in the client registry when the catalog changes.
- Custom SVG sanitization and color customization remain future work.

## Alternatives Considered

- Keep uploaded images as the only option. This requires repeated asset uploads for common symbols.
- Accept arbitrary SVG markup. This adds sanitization and rendering risks beyond the first version.
