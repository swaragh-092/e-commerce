# Store Design & Design System Unification Report

**Date:** 2026-09-23
**Scope:** Store Templates, Settings, Store Designer, design tokens, component/card styles, page templates, previews, and the admin editing workflow

**Implementation status (2026-09-23):** Ownership unification and the contextual-editor slices are implemented. System Settings now uses read-only compatibility summaries for global design, cards, header/footer, homepage, and supported page-layout controls; Store Designer owns those visual writes. The Store Designer defaults to an interactive Editor Preview, supports contextual canvas selection with persistent and keyboard-accessible selection state, and groups section controls into Content, Layout, Style, Responsive, Advanced, and contextual source/behavior groups. Canonical component/page metadata now lives in `client/src/utils/designRegistry.js`; Settings ownership/deep links and Designer navigation consume that registry. The Designer now receives server-backed default/custom source metadata, stages reset operations inside drafts, and exposes a confirmed reset action limited to visual settings. Operational catalog controls remain in Settings. Template rollback now uses locked, conflict-aware snapshot restoration for settings and template-owned API data sources, preserving newer edits and reporting source conflicts. The Designer now saves to a server-backed versioned draft, records published versions, and supports restoring a published version into a new draft before publishing. All current page-style editors and component/commerce style editors now render from schema-backed control definitions with persisted-key/default/conditional-visibility tests. Header layout, logo, menu, announcement, and flat global token controls now use the same schema-backed path; header actions, footer, and advanced token controls remain specialized editors because they manage drag ordering, dynamic collections, uploads, variable-font axes, responsive ranges, or previews. Full live visual QA remains follow-up work.
**Mode:** Evidence-based audit, implementation, and verification
**Status:** `DONE_WITH_CONCERNS`

## Executive decision

The platform does not primarily have a design-capability problem. It has a control-plane problem.

The same storefront concepts are currently reachable through several places:

- Store Templates / Theme Gallery installs a complete package.
- Settings > Branding edits global design tokens and card styles.
- Settings > Layout edits header, navigation, footer, and announcement values.
- Settings > Homepage edits homepage structure and content.
- Store Designer edits sections, components, page layouts, tokens, and preview state.
- Advanced settings exposes custom CSS and scripts.

This makes the product feel more complicated than it is. A merchant must understand internal setting groups such as `theme`, `componentStyles`, `homepage`, and `pageTemplates` before they can answer a simple question such as “How do I change the product card?”

The recommended product model is:

```text
Store Templates  →  Store Designer  →  contextual editing  →  System Settings / Advanced
```

There should be one canonical place for visual editing: `/admin/store-designer`. Settings should retain operational configuration and provide links or compatibility notices for controls that have moved. The current token, template, section, rollback, and validation foundations should be reused rather than replaced.

## 1. Evidence reviewed

### Repository documentation

The following project documents were read and cross-checked:

- `docs/THEME-EDITOR-UX-AUDIT.md`
- `docs/THEME-EDITOR-CANVAS-UX.md`
- `docs/THEME-SYSTEM-COMPETITOR-GAP-ROADMAP.md`
- `docs/THEME-SYSTEM-AUDIT.md`
- `docs/DESIGN-SYSTEM.md`
- `docs/DESIGN-SYSTEM-ISSUES.md`
- `docs/STORE-TEMPLATES.md`
- `AGENTS.md`

### Source inspected

- `client/src/pages/admin/SettingsPage.jsx`
- `client/src/components/admin/settings/buildSettingsPanels.jsx`
- `client/src/pages/admin/SectionComposerPage.jsx`
- `client/src/components/admin/settings/LiveStorefrontPreview.jsx`
- `client/src/components/admin/settings/CardStyleEditors.jsx`
- `client/src/components/admin/themes/*`
- `client/src/utils/theme.js`
- `client/src/utils/componentStyles.js`
- `client/src/utils/styleMaps.js`
- `server/src/modules/theme/theme.service.js`
- `server/src/modules/theme/theme.validation.js`
- `server/src/modules/theme/builtin/*.theme.json`

### External reference research

The recommendations were compared with current primary documentation and open-source implementations:

