# Designer recovery and page controls

## Draft safety

Use live storefront now archives the saved draft transactionally before removing it.
Restoring an archive or published version also archives the current saved draft first.
Unsaved browser edits are not archives: save them before replacing the draft. Archives
are available under More designer actions → Archived drafts. Restoring requires
confirmation, creates a draft against the current live design, and never publishes it.
Administrators must review restored values before publishing: restore is a whole-draft
replacement, not an automatic field-level merge. Existing revision checks still reject
stale concurrent changes. Previous drafts deleted before this deployment cannot be
recovered retroactively.

Review saved draft / Review differences shows saved values alongside current resolved
live values. The comparison is read-only and excludes unsaved editor changes. It is
not a three-way conflict resolver. Archive metadata never returns payload or base
snapshots; restore uses the server-side copy and requires settings.manage, with
settings.advanced checks for custom CSS.

### Deployment

Run server migration `20261112090000-create-design-draft-archives.js` before deploying
the server changes; deploy the client with that server. No backfill or secret is needed.
Until migration succeeds, do not use draft discard/restore on the updated server.
Rollback application code without dropping the archive table. The migration's down
operation deletes recovery history and should not be used casually. Archive storage
has no automatic expiry in this implementation; list results show the latest 30.

## Category and collection listings

Category settings expose desktop columns (2–6), products per page (1–100), filter
visibility and default sorting. Unset category values inherit catalog values. Collection
settings expose page size and default sorting alongside their existing grid/filter
controls. Page-size and default-sort changes refetch preview results. An explicit sort
chosen by the shopper in the URL takes precedence over the default. Columns are
responsive: desktop settings do not force six columns onto phones.

## 404 audit: next improvements, not implemented here

Current 404 controls cover heading, explanatory text, and two safe internal CTA links.
The renderer fixes icon, centered alignment, width, spacing, and the 404 numeral.
Prioritize a search field and configurable popular-page/category links to help shoppers
recover; then image/alt text, alignment, width/spacing and button visibility controls.
Product recommendations should be optional, with source/count controls and honest
empty states. Avoid redirecting all missing pages automatically: preserve not-found
semantics and investigate HTTP status/indexing separately from visual customization.

Shopify's 404 template guidance recommends clear recovery links and search:
https://shopify.dev/docs/storefronts/themes/architecture/templates/404
Available competitor editor controls depend on the installed theme, not merely the
platform. These are product recommendations, not a claim every competitor ships
all of them by default.

Full-design undo, autosave, per-field merge, template-install warnings and remaining
page-specific controls are still separate work. Authenticated production save/publish
verification was blocked by the live admin sign-in; local synthetic browser and
isolated PostgreSQL checks are not production proof.


## Search and Cart controls

Search settings control result page size (capped at the API's 50-result limit), desktop
columns, matching brand/category visibility, result-count visibility, page heading, search
placeholder, initial prompt, and no-result copy. Searches still require two characters and
retain server-side query-length validation.

Cart settings control empty-state copy and its safe internal recovery link, cart/summary
labels, checkout/enquiry text, continue-shopping/clear-cart visibility, and optional
trust, payment, and secure-checkout presentation. Checkout/payment availability remains
server-feature-gated; hiding presentation does not change feature availability. Prices,
shipping and tax continue to be calculated by commerce services.

## Product rows on other storefront pages

The Store Designer can add up to six product rows on Product, Category, Collection,
Search, and Cart pages. Each row supports Best Sellers, Trending / Most Viewed, Featured,
New Arrivals, or On Sale sources, with a configurable title, product count, and carousel
or grid layout. Rows are saved with that page's settings and appended after its primary
page content; existing product grids and cart controls remain intact.

## Nested category filters

Category settings control nested category-filter depth (1–5 levels) and expansion behavior:
open the selected path, start collapsed with per-branch disclosure buttons, or expand all
visible levels. Category-page overrides take precedence over Collection settings;
Collection settings remain the fallback. Depth limits both rendering and the number of
levels administrators can expose.

## Orders page controls

Orders page settings control the page title, search placeholder, comfortable/compact
row spacing, optional product thumbnails, and an optional help block with custom copy
and an internal link. Empty-orders recovery supports a headline, message, button label,
and internal destination. Filtered no-results copy remains separate, with Clear Filters
instead of a shopping link.

Existing appearance is preserved by default: comfortable rows, no thumbnails, and no
help block. Thumbnails use saved order-item image snapshots when available; older orders
without an image remain text-only. Status, totals, payment information, guest-order
verification, and order details actions are not designer-editable.
