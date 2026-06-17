# Theme Editing UX Audit: Why It Feels Complicated

**Date:** 2026-06-01  
**Scope:** Theme Gallery, Settings > Branding/Layout/Homepage, Section Composer, component/card styles, templates, previews  
**Verdict:** The platform now has strong theme capabilities, but the editing experience is fragmented. Compared with Shopify, Wix, Squarespace, BigCommerce, and Webflow-style builders, our system asks admins to understand internal setting groups instead of editing the storefront visually.

---

## Executive Summary

The issue is not that the theme system is weak. The issue is that the controls are scattered:

- Theme Gallery installs full templates.
- Settings > Branding changes colors/fonts/tokens.
- Settings > Layout changes nav/footer/announcement.
- Settings > Homepage has a legacy homepage editor.
- Section Composer edits homepage sections in a separate builder.
- Card style editors live inside Settings > Branding.
- Product/category/blog/cart/account layout settings are buried in settings tabs.
- Preview exists in multiple forms: mock preview, live iframe preview, template preview, section composer preview.

This makes the product feel more complex than competitors even when the underlying functionality is improving. Competitors win because they give users one primary place to edit the store visually, then hide advanced settings behind contextual panels.

**Senior opinion:** stop adding more scattered controls. The next upgrade should be a unified Store Designer.

---

## Current Editing Model

### What Exists Today

| Area | Current Location | What It Controls | UX Problem |
|---|---|---|---|
| Template install | `/admin/themes` | Theme package, scopes, import/export, rollback | Good concept, but feels separate from editing |
| Colors/fonts | Settings > Branding | `theme.*` design tokens | Too technical for non-designers |
| Card styles | Settings > Branding | `componentStyles.productCard`, category, promo, trust, brand | Powerful, but hidden and abstract |
| Nav/footer/announcement | Settings > Layout | `nav.*`, `footer.*`, `announcement.*` | Separate from visual page editing |
| Homepage sections | Settings > Homepage | legacy section array + hero/promo data | Duplicates Section Composer |
| Homepage builder | `/admin/section-composer` | homepage section order/content/variants | Better UX, but disconnected from template gallery/settings |
| Product/category/blog/cart/account layout | Settings tabs | page template settings | Buried and not visual enough |
| Advanced CSS | Settings > Advanced | custom CSS/JS | Powerful but risky and developer-oriented |

### Core Problem

The user has to ask: **where do I edit this thing?**

That question should almost never exist in a modern theme builder. If the admin sees a product card, they should click the product card and edit it. If they see the header, they should click the header. If they want a new homepage section, they should add it from the page builder. If they want global style, it should be in a clear Design panel.

---

## Competitor Pattern

### Shopify

Shopify does not make merchants think in database groups like `theme`, `homepage`, `componentStyles`, or `pageTemplates`.

It gives them:

- Theme library
- Customize button
- Visual editor
- Left section tree
- Right contextual settings
- Page selector at the top
- Device preview
- App blocks/extensions
- Theme settings for global design

### Wix / Squarespace

They lead with visual editing:

- Click an element
- Edit content/design inline or in a side panel
- Add sections from a visual library
- Page-level design is visible
- Global styles exist, but are not the main editing surface

### BigCommerce Page Builder

The strong pattern is:

- Drag widgets/sections
- Configure selected block
- Preview real storefront context
- Theme settings stay secondary

### What This Means For Us

Our current system is closer to a powerful configuration dashboard than a competitor-grade visual theme editor.

That is why it feels complicated.

---

## Major UX Findings

## 1. Too Many Editing Places

**Severity:** Critical

There are multiple places to edit overlapping concepts:

- Settings > Homepage and Section Composer both edit homepage structure.
- Theme Gallery installs templates, but editing happens elsewhere.
- Card styles live in Branding, but users expect them near the cards they affect.
- Page layouts are scattered across Catalog, Product, Brand, Cart, Account, Blog settings.

**Impact:** Admins do not build a clear mental map. They click around and feel the platform is hard even when the controls work.

**Recommendation:** Create one primary route: `/admin/store-designer`.

---

## 2. Controls Are Organized By Backend Group, Not User Intent