- [Shopify theme settings](https://shopify.dev/docs/storefronts/themes/architecture/settings): settings are declared at theme, section, or block scope, and conditional settings can hide controls that do not apply.
- [Shopify sections and blocks best practices](https://shopify.dev/docs/storefronts/themes/best-practices/templates-sections-blocks): settings should be scoped to the block/section where they make sense, and controls should be grouped to reduce editor clutter.
- [Shopify theme editor](https://shopify.dev/docs/storefronts/themes/tools/online-editor): merchants customize and preview the actual storefront in one editing flow.
- [Shopify Dawn `settings_schema.json`](https://github.com/Shopify/dawn/blob/main/config/settings_schema.json): the reference theme groups global controls into recognizable areas such as colors, typography, and layout instead of exposing internal runtime objects.
- [BigCommerce Page Builder](https://docs.bigcommerce.com/developer/docs/storefront/stencil/content/page-builder): the editor separates Theme Styles, Widgets, and Layers, and widget schemas define the controls available to merchants.
- [BigCommerce page widgets](https://docs.bigcommerce.com/developer/docs/admin/widgets-and-scripts/page-widgets/overview): page widgets are placed into regions/layouts and support publishing plus snapshots/restores; the replace-oriented publish behavior is an important safety consideration.
- [Squarespace Fluid Engine](https://support.squarespace.com/hc/en-us/articles/6421525446541-Edit-your-site-with-Fluid-Engine): the primary 7.1 editing experience is a visual block editor with drag-and-drop layout.
- [Squarespace section styles](https://support.squarespace.com/hc/en-us/articles/46489938125965-Style-page-sections): section styles and color themes can be reused across sections, with responsive spacing controls.
- [Wix Editor Site Design](https://support.wix.com/en/article/wix-editor-customizing-your-sites-theme-and-design): site-wide color and text themes are edited in one place and themed elements inherit changes.
- [Wix Studio Site Styles](https://support.wix.com/en/article/studio-editor-about-site-styles): typography, colors, transitions, and layout width are grouped as site styles.
- [WordPress latest `theme.json` reference](https://developer.wordpress.org/block-editor/reference-guides/theme-json-reference/) and [Global Settings and Styles](https://developer.wordpress.org/themes/global-settings-and-styles/): settings, styles, templates, parts, presets, and user overrides form a schema-backed hierarchy.
- [WordPress design-token extensibility discussion](https://github.com/WordPress/gutenberg/issues/76509): arbitrary custom tokens can become invisible CSS variables unless the token registry also defines how they appear in the editor. This is directly relevant to keeping tokens and controls in one registry.
- [Vercel Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) and the [current guideline source](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md): keyboard access, visible focus, labeled controls, unsaved-change protection, responsive behavior, and explicit action labels must be part of the editor contract.

### 1.1 Competitor documentation verification (2026-09-23)

The competitor research is useful as a pattern library, but the earlier project documents mixed sourced facts with product opinion, old links, exact feature counts, and absolute “no competitor” claims. This report uses a stricter evidence rule:

| Evidence tier | Acceptable use | Examples in this report |
|---|---|---|
| Tier 1 | Official developer documentation or the competitor's maintained open-source repository | Shopify developer docs, BigCommerce developer docs, WordPress developer docs, Shopify Dawn |
| Tier 2 | Official product/help documentation describing the current editor behavior | Squarespace, Wix |
| Tier 3 | Research, community posts, reviews, or inferred comparison | Discovery only; not sufficient for a definitive product claim |

No competitor capability should be described as a verified fact in project documentation unless it has a Tier 1 or Tier 2 source, a retrieval date, and a feature-specific URL. A source proves what that product documents; it does not prove that our implementation is better or that the feature is identical across plans and versions.

| Product | Verified documented pattern | What we should borrow | Important caveat |
|---|---|---|---|
| Shopify | Theme, section, and block settings have different scopes; conditional settings can hide controls; sections and blocks can be added, removed, and reordered in the editor. | One editor, scoped controls, conditional disclosure, and merchant-facing groups instead of runtime object names. | Do not copy the Liquid/theme-code model. Our safe package and settings model is a different implementation boundary. |
| BigCommerce | Page Builder presents Theme Styles, Widgets, and Layers; widget schemas define configurable controls. Page widgets use regions/layouts and support snapshots/restores. | Separate style, content/widget, and hierarchy concerns; use schemas to generate safe controls. | The documented publish flow can replace page data. Preserve our atomic merge/rollback semantics and warn before destructive replacement. |
| Squarespace | Fluid Engine is a visual block editor; section styles and color themes can be reused; Fluid Engine supports distinct desktop/mobile arrangements. | Canvas-first selection, contextual section styling, and explicit responsive editing. | The product has both classic and Fluid editing concepts. Our product should not retain two parallel visual editors. |
| Wix | Site Design/Site Styles centralize global typography, colors, transitions, and layout; themed elements inherit global changes; mobile-only elements and mobile editing are supported. | Global style tokens plus a contextual inspector and deliberate mobile controls. | “Mobile editor” behavior differs by Wix product/editor. Treat it as a responsive pattern, not a one-to-one implementation requirement. |
| WordPress/Gutenberg | The current `theme.json` reference documents schema-backed settings, styles, templates, parts, presets, and hierarchy/user overrides. | A single registry for tokens, presets, supported controls, and precedence; explicit scope inheritance. | Gutenberg issue #76509 is a proposal/discussion about custom token discoverability, not proof of a shipped feature. Keep it labeled as such. |
| Vercel Web Interface Guidelines | Not a competitor product; it is a current interaction/accessibility baseline covering focus, labels, semantic controls, keyboard behavior, unsaved navigation, and touch targets. | Make accessibility and state transitions part of the editor contract, not a final polish pass. | It is guidance, not evidence that a competitor implements every recommendation. |

#### Claims that must be softened or removed from older project documents

The following statements are not safe as unqualified facts without a repeatable methodology and feature-specific sources:

- exact competitor theme counts, competitor scores, and “60–70% feature parity” claims in `docs/THEME-SYSTEM-AUDIT.md`;
- “no competitor offers this” or “unique advantage” claims;
- broad claims that Shopify or every competitor lacks snapshots, selective rollback, mobile overrides, or CSS-variable systems;
- exact marketplace counts and plan-wide feature comparisons;
- claims that a competitor has a specific accessibility checker or implementation detail unless its current official documentation says so.

These can become dated benchmark observations if they include the comparison date, products/plans tested, criteria, URLs, and confidence. Until then, describe them as hypotheses or remove them. The archived `docs/archive/THEME-MARKETPLACE-TEMPLATE-SYSTEM.md` should not be used as current competitor evidence.

#### Documentation quality verdict

The direction of the existing competitor research is good enough to guide product decisions, but it was not yet documentation-grade because source freshness and claim traceability were inconsistent. After this verification, the reliable conclusions are:

1. Mature editors converge on a single visual workflow with global styles plus contextual, scoped controls.
2. Schema-driven controls and reusable presets are a durable pattern across Shopify, BigCommerce, and WordPress.
3. Responsive editing must be explicit; “mobile support” is not a sufficient requirement by itself.
4. Preview, draft/publish, rollback, and destructive-change warnings are part of the editing model, not separate infrastructure concerns.
5. Competitor documentation should inform our design, not be used as proof of relative superiority.

For future updates, maintain a small evidence ledger with `claim`, `product`, `source URL`, `retrieved date`, `evidence tier`, `confidence`, and `product implication`. Review it quarterly because editor capabilities, plan limits, and documentation URLs change.

## 2. Current state: what is already built

The system is materially stronger than a simple theme-color picker.

| Capability | Evidence | Assessment |
|---|---|---|
| Store template packages | `docs/STORE-TEMPLATES.md:8-20,191-229` | Implemented; package schema v3 supports design, layout, sections, page templates, component styles, data sources, and presets. |
| Scoped template application | `docs/STORE-TEMPLATES.md:153-187` | Implemented; useful and worth preserving, but the UI should explain scopes in merchant language. |
| Atomic install and rollback | `docs/STORE-TEMPLATES.md:233-263` | Strong foundation; before/after snapshots are a competitive advantage. |
| Shared live/preview section renderer | `docs/STORE-TEMPLATES.md:786-825` | Implemented; reduces preview/live drift. |
| Section variants and preset gallery | `docs/STORE-TEMPLATES.md:522-620,945-962` | Implemented; templates can now change structure and section recipes, not only colors. |
| Component style system | `docs/DESIGN-SYSTEM.md:551-605` | Implemented for product, category, promo, brand, trust, review, content, cart, checkout, forms, and badges. |
| Store Designer surface | `client/src/pages/admin/SectionComposerPage.jsx:641-820` | Implemented with page selection, tree/editor states, breadcrumbs, undo/redo, and a preview. |
| Page-level editing | `client/src/pages/admin/SectionComposerPage.jsx:56-70,190-195` | Implemented for multiple store routes, but the number of pages makes the surface easy to overload. |
| Live storefront preview | `client/src/components/admin/settings/LiveStorefrontPreview.jsx:2-11,64-154` | Implemented with an iframe, preview mode, local preview snapshot, and postMessage updates. |
| CSS design tokens | `docs/DESIGN-SYSTEM.md:103-329` | Extensive token foundation; the remaining problem is control ownership and discoverability, not token quantity. |
| Contrast/accessibility scoring | `docs/DESIGN-SYSTEM.md:937-1018` | Implemented for theme color pairs; keyboard/editor auditing is still incomplete. |
| Performance scoring | `docs/THEME-SYSTEM-AUDIT.md:358-377` | Implemented for theme packages; should be surfaced as guidance, not just a badge. |
| Advanced CSS permission gate | `client/src/pages/admin/SectionComposerPage.jsx:73-90,783-816` | Implemented; should remain advanced and role-gated. |

### Important conclusion

Most of the required primitives already exist. The highest-value work is to unify the experience and formalize ownership/precedence. Adding more independent controls before that would increase confusion.

## 3. The actual problem: overlapping editors

### 3.1 Duplicate visual editing paths

The legacy Settings UI still exposes controls that Store Designer already owns:

- `SettingsPage.jsx:327` defines 11 tabs, including Branding, Layout, Homepage, Catalog, and Advanced.
- `buildSettingsPanels.jsx:142-220` exposes global branding and color controls while also linking to Store Designer.
- `buildSettingsPanels.jsx:221-342` exposes typography, radius, header style, button style, card style, and background style while directing users to “Edit Tokens” in Store Designer.
- `buildSettingsPanels.jsx:344-381` exposes product/category/promo/brand/trust card editors while explaining that Store Designer is now block-aware.
- `buildSettingsPanels.jsx:413-509` exposes footer and layout fields while stating that layout is edited in Store Designer.
- `buildSettingsPanels.jsx:511-553` retains a full Homepage Builder while recommending Store Designer for homepage editing.

These notices acknowledge the conflict but do not remove it. The user still sees two places capable of changing the same result.

### 3.2 Store Designer itself is broad enough to become a second Settings page

`SectionComposerPage.jsx:73-90` currently registers a large component list:

- Design Tokens
- Product Card
- Category Card
- Promo Banner
- Brand Card
- Trust Item
- Header, logo, menu, header actions, announcement bar
- Footer
- Cart item row
- Checkout blocks
- Forms and inputs
- Badges and chips
- Advanced CSS

This is a good internal registry, but it should not be presented as a flat toolbox. The registry needs to drive contextual visibility so a merchant sees only the controls related to the selected page, section, or component.

### 3.3 Internal data groups are leaking into the user experience

The code and documentation use multiple overlapping concepts:

```text
theme.*                 global brand/style tokens
componentStyles.*       reusable component recipes
homepage.sections       page composition
pageTemplates.*         page-level layout behavior
nav/footer/announcement  global site regions
advanced.*              developer-only customization
```

These are useful storage boundaries. They are not a good merchant-facing information architecture. Storage groups should remain internal implementation details behind a single editor schema.

### 3.4 The “draft” model is not yet explicit in the visible workflow

The current Store Designer has a local dirty indicator and a `Save` action (`SectionComposerPage.jsx:644-726`). `handleSave` writes the settings directly through `updateSettingsBulk` (`SectionComposerPage.jsx:217-258`). The current toolbar does not show a separate `Publish` action.

That means the UI currently communicates “unsaved vs saved,” not “draft vs live.” If the product promise is a safe design workflow, the system should make this explicit:

```text
Draft → Preview → Publish → Live
```

If immediate save-to-live is intentional, the UI must say so clearly and use a different label such as “Save live changes.” This decision must be made before the editor is expanded further.

### 3.5 Documentation has drifted across implementation dates

The documents do not always describe the same system state:

- `docs/THEME-SYSTEM-AUDIT.md:255-277` describes full storefront iframe preview and temporary settings overlay as missing.
- `docs/THEME-EDITOR-UX-AUDIT.md:413-433` describes live route preview with unsaved settings as implemented.
- The code contains `LiveStorefrontPreview.jsx` and `previewMode=1`, which supports the newer state.
- `docs/STORE-TEMPLATES.md:470-476` still lists missing preview images and template-composer work.

This is a documentation governance problem. Before implementation planning, one current capability matrix should be authoritative; otherwise product, design, QA, and engineering will work from different assumptions.

## 4. Target information architecture

### 4.1 Three surfaces with clear ownership

#### A. Store Templates — choose a starting point

Route: `/admin/themes` (rename user-facing label to **Store Templates**).

Responsibilities:

- Browse templates by business type and visual direction.
- View real desktop/mobile previews.
- Compare with the current store.
- See exactly what the template changes.
- Start from a template or open it in Store Designer.
- Apply a template as a draft or use a guided “Start fresh” action.
- View activation history and rollback.

It should not be a second editor.

#### B. Store Designer — edit the store visually

Route: `/admin/store-designer`.

Responsibilities:

- Choose a page.
- Select visible sections and components.
- Edit content and layout in context.
- Edit global design tokens through a simple design panel.
- Edit reusable component recipes.
- Preview desktop/tablet/mobile.
- Save a draft, preview it, publish it, and revert it.

#### C. System Settings — operate the store

Route: `/admin/settings`.

Keep here:

- Store identity, locale, currency, tax, shipping, payment, checkout rules.
- SEO, analytics, notifications, permissions, integrations.
- Menu/content management that is not visual styling.
- Script injection and dangerous developer settings.

Visual theme editing should be removed from this surface or reduced to a compatibility link with a clear “Edit in Store Designer” action.

### 4.2 Recommended Store Designer layout

```text
┌────────────────────────────────────────────────────────────────────┐
│ Store Designer | Draft/Live status | Page | Device | Undo | Preview │
│                                      Save draft | Publish           │
├────────────────┬──────────────────────────────────┬────────────────┤
│ Structure       │ Real storefront preview         │ Inspector      │
│                 │                                  │                │
│ Page outline    │ Selectable header                │ Selected item  │
│ Sections        │ Selectable sections              │ Content        │
│ Header/Footer   │ Selectable cards/blocks          │ Layout         │
│                 │ Device preview                   │ Style          │
│ Add at position │                                  │ Responsive     │
│                 │                                  │ Advanced       │
└────────────────┴──────────────────────────────────┴────────────────┘
```

The right inspector should be contextual. If nothing is selected, show a small set of global actions; do not show every component editor at once.

### 4.3 User-facing navigation

Use task language:

- **Pages** — Home, Product, Collection, Search, Cart, Account, Blog, and other supported routes.
- **Structure** — sections, blocks, header, footer, ordering, visibility.
- **Design** — brand colors, typography, surfaces, buttons, spacing density, radius, shadows.
- **Components** — the selected product card, category card, promo, trust block, form, badge, cart row, or checkout block.
- **Content** — copy, images, links, product/category sources, campaign content.
- **Responsive** — what changes on mobile/tablet; only show controls that actually have responsive behavior.
- **Advanced** — custom CSS, data sources, developer settings, and raw values behind permissions.

Do not make merchants navigate by `theme`, `componentStyles`, `homepage`, or `pageTemplates`.

## 5. Canonical ownership map

Every visible control should have one home and one write path.

| User need | Canonical editor | Storage/API boundary | What Settings should do |
|---|---|---|---|
| Brand colors and fonts | Store Designer > Design | `theme` / design-token resolver | Link to Designer; no duplicate editable fields |
| Global buttons, surfaces, radius, shadows | Store Designer > Design | semantic tokens and recipes | Link to Designer |
| Product card appearance | Select a product card > Components | `componentStyles.productCard` | Remove duplicate editor; retain migration link |
| Category/promo/brand/trust cards | Select component in preview | `componentStyles.*` | Remove duplicate editor |
| Header and announcement | Click header region | `nav`, `announcement`, header recipe | Keep operational menu management in Settings/Menus |
| Footer | Click footer region | `footer` plus footer section/block model | Keep contact/social data where appropriate; style/layout in Designer |
| Homepage structure | Pages > Home > Structure | `homepage.sections` | Replace legacy editor with redirect/link |
| Product/listing/category layouts | Select the page | `productPage`, `catalog`, category/page groups | Link to page in Designer |
| Copy, images, links, product sources | Selected section/block or content manager | section data/content fields | Do not mix with global design controls |
| Custom CSS | Designer > Advanced CSS | `advanced.customCSS` | Keep permission gate and warn about supportability |
| Scripts, analytics, integrations | System Settings > Advanced | advanced/integration settings | Keep out of visual Designer except for a link |
| Tax, shipping, payments, API keys | System Settings | operational groups | Never surface as design controls |

## 6. Design-system model that users can understand

### 6.1 Keep the technical token hierarchy, simplify the UI

The existing token foundation is valuable. Keep the internal layers:

```text
Primitive values
  ↓
Semantic tokens
  ↓
Component recipes
  ↓
Page/section overrides
  ↓
State tokens: hover, active, focus, disabled
```

The editor should not expose the full token inventory by default. It should expose a small set of design decisions:

- Color mood: palette and semantic roles.
- Typography pairing: heading/body fonts and scale preset.
- Shape: square, soft, rounded, pill.
- Surface: flat, bordered, elevated.
- Density: compact, comfortable, spacious.
- Button treatment: solid, soft, outline, pill.
- Component recipe: Classic, Compact, Editorial, Marketplace, Minimal, or Deal.

Show raw hex values, exact spacing, CSS variables, and advanced token overrides only after the user opens **Customize**.

### 6.2 Use semantic names, not implementation names

The editor should say:

- “Primary action text” instead of `onPrimary`.
- “Card surface” instead of `surfaceColor`.
- “Product card density” instead of a collection of padding and gap fields.
- “Product image ratio” instead of a low-level component property when a visual preview can show the difference.

Storage can continue to use the existing names as a compatibility layer.

### 6.3 Component recipes should be the primary control

For product cards, the user should first choose a visual recipe:

| Recipe | Best for | Basic controls |
|---|---|---|
| Classic | General retail | image ratio, rating, wishlist |
| Compact | B2B/catalog | density, metadata visibility |
| Editorial | Fashion/luxury | image ratio, title placement |
| Marketplace | Dense browsing | quick action, metadata density |
| Minimal | Clean brands | border/surface, metadata visibility |
| Deal | Sale-led stores | badge and promotion treatment |

Only expose a few high-impact controls in Basic mode. Put long-tail fields such as badge position, hover effect, shadow, and exact radius under Customize. This reduces decision fatigue while preserving power.

### 6.4 One component registry must drive everything

The current `DESIGNER_COMPONENTS` array in `SectionComposerPage.jsx:73-90` is a good starting point. It should evolve into the source of truth for:

- Display label and user-facing description.
- Where the component can be selected.
- Which controls it exposes.
- Basic vs advanced control level.
- Preview renderer and sample data.
- Responsive support.
- Permission requirement.
- Storage mapping and migration behavior.
- Accessibility requirements.

This prevents the Settings page, Store Designer, template package schema, and preview from each inventing their own component definitions.

## 7. Template application model

The existing scoped install capability should be retained, but its language should change.

### 7.1 Replace raw scopes with a human-readable change review

Instead of showing only:

```text
design / layoutStyle / homepageSections / dataSources / pageTemplates
```

show:

```text
Brand style       Changes colors, fonts, buttons, surfaces
Site chrome       Changes header, navigation, announcement, footer
Homepage layout   Changes section order and section variants
Product pages     Changes product/listing/category layouts
Store data        Adds approved catalog data sources
Demo content      Replaces starter copy and promotional content
```

Each option needs “What will change?” and “What will stay unchanged?” helper text.

### 7.2 Apply as a draft with a diff

The flow should be:

1. Choose a template.
2. Preview desktop/mobile.
3. Review the affected areas.
4. Resolve conflicts: keep current, apply template, or reset to template default.
5. Apply to a draft.
6. Open in Store Designer.
7. Publish explicitly.
8. Record activation and allow rollback.

For an existing store, demo content must default to off. Data-source changes must show the source names and ownership. A template should never silently replace merchant content because a visual template was selected.

### 7.3 Show source and override state

Every setting should be able to answer:

```text
Where did this value come from?
What overrides it?
How do I reset it?
```

Use a small source indicator:

- Template default
- Store override
- Page override
- Section override
- Component override

Provide **Reset to template**, **Reset to global**, and **Reset this section** actions at the relevant scope.

Recommended resolution order:

```text
platform fallback
  < template default
  < store/global override
  < page override
  < section/block override
  < component instance override
```

The exact order should be documented and tested once, then used everywhere. Do not let individual components silently invent their own precedence.

## 8. Preview and save behavior

### 8.1 One preview language

Use one set of labels:

- **Editor preview** — interactive canvas, unsaved draft.
- **Live storefront preview** — actual route rendered with the draft.
- **Published store** — customer-facing state.

Avoid mixing “mock preview,” “template preview,” “live route,” and “section preview” in user-facing controls unless the difference is explained.

### 8.2 Preview contract

The live storefront and editor preview should share:

- The same section registry and renderer.
- The same token resolver.
- The same component recipes.
- The same data shape and loading/error states.
- The same route/page template selection.

The project has already made important progress here through `SectionRenderer` and `sectionData.js`. That architecture should become a hard invariant.

### 8.3 Draft safety requirements

The editor should provide:

- Draft/live status that is visible at all times.
- Explicit Save Draft and Publish actions.
- Unsaved-change warning before leaving or changing template.
- Undo/redo across sections, components, and token changes—not only section state.
- Before/after comparison against the current live store.
- Publish confirmation summarizing affected routes.
- Rollback to the previous published version.

The current history state is initialized around `sections` (`SectionComposerPage.jsx:126-128,250-252`). If the editor is intended to be a full design system, history must include theme settings, component styles, nav/footer settings, and page settings as one transaction or clearly separate histories by scope.

### 8.4 Preview failure modes

`LiveStorefrontPreview.jsx` uses a local preview key and `previewMode=1`. That is useful for same-browser editing, but the product should explicitly handle:

- Another browser tab changing the draft.
- Local storage being stale or unavailable.
- A preview route failing to load.
- Preview data being empty or different from production data.
- Data-source timeouts and circuit-breaker fallbacks.
- A template containing a section or variant not supported by the current runtime.

The preview should show a visible status such as “Using sample data,” “Live catalog data,” or “Section unavailable,” not silently render a different result.

## 9. What should be moved, hidden, or retained

### Move into Store Designer

- Branding colors, typography, radius, shadows, buttons, card style, background style.
- Product/category/promo/brand/trust card editors.
- Header, footer, announcement layout and style.
- Homepage section composition and content blocks.
- Page template layout settings.
- Custom CSS entry point, with a clear advanced warning.

### Keep in Settings

- Store identity, currency, locale, tax, shipping, payments, checkout operations.
- SEO, analytics, notifications, integrations, permissions.
- Menus as content/navigation management; link to Store Designer for visual header layout.
- Trusted scripts and API/integration settings.

### Temporary compatibility behavior

Do not remove old fields in one release. For one migration period:

- Replace duplicate editors with a read-only summary and “Open in Store Designer.”
- Preserve the existing API/storage keys.
- Record which legacy control opened the new editor to measure migration.
- Keep direct links that open the correct page/component inspector.
- Remove old editing controls only after usage is near zero and migration tests pass.

## 10. Implementation plan

### Phase 0 — Contract and terminology lock

Deliverables:

- Approve **Store Templates**, **Store Designer**, and **System Settings** as the three user-facing terms.
- Decide whether Save is immediate-live or draft/publish. The recommendation is draft/publish.
- Publish one capability matrix with a date and owner.
- Define one canonical settings-to-editor mapping.
- Define the resolution order for template, global, page, section, and component values.

Exit criteria:

- No unresolved question about where a user edits a visual concern.
- No documentation says a capability is missing when the code now provides it.

### Phase 1 — Remove duplicate editing paths

Deliverables:

- Keep `/admin/store-designer` as the only visual editing route.
- Change `/admin/themes` label to Store Templates.
- Replace Settings > Branding/Layout/Homepage visual fields with summaries and links.
- Redirect `/admin/sections` to Store Designer while preserving deep links.
- Keep operational settings in Settings.

Exit criteria:

- A product-card style has exactly one editable UI.
- Homepage sections have exactly one editable UI.
- Header/footer visual layout has exactly one editable UI.
- All old links land at the relevant Designer context.

### Phase 2 — Make the Designer contextual

Deliverables:

- Make the canvas the primary selection surface.
- Add block-level selection for nested card/form/header/footer items.
- Show only the selected item’s inspector.
- Group inspector controls as Content, Layout, Style, Responsive, Advanced.
- Replace flat component lists with “Select a component on the canvas” plus a small Components library.
- Remove emoji characters as structural page icons; use accessible icon components with labels.

Exit criteria:

- A new user can change a product card without knowing `componentStyles.productCard`.
- A new user can edit a hero title directly on the canvas.
- The selected object and inspector remain understandable at mobile widths.

### Phase 3 — Formalize the design-system registry

Deliverables:

- Define component and token schemas with labels, descriptions, presets, constraints, dependencies, and preview metadata.
- Generate editor controls from the schema.
- Generate template validation and migration rules from the same schema where possible.
- Add source/override metadata and reset actions.
- Keep advanced raw values behind Customize and permissions.

Implementation note: `GET /api/settings/design-state` reports source metadata for the Store Designer’s visual groups, while `POST /api/settings/design-reset` removes only the selected visual override so the server default becomes effective again. Homepage content, page operations, catalog controls, payments, and shipping are intentionally outside the reset allowlist.

Current implementation: page-style, component-style, flat site-chrome controls, and the flat portion of global tokens are declared in `client/src/utils/designRegistry.js` and rendered through `client/src/components/admin/themes/designer/DesignSchemaFields.jsx`. Product, category, collection, blog, brand, account, cart, checkout, search, 404, and orders editors now share this path, as do Product, Category, Promo, Brand, Trust, Cart Item, Checkout Block, Form Control, Badge/Chip, Header Layout, Logo, Menu, Announcement Bar, and the foundation/brand/state/typography-basic token groups. Numeric values are normalized for persisted string settings, text limits are enforced at the input boundary, conditional controls preserve existing visibility behavior, and schema tests keep the registry aligned with page/component ownership keys. Header Actions, Footer, and advanced token sections intentionally retain specialized editors for drag-and-drop ordering, dynamic link/content collections, font uploads, variable-font axes, responsive ranges, and visual previews. The remaining implementation slice is full live visual QA, not a second settings ownership path.

Exit criteria:

- A component cannot expose a control that its renderer ignores.
- Every control has a visible preview or a clear explanation of its scope.
- The same token name resolves to the same value in every storefront component.

### Phase 4 — Draft, publish, compare, rollback

Deliverables:

- Server-backed draft/session state rather than only browser-local state.
- Publish transaction covering all selected visual scopes.
- Before/after diff and affected-route summary.
- Conflict detection for concurrent edits and template application.
- Rollback to previous published version without reverting unrelated operational settings.

Implementation note: Theme Activation rollback now locks the affected setting rows, compares each current persisted value with the activation's `afterSnapshot`, restores only unchanged keys, removes template-created overrides that are still unchanged, and returns `rollbackConflicts` for newer edits. Template-owned API data sources now retain before/after state in activation metadata; rollback restores or deactivates only unchanged sources and returns `dataSourceRollbackConflicts` for newer, missing, or legacy sources. The admin flow confirms rollback before execution and reports preserved conflicts. The Store Designer now persists one store-scoped draft with optimistic revisions, supports draft `delete` operations for visual resets, restricts staged writes to visual/page-design groups, publishes writes/deletes inside one transaction after comparing the draft base snapshot with live settings, and stores every successful publish in a version history that can be restored into a draft. Full live visual QA remains pending.

Exit criteria:

- A merchant can safely experiment without changing the live store.
- A rollback restores the previous design but does not erase a newer unrelated content change.

### Phase 5 — Template quality and education

Deliverables:

- Real desktop and mobile preview images for all built-in templates.
- Template capability badges: homepage layout, product card, page layouts, mobile behavior, data sources, section presets.
- “Best for” descriptions and sample catalog data.
- Template compare view with a human-readable change list.
- A design-system help panel explaining tokens, recipes, and reset behavior.

Exit criteria:

- Template cards communicate structural differences, not only colors.
- Users can predict the effect of applying a template before applying it.

## 11. Edge cases and failure modes

These cases need explicit product and test coverage.

### Template application

- Existing store has real content and a template includes demo content.
- Template has a data source key that already exists.
- User applies only design, then later applies page templates.
- User rolls back an activation after manually editing the same settings.
- A package is valid JSON but references an unsupported section variant.
- A package was authored against an older schema version.
- A template has no product, category, brand, or image data for its preview.
- A user has `SETTINGS_READ` but not `SETTINGS_MANAGE`.

### Editor state

- Two tabs edit the same draft.
- Browser storage is cleared while the preview is open.
- User changes page while an inspector field has unsaved text.
- User navigates away with unsaved changes.
- Undo crosses from a component change into a section/page change.
- A page is unavailable or returns a 404 inside the preview iframe.
- Preview uses a fallback component while the published route uses a different one.

### Design-system correctness

- A brand color fails contrast after a component override.
- White text is used on a dark primary button but the derived `on-primary` token is not updated.
- Component radius and global radius disagree.
- A “compact” card hides required information on mobile.
- Long product names, missing prices, missing images, RTL text, and long translated strings overflow.
- Custom CSS overrides a semantic token and makes the UI diverge from the editor.
- A component has a setting in the schema but ignores it in the renderer.

### Safety and accessibility

- Custom CSS/scripts are limited to authorized users and clearly marked as unsupported by the visual editor.
- Every icon-only action has an accessible name.
- All editor controls are keyboard-operable and show focus.
- Drag/reorder actions have buttons or keyboard alternatives.
- Color is never the only indicator of error, selected state, or status.
- Publish and destructive reset actions require confirmation or provide an undo window.

## 12. Pros and cons of the recommended model

### Benefits

- One mental model for visual editing.
- Faster discovery of product-card, header, footer, and page controls.
- Fewer conflicting values and fewer support questions.
- Existing scope apply, rollback, schema validation, and component tokens remain valuable.
- Better preview trust because one renderer and one token registry drive output.
- A clean path for future AI-generated design patches: generate a draft, show a diff, let the user publish.

### Costs and trade-offs

- Legacy Settings controls need a migration period.
- A contextual editor needs stronger selection, focus, and responsive behavior than a form page.
- Draft/publish requires server-side state, conflict handling, and version management.
- Hiding advanced controls can frustrate power users unless Customize and raw access remain available.
- A schema-driven registry requires upfront discipline and migration work.
- A visual editor must handle preview data failures gracefully; it cannot rely on static mock content alone.

## 13. Measurement plan

Run usability tests with these tasks:

1. “Make the product card compact and hide ratings.”
2. “Change the header to a centered logo with a sticky nav.”
3. “Add a sale section between the hero and products.”
4. “Change the global brand style but keep the current homepage content.”
5. “Preview the changes on mobile, publish them, then roll back.”

Track:

- Time to first successful edit.
- Number of navigation changes before finding the correct control.
- Number of duplicate Settings visits.
- Percentage of users who understand what a template will change.
- Preview-to-published mismatch reports.
- Publish failure and rollback frequency.
- Reset-to-template usage.
- Accessibility failures before publish.
- Percentage of users reaching Advanced controls unnecessarily.

Suggested release gates:

- At least 90% of test users find the product-card editor without instruction.
- At least 90% understand whether a change is draft or live.
- No visual concern has two editable controls after migration.
- All supported preview routes use the same design-token and section-rendering contract.
- Publish and rollback are covered by integration tests.

## 14. Final recommendation

Do not add another settings tab or another independent card editor.

Unify the existing capabilities around a canonical Store Designer, make the preview the center of the workflow, and turn the design system into a set of understandable presets and semantic decisions. Keep raw token power, scope-based template installs, data-source safety, contrast checks, and rollback as advanced capabilities behind a clear model.

The most important next step is not visual polish. It is to decide ownership and state:

1. One visual editor.
2. One write path per visual concern.
3. One documented precedence order.
4. One preview contract.
5. One explicit draft/publish model.

Once those are true, the existing design system becomes useful instead of confusing because users can discover it through the storefront itself rather than through internal configuration names.

## 15. Files and commands for the implementation phase

The ownership, contextual-inspector, and canonical-registry slices are now in place. Continue implementation and verification from these files:

- `client/src/utils/designRegistry.js`
- `client/src/pages/admin/SettingsPage.jsx`
- `client/src/components/admin/settings/buildSettingsPanels.jsx`
- `client/src/pages/admin/SectionComposerPage.jsx`
- `client/src/components/admin/settings/LiveStorefrontPreview.jsx`
- `client/src/components/admin/settings/CardStyleEditors.jsx`
- `client/src/components/admin/themes/ThemeApplyDialog.jsx`
- `client/src/components/admin/themes/ThemeGalleryPage.jsx`
- `server/src/modules/theme/theme.service.js`
- `server/src/modules/theme/theme.validation.js`
- `client/src/utils/theme.js`
- `client/src/utils/componentStyles.js`

Minimum verification after implementation:

```bash
cd /home/sr-user91/Documents/Projects/e-commerce/client && npm run build
cd /home/sr-user91/Documents/Projects/e-commerce/server && npm test
```

Add targeted tests for template apply/rollback, settings ownership, draft/publish, preview state, component token resolution, accessibility, and concurrent edits before shipping.

## Appendix: existing documentation that should be updated

After the product decision is approved, reconcile these documents so they no longer disagree:

- `docs/THEME-EDITOR-UX-AUDIT.md` — make it the canonical UX/IA decision document.
- `docs/THEME-SYSTEM-AUDIT.md` — update preview and Store Designer status, and remove or source the absolute competitor comparisons and exact parity/count claims called out in section 1.1.
- `docs/STORE-TEMPLATES.md` — update label, preview status, and current gaps.
- `docs/DESIGN-SYSTEM.md` — add token ownership, precedence, and editor visibility rules.
- `docs/DESIGN-SYSTEM-ISSUES.md` — add duplicate-control ownership and documentation drift as tracked issues.
- `docs/archive/THEME-MARKETPLACE-TEMPLATE-SYSTEM.md` — keep clearly marked as historical; do not use it as current competitor evidence.
