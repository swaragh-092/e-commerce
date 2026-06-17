# Theme System — Complete A-to-Z Audit

> **Date:** 2026-06-01
> **Scope:** Theme Gallery, Custom Theme, Dark Mode, Design Tokens, Component Styles
> **Verdict:** Architecturally solid (8/10), but missing critical modern standards

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current System Architecture](#2-current-system-architecture)
3. [Strengths — What's Working Well](#3-strengths)
4. [Critical Gaps](#4-critical-gaps)
5. [Competitor Comparison Matrix](#5-competitor-comparison)
6. [Detailed Gap Analysis](#6-detailed-gap-analysis)
7. [Recommendations (Priority-Ordered)](#7-recommendations)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Unique Advantages to Protect](#9-unique-advantages)

---

## 1. Executive Summary

**Related UX audit:** see [Theme Editing UX Audit](./THEME-EDITOR-UX-AUDIT.md) for the admin editing-flow problem and Store Designer recommendation.

Your theme system has a **strong foundation** that rivals mid-tier platforms. The scope-based theme application, snapshot/rollback, and component-level design tokens are features that even Shopify and BigCommerce don't offer. However, the system is at roughly **60-70% feature parity** with industry leaders and is missing several 2025-2026 table-stakes features.

### Score Card

| Dimension | Score | Notes |
|-----------|-------|-------|
| Architecture | 8/10 | Clean separation, MUI integration, settings-based |
| Theme Gallery | 7/10 | 12 themes, categories, import/export, history |
| Customization Depth | 7/10 | 27 properties, 7 component types |
| Dark Mode | 7/10 | 3-tier resolution, separate dark palette |
| Safety & Rollback | 9/10 | Joi validation, snapshots, audit logging |
| Design Tokens | 7/10 | ~100 `--store-*` CSS variables emitted with brand, semantic, state, component, layout, and z-index tokens; cards consume shared tokens |
| Live Preview | 5/10 | Section preview with real data exists; not a full storefront iframe |
| Accessibility | 7/10 | Full WCAG 2.1 contrast checker (`accessibility.js`), live `ThemeContrastPanel` in Branding settings, `themeScore.js` accessibility scoring, badges on theme cards; missing: auto-suggest fixes, keyboard audit |
| AI Features | 0/10 | Nothing implemented |
| Developer Experience | 2/10 | No CLI, no types, no dev server |
| Marketplace | 2/10 | Manual import only |
| Performance | 5/10 | MUI CSS-in-JS runtime overhead |
| Mobile Editing | 4/10 | Device preview frames in Section Composer; no mobile-specific overrides |

**Overall: 7.5/10** — Strong foundation with comprehensive token hierarchy, accessibility checking, and performance scoring. Remaining gaps are ecosystem (marketplace, AI, dev tools) and UX polish (iframe preview, Store Designer).

### 2026-06-01 Implementation Update

Since the original audit baseline, the theme system has been upgraded in several material ways:

- `pageTemplates` are now applied/exported for product, collection, category, brand, cart, account, and blog/content pages.
- `componentStyles` are consumed by live storefront cards and included in install/export flows.
- `sectionPresets` are now a first-class package capability with validation, apply, preview, export, and save-to-library support.
- The Section Composer now has a preset gallery grouped by business goal: Hero, Merchandising, Trust, Conversion, Content, and Campaign.
- All 12 built-in templates now ship validated `sectionPresets`, so imported/prebuilt templates can change what designers see when they add new sections.
- Template preview now fetches real product, category, brand, and API Builder-backed product data for shared section rendering instead of relying only on placeholders.
- Resolved `--store-*` design tokens are emitted for the live storefront and scoped into template previews for token-aware custom CSS/sections.
- Product cards, category cards, promo banners, and trust cards now consume shared shadow, border, radius, and overlay tokens.
- Full WCAG 2.1 contrast checker exists (`client/src/utils/accessibility.js`) with `hexToRgb`, `relativeLuminance`, `contrastRatio`, `evaluateContrast`, `auditThemeContrast`, and `accessibilityScore`.
- Live `ThemeContrastPanel` in Settings > Branding audits 4 critical colour pairs with AA/AAA badges.
- `themeScore.js` provides both performance and accessibility scoring for theme packages.
- `ThemeCard.jsx` shows both performance and accessibility score badges on every theme card.

Updated senior verdict: the system is no longer just a theme gallery. It is now a safer Store Template system with design tokens, component styles, page templates, data-source support, reusable section recipes, WCAG contrast checking, and performance/accessibility scoring. The remaining competitor gaps are ecosystem (marketplace, AI, dev tools) and UX polish (iframe preview, Store Designer unification).

---

## 2. Current System Architecture

### 2.1 Data Flow

```
config/default.json (defaults)
        │
        ▼
settingsService.getAllSettings()  ←  API: GET /settings
        │
        ▼
SettingsContext (React Context)
        │
        ├─► resolveStorefrontThemeState()  →  resolved colors, mode, style options
        │
        ├─► buildStorefrontTheme()         →  MUI createTheme() config
        │       │
        │       ▼
        │   ThemeProvider (MUI)
        │       │
        │       ▼
        │   All components via sx prop / theme.palette.*
        │
        └─► useComponentStyles(name)       →  per-component tokens (7 types)
```

### 2.2 Key Files

| File | Role |
|------|------|
| `client/src/context/ThemeContext.jsx` | Settings provider, dark mode, Google Fonts, custom CSS injection |
| `client/src/utils/theme.js` | `resolveStorefrontThemeState()` + `buildStorefrontTheme()` |
| `client/src/utils/componentStyles.js` | 7 component style defaults + `getComponentStyle()` merge |
| `client/src/hooks/useSettings.js` | `useSettings()`, `useFeature()`, `useComponentStyles()` |
| `client/src/pages/admin/SettingsPage.jsx` | 11-tab admin settings with live preview panel |
| `client/src/components/admin/settings/buildSettingsPanels.jsx` | Settings form builder (colors, fonts, styles) |
| `client/src/pages/admin/ThemeGalleryPage.jsx` | Theme gallery (builtin, library, history tabs) |
| `client/src/services/themeService.js` | Client API wrapper for theme operations |
| `server/src/modules/theme/theme.service.js` | Server: apply, rollback, validate, import/export |
| `server/src/modules/theme/theme.validation.js` | Joi schema for theme packages |
| `server/src/modules/theme/builtin/*.theme.json` | 12 built-in theme packages |

### 2.3 Theme Package Schema (v3)

```json
{
  "schemaVersion": 3,
  "meta": { "slug", "name", "version", "author", "description", "category", "tags", "previewImage" },
  "design": {
    "theme": {
      "mode", "primaryColor", "secondaryColor", "backgroundColor", "surfaceColor", "textColor",
      "fontFamily", "headingFont", "headingWeight", "bodyWeight", "lineHeight", "letterSpacing",
      "headingLetterSpacing", "borderRadius", "headerStyle", "buttonStyle", "cardStyle", "backgroundStyle"
    }
  },
  "layout": { "nav": {...}, "footerStyle": {...}, "announcementStyle": {...}, "homepageSections": [...] },
  "componentStyles": { "productCard": {...}, "categoryCard": {...}, ... },
  "pageTemplates": { "product": {...}, "collection": {...}, "cart": {...}, ... },
  "demoContent": { "heroSlides": [...], "valueProps": [...], "promoBanners": [...] },
  "dataSources": [{ "type": "apiBuilder", "key": "...", "definition": {...} }],
  "capabilities": { "hasDesign": true, "hasLayout": true, ... }
}
```

### 2.4 Settings Groups (21 total)

| Group | Keys | Purpose |
|-------|------|---------|
| `theme` | 18 | Colors, fonts, weights, radius, styles |
| `componentStyles` | 7 | Product/category/promo/brand/trust/review/content cards |
| `nav` | 2 | Sticky, category bar |
| `footer` | 6+ | Colors, links, social, contact |
| `announcement` | 5 | Text, link, colors, dismiss |
| `homepage` | 4+ | Sections, hero, value props, promos |
| `catalog` | 5+ | Layout, grid, filters, sorting |
| `productPage` | 6+ | Layout, SKU, badges, buttons |
| `general` | 6 | Store name, currency, locale |
| `seo` | 7+ | Meta, OG, analytics |
| `advanced` | 4 | Custom CSS, head/body scripts, API Builder |
| ... | ... | ... |

### 2.5 Built-in Themes (12)

| Theme | Category | Mode | Primary Color |
|-------|----------|------|---------------|
| premium-retail | general | light | #0f766e (teal) |
| clean-minimal | general | light | #111827 (black) |
| luxury-dark | luxury | dark | #d4af37 (gold) |
| fashion-drop | fashion | light | (fashion palette) |
| kids-play | kids | light | (playful palette) |
| bookstore-classic | books | light | (warm palette) |
| b2b-catalog | b2b | light | (professional palette) |
| tech-pro | electronics | light | (tech palette) |
| grocery-fresh | grocery | light | (fresh palette) |
| beauty-studio | beauty | light | (beauty palette) |
| artisan-craft | handmade | light | (craft palette) |
| sports-gear | sports | light | (sports palette) |

---

## 3. Strengths

### 3.1 Scope-Based Theme Application ⭐ UNIQUE

No competitor offers this. When applying a theme, users can select exactly which scopes to apply:

- ✅ Design (colors, fonts, styles)
- ✅ Layout (nav, footer, announcement)
- ✅ Homepage Sections
- ✅ Component Styles (7 card types)
- ✅ Page Templates
- ✅ Data Sources (API Builder)
- ✅ Demo Content (hero slides, promos)

This means a user can apply just the colors from one theme and the layout from another — full composability.

### 3.2 Snapshot & Rollback ⭐ BEST-IN-CLASS

Every theme activation creates:
- `beforeSnapshot` — full settings state before apply
- `afterSnapshot` — full settings state after apply
- One-click rollback to any previous state
- Activation history timeline

Shopify has version history but not per-activation snapshots with selective rollback.

### 3.3 Component-Level Design Tokens ⭐ ADVANCED

7 component types with granular control:
- `productCard`: variant, imageRatio, imageFit, showBrand, showCategory, showRating, showWishlist, showSaleCountdown, priceStyle, badgeStyle, badgePosition, hoverEffect, radius, shadow, density
- `categoryCard`: variant, imageRatio, imageFit, titlePlacement, showSubtitle, showProductCount, hoverEffect, radius, shadow
- `promoCard`: variant, imagePlacement, titleSize, ctaStyle, radius, shadow
- `brandCard`: variant, imageRatio, hoverEffect, radius, shadow
- `trustCard`: variant, titleSize, radius, shadow
- `reviewCard`: variant, showRating, radius, shadow
- `contentCard`: variant, imageRatio, titleSize, hoverEffect, radius, shadow

This is more granular than Shopify's section-level customization.

### 3.4 Dark Mode with Separate Palette

Three-tier resolution:
1. Customer localStorage override
2. Admin-configured default
3. Browser `prefers-color-scheme` fallback

Plus admin can configure a completely separate `darkPalette` with different primary, secondary, background, surface, and text colors.

### 3.5 Schema-Validated Theme Packages

Joi validation ensures:
- All color values are valid hex
- Font weights are in range (300-900)
- Layout values are from allowed enums
- API Builder sources are restricted to catalog data (no user/payment data)
- Max limits on blocks, items, records

### 3.6 Custom CSS/JS Injection

Admin can inject:
- Custom CSS (via `advanced.customCSS`)
- Head scripts (analytics, tracking)
- Body scripts (widgets, integrations)

---

## 4. Critical Gaps

### 4.1 ⚠️ CSS Custom Properties Are Partial (Design Tokens)

**Severity: HIGH**

Resolved theme tokens are now emitted to the DOM as `--store-*` CSS variables from `ThemeContext`. This lets custom CSS and widgets consume the active theme without hardcoding hex values. The remaining gap is hierarchy: the system still lacks a full semantic/component token model such as `--color-primary-dark`, `--color-on-surface`, `--component-product-card-radius`, and state tokens.

**Impact:**
- Custom CSS can now use `var(--store-color-primary)`, `var(--store-color-surface)`, `var(--store-radius)`, etc.
- Third-party widgets can inherit the first layer of active storefront theme tokens.
- Runtime theme switching still rebuilds the MUI theme, but CSS variables update at the document root and template preview canvas.
- Remaining gap: partial component adoption only; no full hierarchy yet (brand → semantic → component → state).

**What competitors do:**
- Shopify OS 2.0: CSS variables for all design tokens
- WooCommerce: `theme.json` with CSS custom properties
- Magento Hyva: Full CSS custom properties + Tailwind

### 4.2 ⚠️ Live Preview Partial

**Severity: MEDIUM-HIGH (was HIGH)**

Section preview now uses shared storefront section components and fetches real product/category/brand data. Device-specific preview (desktop/tablet/mobile) exists in the Section Composer. Before/after comparison exists in the template preview modal.

**What's done:**
- ✅ Section preview with real product, category, brand data
- ✅ Device frame selector in Section Composer
- ✅ Before/after comparison in template preview modal
- ✅ Template preview fetches real API Builder-backed data

**What's still missing:**
- ❌ Not a full iframe of the actual storefront route
- ❌ Route-level behavior, headers, menus, and live integrations not represented
- ❌ No temporary settings overlay (preview uses saved state)
- ❌ Mobile-specific editing overrides still missing

**What competitors do:**
- Shopify: Full iframe preview with real products, real-time editing
- BigCommerce: Page Builder with real storefront
- WooCommerce: Live Customizer with real site
- Squarespace: Integrated preview with device frames

### 4.3 ⚠️ Accessibility Tooling Partial

**Severity: MEDIUM (was HIGH)**

WCAG 2.1 contrast checker exists (`client/src/utils/accessibility.js`) with full colour math, `evaluateContrast()`, `auditThemeContrast()`, and `accessibilityScore()`. A live `ThemeContrastPanel` in Settings > Branding audits 4 critical colour pairs (text/bg, primary/bg, white/primary, secondary/bg) and shows AA/AAA badges with exact ratios as the admin edits colours.

**What's done:**
- ✅ Contrast ratio calculator (WCAG 2.1 formula)
- ✅ AA/AAA pass/fail badges in admin color picker
- ✅ Live scoring panel (X/4 pairs passing AA)
- ✅ Tooltip explains each level to non-technical users

**What's still missing:**
- ❌ No keyboard navigation audit
- ❌ No auto-suggest compliant color alternatives when contrast fails
- ❌ No ARIA attribute guidance

**Note:** Body font size is not user-configurable — MUI defaults to 16px, which meets WCAG minimums. Font-size enforcement is only needed if a `theme.bodyFontSize` setting is added.

**What competitors do:**
- Shopify: WCAG 2.1 guidelines, theme quality standards
- BigCommerce: Accessibility Checker integration
- All major platforms: WCAG 2.1 AA as baseline

### 4.4 ❌ No AI Features

**Severity: HIGH (competitive gap)**

No AI-powered theme features.

**Impact:**
- Missing industry trend (Wix ADI, Shopify Magic)
- No theme generation from brand assets
- No smart color/font suggestions
- No auto dark mode generation

### 4.5 ❌ No Theme Marketplace

**Severity: HIGH (ecosystem gap)**

Only 12 built-in themes + manual JSON import.

**Impact:**
- Limited theme variety
- No community contributions
- No revenue sharing opportunity
- No theme ecosystem growth

### 4.6 ❌ No Developer Tooling

**Severity: MEDIUM-HIGH**

No CLI, no TypeScript types, no dev server, no hot reload.

**Impact:**
- Can't build a developer ecosystem
- Theme creation is manual JSON editing
- No validation in IDE
- No testing framework

### 4.7 ⚠️ Mobile Theme Editing Partial

**Severity: MEDIUM**

Device-specific preview (desktop/tablet/mobile) exists in the Section Composer. However, no mobile-specific editing overrides or separate mobile editor.

**What's done:**
- ✅ Device preview frames in Section Composer

**What's still missing:**
- ❌ Mobile-specific color/layout overrides
- ❌ Separate mobile editor (like Wix)
- ❌ Mobile-specific font size adjustments

**What competitors do:**
- Wix: Full separate mobile editor
- Shopify: Mobile preview
- Squarespace: Responsive device frames

### 4.8 ⚠️ Performance Concerns

**Severity: MEDIUM**

MUI CSS-in-JS has runtime overhead. No critical CSS extraction, no theme-specific bundling. However, `themeScore.js` now provides performance scoring (font count, CSS complexity, section count, data source overhead) and badges are shown on theme cards.

**What's done:**
- ✅ Performance score per theme (`themeScore.js`)
- ✅ Performance badges on theme gallery cards

**What's still missing:**
- ❌ Critical CSS extraction
- ❌ Theme-specific CSS bundling
- ❌ Lazy-loaded theme sections
- ❌ Image optimization in theme packages

**What competitors do:**
- Magento Hyva: Alpine.js + Tailwind (100KB vs 1.5MB)
- Shopify: Lazy loading, CDN
- All: Performance as ranking factor

### 4.9 ⚠️ Theme Versioning Incomplete

**Severity: MEDIUM**

Themes have a `version` field but no update mechanism, no changelog, no diff view.

### 4.10 ⚠️ Limited Typography

**Severity: LOW-MEDIUM**

- Only Google Fonts (no custom font upload)
- No variable font support
- No font subsetting
- No responsive/fluid typography
- No typography scale system

---

## 5. Competitor Comparison

| Feature | Your Platform | Shopify | WooCommerce | BigCommerce | Squarespace | Wix | Magento/Hyva |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Theme Count** | 12 | 500+ | 4,000+ | 200+ | 100+ | 500+ | 300+ |
| **CSS Variables** | ⚠️ ~50 `--store-*` | ⚠️ Partial | ✅ theme.json | ⚠️ Partial | ❌ | ❌ | ✅ Full |
| **Live Preview** | ⚠️ Section-level | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ |
| **Dark Mode** | ✅ Full | ⚠️ Per-theme | ⚠️ Per-theme | ⚠️ Per-theme | ⚠️ Per-theme | ⚠️ ADI | ✅ |
| **Component Tokens** | ✅ 7 types | ⚠️ Limited | ⚠️ Limited | ⚠️ Limited | ❌ | ❌ | ✅ |
| **Scope-based Apply** | ✅ Unique | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Snapshot/Rollback** | ✅ Full | ✅ | ⚠️ Plugin | ✅ | ✅ | ✅ | ✅ Git |
| **Import/Export** | ✅ JSON | ✅ | ✅ | ✅ CLI | ❌ | ❌ | ✅ |
| **Custom CSS/JS** | ✅ | ✅ | ✅ | ✅ | ⚠️ | ⚠️ | ✅ |
| **Accessibility** | ⚠️ Contrast checker | ✅ WCAG | ✅ WCAG | ✅ Checker | ✅ | ✅ | ✅ WCAG |
| **AI Features** | ❌ | ⚠️ Beta | ⚠️ | ❌ | ⚠️ ADI | ✅ ADI | ⚠️ |
| **Marketplace** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Mobile Editing** | ⚠️ Device preview | ⚠️ | ✅ | ✅ | ✅ | ✅ Full | ❌ |
| **Dev Tools** | ❌ | ✅ CLI | ✅ | ✅ Stencil | ❌ | ⚠️ | ✅ CLI |
| **Schema Validation** | ✅ Joi | ✅ | ✅ | ✅ | N/A | N/A | ✅ |
| **Data Safety** | ✅ Restricted | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 6. Detailed Gap Analysis

### 6.1 Design Token Gap

**Current:** ~100 `--store-*` CSS custom properties emitted to `:root` covering brand, semantic, state, component, layout, and z-index tokens.

**Implemented token layers:**

| Layer | Examples | Count |
|-------|---------|-------|
| Brand | `--store-color-primary`, `--store-color-secondary` | 9 |
| Derived scale | `--store-color-primary-dark`, `--store-color-on-primary` | 7 |
| Semantic | `--store-color-error`, `--store-color-success` | 4 |
| State (hover/active/focus) | `--store-color-primary-hover`, `--store-color-surface-active` | 6 |
| Shape | `--store-radius-sm` through `--store-radius-full` | 11 |
| Shadow | `--store-shadow-card`, `--store-shadow-hover`, `--store-focus-ring` | 8 |
| Typography | `--store-font-body`, `--store-font-weight-heading`, `--store-line-height-tight` | 13 |
| Spacing | `--store-space-xs` through `--store-space-3xl` | 7 |
| Transition | `--store-transition-fast`, `--store-ease-out` | 6 |
| Z-index | `--store-z-dropdown`, `--store-z-modal`, `--store-z-tooltip` | 6 |
| Container/Layout | `--store-container-lg`, `--store-header-height` | 6 |
| Component | `--store-button-radius`, `--store-card-padding`, `--store-input-height` | 14 |
| Style flags | `--store-style-background`, `--store-style-button` | 3 |

Custom CSS can now use `var(--store-color-primary-hover)`, `var(--store-shadow-card)`, `var(--store-z-modal)`, `var(--store-card-radius)`, etc.

### 6.2 Accessibility Gap

**Implemented:**
- ✅ Contrast ratio calculator (`client/src/utils/accessibility.js`)
- ✅ WCAG evaluation: AA (4.5:1 normal, 3:1 large), AAA (7:1 normal, 4.5:1 large)
- ✅ Color pair validation: text/bg, primary/bg, white/primary, secondary/bg
- ✅ Live `ThemeContrastPanel` in Settings > Branding
- ✅ `ContrastBadge` chip with AA/AAA/Fail color-coded verdicts
- ✅ Accessibility score (0-100) utility function

**Still needed:**
- ❌ Auto-suggest compliant alternatives when contrast fails
- ❌ Keyboard navigation audit tooling

**Note:** Body font size is not user-configurable — MUI defaults to 16px, which meets WCAG minimums.

### 6.3 Live Preview Gap

**Implemented:**
- ✅ Section preview using shared storefront section components
- ✅ Real product, category, brand data fetched for preview
- ✅ API Builder-backed product data in template preview
- ✅ Device frame selector (desktop/tablet/mobile) in Section Composer
- ✅ Before/after comparison in template preview modal

**Still needed:**
- ❌ Full iframe rendering actual storefront route (e.g., `/preview?theme=...`)
- ❌ Temporary settings overlay (preview uses saved state, not unsaved edits)
- ❌ Route-level behavior (headers, menus, live integrations)

---

## 7. Recommendations

### P0 — Critical (Do First)

| # | Feature | Effort | Status |
|---|---------|--------|--------|
| 4.1 | CSS Custom Properties — first layer (`--store-*`) | Done | ✅ ~50 variables emitted |
| 4.1b | CSS Custom Properties — deeper hierarchy (brand→semantic→component→state) | Done | ✅ ~100 tokens with state, component, layout, z-index |
| 4.2 | Live preview — section-level with real data | Done | ✅ Real product/category/brand data |
| 4.2b | Live preview — full storefront iframe | 3-4 days | ⬜ Remaining |
| 4.3 | Accessibility — WCAG contrast checker | Done | ✅ Full calculator + live panel |
| 4.3b | Accessibility — score on theme cards | Done | ✅ `themeScore.js` + `ThemeCard.jsx` badges |
| 4.6 | Theme performance score | Done | ✅ `themeScore.js` + ThemeCard badges |

### P1 — High Priority

| # | Feature | Effort | Status |
|---|---------|--------|--------|
| 4.4 | AI theme generation | 1-2 weeks | ⬜ HIGH — competitive differentiator |
| 4.5 | Theme gallery UX improvements (favorites, comparison, demo stores) | 3-4 days | ⬜ MEDIUM-HIGH — delight factor |

### P2 — Medium Priority

| # | Feature | Effort | Status |
|---|---------|--------|--------|
| 4.7 | Developer CLI & tooling | 1-2 weeks | ⬜ MEDIUM — ecosystem enablement |
| 4.8 | Theme marketplace foundation | 2-3 weeks | ⬜ MEDIUM — ecosystem growth |
| 4.9 | Improved dark mode (dim/warm) | 2-3 days | ⬜ MEDIUM — polish |
| 4.10 | Responsive breakpoint customization | 3-4 days | ⬜ MEDIUM — flexibility |

### P3 — Lower Priority

| # | Feature | Effort | Status |
|---|---------|--------|--------|
| 4.11 | Theme inheritance & composition | 1 week | ⬜ LOW-MEDIUM |
| 4.12 | Multi-store theme management | 2 weeks | ⬜ LOW (single-store focused) |
| 4.13 | Advanced typography (variable fonts, custom upload) | 3-4 days | ⬜ LOW-MEDIUM |
| 4.14 | Animation & micro-interactions | 1 week | ⬜ LOW — polish |

---

## 8. Implementation Roadmap

```
Phase 1 — Foundation (DONE ✅)
├── ✅ CSS Custom Properties first layer (~50 --store-* variables)
├── ✅ WCAG 2.1 contrast checker + live ThemeContrastPanel
├── ✅ Accessibility + performance scores on theme cards
├── ✅ Section preview with real product/category/brand data
└── ✅ Device preview (desktop/tablet/mobile) in Section Composer

Phase 1b — Foundation Polish (NEXT)
├── ✅ CSS Custom Properties deeper hierarchy (~100 tokens)
└── Full storefront iframe preview

Phase 2 — Intelligence (Weeks 4-6)
├── AI theme generation
└── Gallery UX improvements (favorites, comparison, demo stores)

Phase 3 — Ecosystem (Weeks 7-10)
├── Developer CLI
├── Theme marketplace foundation
└── Improved dark mode (dim/warm variants)

Phase 4 — Scale (Weeks 11-14)
├── Responsive customization
├── Theme inheritance
└── Multi-store theming
```

---

## 9. Unique Advantages to Protect

These are features your platform has that **no competitor offers**. Do not lose them during improvements:

1. **Scope-based theme application** — Apply only design, only layout, only sections, etc.
2. **Component-level design tokens** — 7 component types with 10+ properties each
3. **Before/after snapshots** — Full settings snapshot per activation with rollback
4. **Schema-validated theme packages** — Joi validation ensures safety
5. **Data source restrictions** — Templates can only access catalog data, not user/payment data

These are genuine competitive advantages. Market them.

---

## Appendix: Files Involved

### Client-Side
```
client/src/context/ThemeContext.jsx          — Settings provider, dark mode, CSS injection
client/src/utils/theme.js                    — Theme builder (resolve + build)
client/src/utils/componentStyles.js          — Component style defaults
client/src/hooks/useSettings.js              — Settings hooks
client/src/pages/admin/SettingsPage.jsx      — Admin settings (11 tabs)
client/src/pages/admin/ThemeGalleryPage.jsx  — Theme gallery
client/src/components/admin/settings/buildSettingsPanels.jsx — Settings form builder
client/src/components/admin/themes/ThemeCard.jsx            — Theme card component
client/src/components/admin/themes/ThemePreviewModal.jsx    — Preview modal
client/src/components/admin/themes/ThemeApplyDialog.jsx     — Apply dialog
client/src/components/admin/themes/ThemeImportDialog.jsx    — Import dialog
client/src/components/admin/themes/ThemeDetailModal.jsx     — Detail modal
client/src/components/admin/themes/ThemeHistoryPanel.jsx    — History panel
client/src/services/themeService.js                        — Client API wrapper
```

### Server-Side
```
server/src/modules/theme/theme.service.js       — Apply, rollback, validate, import/export
server/src/modules/theme/theme.routes.js        — API routes (11 endpoints)
server/src/modules/theme/theme.validation.js    — Joi schema
server/src/modules/theme/themePackage.model.js  — ThemePackage model
server/src/modules/theme/themeActivation.model.js — ThemeActivation model
server/src/modules/theme/builtin/*.theme.json   — 12 built-in themes
```

### Configuration
```
config/default.json — Default theme settings (27 properties)
```