**Severity:** Critical

Settings tabs are mostly grouped like internal configuration:

- Branding
- Layout
- Homepage
- Catalog
- Checkout
- Promotions
- Advanced

But merchants think in tasks:

- Change homepage
- Change product cards
- Change header
- Change footer
- Change product page
- Change mobile layout
- Change brand style
- Launch a sale page

**Recommendation:** Use task-based navigation inside Store Designer:

- Pages
- Sections
- Design
- Components
- Content
- Mobile
- Advanced

---

## 3. Theme Gallery Feels Like Color Presets Unless Templates Change Real Structure

**Severity:** High

Even after adding page templates, section presets, and component styles, the visible admin experience still risks feeling like “apply colors” unless the gallery shows what changes:

- layout differences
- section recipes
- product card variants
- product page variants
- category page variants
- mobile behavior
- included API Builder data sources

**Recommendation:** Template cards must show capabilities as visual badges and screenshots:

- Homepage layout
- Product page layout
- Category layout
- Card style
- Mobile optimized
- Includes API data source
- Includes section presets

---

## 4. Section Composer Is The Right Direction, But Too Isolated

**Severity:** High

Section Composer has the right shape: left controls, preview, add sections, device modes, save as template. But it only handles homepage sections and is disconnected from the Theme Gallery and global design.

**Recommendation:** Promote Section Composer into Store Designer and expand it:

- Page selector: Home, Product, Category, Collection, Blog, Cart, Account
- Section tree per page
- Click-to-edit sections in preview
- Contextual settings panel
- Global design panel
- Component style panel

---

## 5. Card Style Editing Is Powerful But Invisible

**Severity:** High

Product card, category card, promo card, trust card, and brand card styling exists, but it is hidden under Branding. That does not match user expectations.

A merchant does not think: “I need Branding > ProductCard componentStyles.”  
They think: “I want this product card to look different.”

**Recommendation:** Component editing should be contextual:

- Click product card in preview → Product Card settings open
- Click category tile → Category Card settings open
- Click promo banner → Promo Banner settings open
- Click trust item → Trust Card settings open

---

## 6. Preview System Is Fragmented

**Severity:** Medium-High

Current preview types:

- Settings mock preview
- Settings live iframe preview
- Theme template preview
- Section Composer preview

This creates inconsistent trust. Some previews are real, some are mock, some use package data.

**Recommendation:** One preview engine:

- Real storefront iframe as the default
- Preview session/snapshot support
- Selected page route rendered with temporary settings
- Overlay selection layer for editable components

---

## 7. Advanced Options Are Too Visible For Basic Users

**Severity:** Medium

Many settings are useful, but showing all of them together makes the product feel harder.

**Recommendation:** Progressive disclosure:

- Basic mode: presets, simple sliders, common toggles
- Advanced mode: exact tokens, JSON, CSS, per-component flags
- Developer mode: API Builder/data sources/custom CSS

---

## Target Product: Store Designer

## Goal

Replace scattered theme editing with one visual editing surface.

**Route:** `/admin/store-designer`

