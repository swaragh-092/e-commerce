# Store Designer parity foundation

Home editing now embeds the actual storefront route with draft settings, instead of
rendering the template-gallery mock. The header, footer, hero typography, carousel,
responsive CSS, and product discovery rules therefore run through the storefront code.
Theme font stylesheets also load and update inside the preview document.

In Edit design, selecting a rendered section opens its sidebar editor; selecting the
header, announcement, or footer opens its settings. Links and forms are intercepted
in this mode. Reordering, adding sections, and changing content remain in the sidebar.
Test storefront leaves normal preview interactions enabled. Device modes continue
using real iframe viewports. Non-home sample previews remain explicitly separate.

No-draft status is labelled Published design. Disabled Publish states explain whether
the administrator must save, resolve conflicts, or reload. Existing draft conflict
checks and confirmation before discarding a draft are unchanged.

## Verification

Use identical settings, viewport width, carousel slide, and browser state when
comparing editor and published rendering. Product discovery and recently viewed
rows use real data; sections without qualifying products may be absent, while
remaining editable in the sidebar. Test with a saved draft and without one, including
click selection, sidebar updates, device switching, and read-only preview navigation.
Synthetic API fixtures prove UI wiring, not production deployment or database health.

## Remaining audit work

This foundation does not implement autosave, per-theme draft libraries, draft archives,
setting-by-setting conflict merges, or whole-design undo. Published version history
and existing section undo remain as before. Template installation still updates live
settings; a future draft-aware install flow should explicitly retain or archive drafts.
These lifecycle changes require separate data-model and recovery decisions rather
than being coupled to the rendering correction.