## Primary Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Top bar: Page selector | Device | Undo/Redo | Preview | Save/Publish │
├───────────────┬───────────────────────────────────────┬─────────────┤
│ Left Panel    │ Live Storefront Preview               │ Right Panel │
│               │                                       │             │
│ Pages         │ Clickable sections/cards/header/footer │ Contextual  │
│ Sections      │ Drag/drop section order                │ settings    │
│ Theme         │ Real data preview                      │             │
│ Components    │                                       │             │
└───────────────┴───────────────────────────────────────┴─────────────┘
```

## Editing Modes

| Mode | Purpose |
|---|---|
| Pages | Pick Home, Product, Category, Blog, Cart, Account |
| Sections | Add/reorder/remove page sections |
| Design | Global colors, fonts, radius, shadows |
| Components | Product cards, category cards, buttons, forms, badges |
| Content | Hero slides, banners, trust copy, homepage content |
| Mobile | Mobile-specific visibility/layout overrides |
| Advanced | CSS, data sources, raw settings, developer tools |

---

## Recommended Information Architecture

### Keep

- `/admin/themes` as **Template Library**
- `/admin/settings` as **System Settings**
- `/admin/store-designer` as **visual editor**

### Deprecate / Move

| Current UI | Move To |
|---|---|
| Settings > Branding theme controls | Store Designer > Design |
| Settings > Branding card style editors | Store Designer > Components |
| Settings > Layout header/footer/announcement | Store Designer > Sections or Header/Footer selection |
| Settings > Homepage legacy builder | Store Designer > Home page |
| Settings > Advanced custom CSS | Store Designer > Components > Advanced CSS |
| Section Composer | Store Designer foundation |
| Page layout dropdowns in settings | Store Designer > Pages |

Settings should remain for operational/admin configuration, not visual theme editing.

---

## Implementation Roadmap

## Phase 1: Unify Entry Points

**Goal:** Stop user confusion without rebuilding everything.

**Status:** Started.

Implemented:

- Added `/admin/store-designer` route while keeping the old `/admin/sections` route working.
- Reused current `SectionComposerPage` as the Store Designer foundation.
- Renamed the admin navigation entry from “Homepage Sections” to “Store Designer”.
- Renamed the page header to “Store Designer”.
- Added a “Customize Store” button in Store Templates that opens `/admin/store-designer`.
- Added top page selector shell, initially Home only, with future pages visible as disabled “Soon” options.
- Added notice in Settings > Homepage that recommends Store Designer for visual homepage editing.

Still needed:

- Move visual editing links from Settings into Store Designer.

**Outcome:** One obvious place to edit design.

---

## Phase 2: Move Component Style Editors Into Designer

**Goal:** Product/category/card editing becomes discoverable.

**Status:** Started.

Implemented:

- Added Store Designer left-panel tabs: Sections and Components.
- Reused existing `CardStyleEditors` inside Store Designer instead of creating another editing system.
- Added component selector:
  - Product Card
  - Category Card
  - Promo Banner
  - Trust Item
  - Brand Card
- Component style edits update the Store Designer preview package immediately.
- Store Designer save now persists homepage sections and `componentStyles` together.
- Section cards now show contextual “Edit card style” shortcuts when they map to Product, Category, Promo, Brand, or Trust card styles.
- Settings fields remain as fallback for now.

Still needed:

- Add true preview-canvas click overlays for direct selection inside the live preview.
- Reduce duplicate visibility of component style controls in Settings once Store Designer is stable.

**Outcome:** User can edit cards in the same place they preview the store.

---

## Phase 3: Contextual Click-To-Edit

**Goal:** Match competitor mental model.

**Status:** Started.

Implemented:

- Preview sections are wrapped with hover overlays through `SectionFrame`.
- Clicking a preview section opens that section's settings in Store Designer.
- Section list cards expose direct shortcuts into related component style editors.
- Header and footer preview clicks now open their matching Store Designer component editors.
- Product, category, promo, brand, and trust cards inside the preview now open their matching component style editor.
- Store Designer now shows a breadcrumb/location row for Home, Sections, selected section, and selected component editor.

Still needed:

- Add deeper nested breadcrumbs for direct card selection, e.g. `Home > Product Row > Product Card`.

**Outcome:** User no longer asks where to edit something.

---

## Phase 4: Page Selector And Page Templates

**Goal:** Templates affect more than homepage.

**Status:** Started.

Implemented:

- Page selector supports active Home, Product, Category, Collection, Brand, Account, Cart, and Blog editing modes.
- Each page has first-class preview metadata, including the preview URL shown in the browser frame.
- Product, Category, Collection/Catalog, Brand, Account, and Blog layout editors are available in the left Store Designer panel.
- Cart currently uses global design/component styling and shows explanatory fallback content.
- Page template settings save with Store Designer alongside sections and component styles.
- Advanced Custom CSS is available inside Store Designer under Components > Advanced CSS for admins with `SETTINGS_ADVANCED`.

Still needed:

- Replace mock page previews with route-level iframe/session previews.
- Move remaining page layout dropdowns out of Settings once Store Designer is stable.

**Outcome:** Store templates feel competitive because whole store layout is editable.

---

## Phase 5: Real Preview Session Engine

**Goal:** One trusted preview.

**Status:** Started.

Implemented:

- Store Designer now has an Editable / Live Route preview switch.
- Live Route preview reuses the existing same-origin `storePreviewTheme` snapshot bridge.
- Unsaved Store Designer settings are written into the preview snapshot without saving production settings.
- Live Route opens the real storefront route with `?previewMode=1`, so admins can compare mock editor output against actual route rendering.
- Live Route preview now debounces iframe reloads when Store Designer layout/page settings change.

Still needed:

- Move preview snapshots server-side or sign client-side snapshots before exposing preview links outside the current browser.
- Add before/after route comparison.
- Replace remaining mock previews where the real route is stable enough.

**Outcome:** What admin sees is what shoppers will see.

---

## Phase 6: Preset-First Editing

**Goal:** Reduce complexity for normal merchants.

Instead of showing dozens of controls first, show visual presets:

- Product Card: Classic, Marketplace, Editorial, Deal, Minimal
- Category: Image Tiles, Icon Grid, Compact Chips, Editorial
- Header: Minimal, Centered Logo, Mega Menu, Transparent
- Footer: Simple, Multi-column, Newsletter, Marketplace
- Product Page: Gallery Left, Sticky Buy Box, Editorial, Compact

Implemented first slice:

- Product Card preset cards: Classic, Marketplace, Editorial, Deal, Minimal.
- Category Card preset cards: Image Tiles, Editorial, Icon Grid, Compact Chips.
- Header preset cards: Minimal, Retail, Campaign.
- Store Designer > Components now includes Design Tokens for global button/card/background/header style, radius, and typography rhythm.
- Editable preview now routes hero/editorial/newsletter/countdown buttons, forms, and timer controls into the relevant component editor.
- Cart Item Row and Checkout Blocks now have Store Designer component editors and real storefront consumers on cart/checkout pages.
- Forms & Inputs now have global Store Designer controls for variant, density, radius, fill, focus style, and label style. These are wired into newsletter signup and checkout forms.
- Badges & Chips now have global Store Designer controls for variant, size, radius, weight, casing, and letter spacing. These are wired into checkout offer/payment chips and product detail stock/sale/SKU chips.

Advanced controls remain available under “Customize”. Custom CSS lives in Store Designer > Components > Advanced CSS, while script injection remains in Settings > Advanced for trusted operators only.

**Outcome:** Fast, understandable editing.

---

## Phase 7: AI / Guided Design Assistant

**Goal:** Compete with 2026 expectations.

Add guided flows:

- “Make my store look luxury.”
- “Create a sale homepage.”
- “Improve mobile layout.”
- “Generate category landing page.”
- “Apply this brand color palette.”

AI should output a draft template package/settings patch, preview it, then let admin apply.

---

## Quick Wins To Implement First

1. ✅ Rename Section Composer to Store Designer in nav and page header.
2. ✅ Add “Customize Store” button in Theme Gallery / Store Templates.
3. Hide or de-emphasize legacy Settings > Homepage editor.
4. ✅ Add CardStyleEditors to Store Designer Components panel; later de-emphasize the duplicate Settings controls.
5. ✅ Add visual preset cards for Product Card, Category Card, and Header before raw dropdowns.
6. ✅ Add Store Designer > Components > Design Tokens for global style controls.
7. ✅ Move Custom CSS entry point into Store Designer > Components > Advanced CSS while keeping script injection in Settings > Advanced.
8. ✅ Add click-to-edit routing for hero/editorial/countdown controls into Design Tokens and newsletter forms into Forms & Inputs.
9. ✅ Add real style consumers/editors for cart item rows and checkout blocks.
10. ✅ Add real style consumers/editors for standalone forms and badges/chips.
11. Add one consistent preview mode label everywhere: “Live Preview” or “Template Preview”, not multiple preview concepts.
12. Add “What does this change?” helper text for each template apply scope.

---

## Senior Recommendation

Do not keep expanding Settings with more theme controls. That path will make the system more powerful and less usable at the same time.

The right direction is:

> **Template Library → Store Designer → contextual visual editing → advanced settings only when needed.**

This is how we close the competitor gap. Not by adding 50 more settings, but by making the editing experience obvious.

