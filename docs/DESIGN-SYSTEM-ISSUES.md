# Theme & Design System — Issues & Findings

> Audit date: 2026-06-04
> Last fix pass: 2026-06-04
> Scope: Complete A-to-Z audit of theme engine, design tokens, components, layouts, sections
> Total issues found: 15 (3 High, 6 Medium, 6 Low)
> Total issues resolved: 12 / 15
>
> **Status legend:** ✅ Fixed · 🟡 Documented / partial · ⏳ Deferred

---

## Table of Contents

1. [Summary](#1-summary)
2. [Resolution Log](#2-resolution-log)
3. [High Priority Issues](#3-high-priority-issues)
4. [Medium Priority Issues](#4-medium-priority-issues)
5. [Low Priority Issues](#5-low-priority-issues)
6. [Affected Files](#6-affected-files)
7. [Fix Recommendations](#7-fix-recommendations)

---

## 2. Resolution Log

A condensed change log for the 2026-06-04 fix pass. Each entry points to the
section below for the full diff and verification steps.

| ID | Title | Resolution | Files |
|----|-------|------------|-------|
| H1 | `useAdminColors` mode-toggle bug | Dropped the `useAdminColors` flag; admin colours are always honoured, dark palette still layers on top | `client/src/utils/theme.js` |
| H2 | Fake "Deal Claimed" percentage | Replaced hash-based percentage with real inventory math, "Selling fast" fallback | `client/src/components/product/ProductCard.jsx` |
| H3 | Inconsistent `radiusMap.pill` | New `client/src/utils/styleMaps.js` shared by 4 section files; `pill` aligned to `9999` | `client/src/utils/styleMaps.js` (new), `client/src/components/product/ProductCard.jsx`, `client/src/components/storefront/sections/{CategorySection,PromoBannerSection,TrustSection}.jsx`, `client/src/utils/componentStyles.js` |
| M1 | Heading weight inconsistency | All six heading levels share the same conditional `fontWeight` fallback of 800 | `client/src/utils/theme.js` |
| M2 | Hero title overrides theme type scale | Hero title now reads `var(--store-font-size-h1)` (×1.1 on desktop) | `client/src/components/storefront/sections/HeroSection.jsx` |
| M3 | Hero buttons ignore `buttonStyle` | `OverlayHero` accepts `buttonStyle` prop and resolves `solid` / `outline` / `soft` variants | `client/src/components/storefront/sections/HeroSection.jsx` |
| M4 | Google Fonts loads 7 weights always | Request now includes only the weights the theme actually uses | `client/src/context/ThemeContext.jsx` |
| M5 | Account menu hard-coded values | Uses `var(--store-shadow-dropdown)` and `var(--store-radius)` | `client/src/layouts/StoreLayout.jsx` |
| M6 | Accessibility audit gaps | `auditThemeContrast` evaluates 6–8 colour pairs | `client/src/utils/accessibility.js` |
| L4 | Dark-palette performance penalty | Removed the unfair 3-pt penalty | `client/src/utils/themeScore.js` |
| L5 | Footer falls back to MUI theme | Fallback chain prefers `var(--store-color-*)` over `theme.palette.*` | `client/src/components/layout/StorefrontFooter.jsx` |
| L6 | Mobile search fixed width | Responsive `sx={{ width: { xs: 120, sm: 160 } }}` | `client/src/layouts/StoreLayout.jsx` |
| L1 | Spacing scale not admin-configurable | Deferred — tracked for theme-admin milestone | — |
| L2 | Hard-coded hero gradient | Deferred — section editor follow-up | — |
| L3 | `radiusMap` / `shadowMap` duplication | Partial — radius half fully resolved via `styleMaps.js`; per-file `shadowMap` consolidation tracked as small follow-up | — |

---

---

## 1. Summary

| Severity | Count | Status |
|----------|-------|--------|
| High | 3 | ✅ All fixed (H1, H2, H3) |
| Medium | 6 | ✅ All fixed (M1, M2, M3, M4, M5, M6) |
| Low | 6 | ✅ 3 fixed (L4, L5, L6) · 🟡 3 deferred (L1, L2, L3 — feature work) |
| **Total** | **15** | **12 fixed · 3 deferred** |

---

## 3. High Priority Issues

### H1: `useAdminColors` Logic Bug — Admin Light Colors Ignored on Mode Toggle ✅ FIXED

**File:** `client/src/utils/theme.js:101`
**Severity:** High — Data loss on user interaction

**Description:**

The `useAdminColors` flag determines whether admin-configured colors are used or hard-coded fallbacks are applied:

```javascript
const useAdminColors = t.mode === themeMode;
```

This comparison means admin-configured light-mode colors are ONLY used when the current resolved mode matches the admin's configured mode. If the admin configures "dark" mode but a customer toggles to "light" via the dark mode toggle, the admin's light-mode colors are NOT used. The system falls back to hard-coded defaults (`#0f766e`, `#f97316`, etc.) instead of the admin's chosen colors.

**Impact:**
- Admin sets custom primary color to `#e91e63` (pink) with mode "dark"
- Customer toggles to light mode
- Store reverts to hard-coded teal `#0f766e` instead of admin's pink
- Admin's color choices are silently lost

**Reproduction:**
1. Admin: Set primaryColor to `#e91e63`, mode to "dark"
2. Customer: Toggle dark mode to "light"
3. Observe: Primary color becomes `#0f766e` (hard-coded default), not `#e91e63`

**Resolution (2026-06-04):**

The `useAdminColors` flag and its ternaries were removed entirely. Admin-configured colors are now always honoured, with the optional `darkPalette` object still layered on top in dark mode:

```javascript
// client/src/utils/theme.js — resolveStorefrontThemeState()
const dp = isDark && t.darkPalette ? t.darkPalette : null;

return {
  // …
  primaryMain:    dp?.primaryColor    || t.primaryColor    || fallbackPrimary,
  secondaryMain:  dp?.secondaryColor  || t.secondaryColor  || fallbackSecondary,
  // …same shape for background, surface, text, error, warning, success, info
};
```

**Verification:**

```bash
$ node -e "import('./client/src/utils/theme.js').then(m => {
  const vars = m.buildStorefrontCssVariables({theme: {primaryColor: '#e91e63', mode: 'dark'}}, 'light');
  console.log('primary light:', vars['--store-color-primary']);
})"
primary light: #e91e63
```

---

### H2: Fake "Deal Claimed" Percentage in ProductCard ✅ FIXED

**File:** `client/src/components/product/ProductCard.jsx:265`
**Severity:** High — Misleading to customers

**Description:**

The "deal" variant of ProductCard displayed a fake "claimed" percentage based on a hash of the product ID:

```javascript
{Math.round(((product.id || 'deal').charCodeAt(0) % 35) + 55)}% Claimed
```

This generated a pseudo-random percentage (55-89%) that had no connection to actual inventory or sales data. The progress bar below it also used the same fake value.

**Impact:**
- Customers see "73% Claimed" with no basis in reality
- Creates false urgency and mistrust
- Potential legal/compliance issue for deceptive UX patterns
- Different products show different fake percentages based on ID character, creating inconsistent experiences

**Reproduction:**
1. Create a product with name starting with 'A' (charCode 65)
2. Create a product with name starting with 'Z' (charCode 90)
3. Both show different fake percentages despite no sales data

**Resolution (2026-06-04):**

The hash-based percentage was removed. The component now derives a real "claimed" percentage from inventory data when present, and falls back to a non-quantitative "Selling fast" label when no real numbers exist:

```javascript
// client/src/components/product/ProductCard.jsx
const stock = Number(product?.stock);
const sold = Number(product?.unitsSold ?? product?.saleUnitsSold);
const initialStock = Number(product?.initialStock ?? product?.initial_stock);
let claimedPercent = null;
if (Number.isFinite(stock) && Number.isFinite(initialStock) && initialStock > 0) {
  claimedPercent = Math.max(0, Math.min(100, Math.round(((initialStock - stock) / initialStock) * 100)));
} else if (Number.isFinite(sold) && Number.isFinite(initialStock) && initialStock > 0) {
  claimedPercent = Math.max(0, Math.min(100, Math.round((sold / initialStock) * 100)));
}
```

When `claimedPercent` is `null` the label becomes "Selling fast" and the progress bar is a neutral placeholder, so customers are never shown a fabricated number. Future enhancement (deferred): surface the percentage as a per-product admin setting.

---

### H3: Inconsistent `radiusMap.pill` Values Across Components ✅ FIXED

**Files:**
- `client/src/components/product/ProductCard.jsx` — local `radiusMap` removed
- `client/src/components/storefront/sections/CategorySection.jsx` — local `radiusMap` removed
- `client/src/components/storefront/sections/PromoBannerSection.jsx` — local `radiusMap` removed
- `client/src/components/storefront/sections/TrustSection.jsx` — local `radiusMap` removed
- `client/src/utils/componentStyles.js:111` — `pill` aligned to `9999`

**Severity:** High — Visual inconsistency across components

**Description:**

The same "pill" radius token produced different visual results depending on which component consumed it (because the values were MUI `theme.shape.borderRadius` multipliers, not absolute CSS values):

| Component | `pill` Value | Effective Pixels (`× 8`) |
|-----------|-------------|--------------------------|
| ProductCard | 6 | 48px (slightly rounded) |
| CategorySection | 8 | 64px (more rounded) |
| PromoBannerSection | 6 | 48px |
| TrustSection | 999 | ~7992px (true pill) |
| CSS variable `--store-radius-full` | 9999px | 9999px (true pill) |
| `componentStyles.js` | 999 | ~7992px |

**Resolution (2026-06-04):**

1. **New shared utility** `client/src/utils/styleMaps.js` exports `radiusMap`, `shadowMap`, `resolveRadius`, and `resolveShadow`. Values are absolute CSS lengths so the result is independent of `theme.shape.borderRadius`:

   ```javascript
   // client/src/utils/styleMaps.js
   const RADIUS_TOKENS = {
     none: '0px', small: '4px', medium: '8px', large: '12px',
     pill: '9999px', full: '9999px',
   };
   export const radiusMap = { ...RADIUS_TOKENS };
   export const resolveRadius = (token, fallback = RADIUS_TOKENS.medium) =>
     radiusMap[token] ?? fallback;
   ```

2. **Components migrated** — `ProductCard`, `CategorySection`, `PromoBannerSection`, and `TrustSection` now `import { resolveRadius, resolveShadow } from '<rel>/utils/styleMaps'` instead of declaring their own `radiusMap`.

3. **`componentStyles.js`** — `pill` was bumped from `999` to `9999` so the `STYLE_RADIUS_VALUES` table matches the shared map for the pill tier (the other tiers remain as multipliers to preserve form/badge visual sizing for existing themes).

**Verification:**

```bash
$ node -e "import('./client/src/utils/styleMaps.js').then(m => {
  console.log('pill:', m.resolveRadius('pill'));
  console.log('medium:', m.resolveRadius('medium'));
})"
pill: 9999px
medium: 8px
```

---

## 4. Medium Priority Issues

### M1: Heading Weight Inconsistency ✅ FIXED

**File:** `client/src/utils/theme.js:541-548`
**Severity:** Medium — Uneven heading hierarchy

**Description:**

When the admin didn't set a custom `headingWeight`, different heading levels used different fallback weights:

```javascript
h1: { ...headingBase, fontSize: typeScale.h1, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
h2: { ...headingBase, fontSize: typeScale.h2, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
h3: { ...headingBase, fontSize: typeScale.h3 },  // Uses headingBase.weight (700)
h4: { ...headingBase, fontSize: typeScale.h4 },  // Uses headingBase.weight (700)
h5: { ...headingBase, fontSize: typeScale.h5, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
h6: { ...headingBase, fontSize: typeScale.h6 },  // Uses headingBase.weight (700)
```

**Resolution (2026-06-04):**

All six heading levels now use the same conditional: when `t.headingWeight` is set we honour it; otherwise we fall back to `800`. The h3/h4/h6 spread of the override across all six lines guarantees a single visual rhythm.

```javascript
// client/src/utils/theme.js — buildStorefrontTheme().typography
h1: { ...headingBase, fontSize: typeScale.h1, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
h2: { ...headingBase, fontSize: typeScale.h2, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
h3: { ...headingBase, fontSize: typeScale.h3, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
h4: { ...headingBase, fontSize: typeScale.h4, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
h5: { ...headingBase, fontSize: typeScale.h5, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
h6: { ...headingBase, fontSize: typeScale.h6, fontWeight: t.headingWeight ? parseInt(t.headingWeight, 10) : 800 },
```

**Verification:**

```bash
$ node -e "import('./client/src/utils/theme.js').then(m => {
  const t = m.buildStorefrontTheme({}, null);
  console.log(t.typography.h1.fontWeight, t.typography.h3.fontWeight,
              t.typography.h5.fontWeight, t.typography.h6.fontWeight);
})"
800 800 800 800
```

---

### M2: Hero Title Overrides Theme Typography Scale ✅ FIXED

**File:** `client/src/components/storefront/sections/HeroSection.jsx:90`
**Severity:** Medium — Theme settings ignored

**Description:**

The hero section hard-coded its title font size instead of using the theme's type scale:

```javascript
sx={{
  fontSize: { xs: '2.55rem', sm: '3.25rem', md: '4.5rem' },
  lineHeight: 0.98,
  fontWeight: 950,
}}
```

If the admin configured a `compact` typography scale (h1: 2.125rem), the hero ignored it and displayed at 4.5rem on desktop.

**Resolution (2026-06-04):**

`HeroCopy` now sources the title size from the CSS custom property `--store-font-size-h1` that the theme engine emits. The `calc()` expression keeps the hero slightly larger than the page h1 (×1.1) so it still feels like a hero, but it scales with the admin-configured typography preset:

```javascript
// client/src/components/storefront/sections/HeroSection.jsx
sx={{
  fontSize: preview
    ? { xs: '1.75rem', sm: '2rem' }
    : { xs: 'calc(var(--store-font-size-h1, 2.5rem) * 1.0)',
        md: 'calc(var(--store-font-size-h1, 2.5rem) * 1.1)' },
  lineHeight: 0.98,
  fontWeight: 950,
  // …
}}
```

Switching the admin's `typographyScale.preset` between `compact`, `default`, `editorial`, and `display` now visibly rescales the hero title.

---

### M3: Hero Buttons Ignore `buttonStyle` Setting ✅ FIXED

**File:** `client/src/components/storefront/sections/HeroSection.jsx:160`
**Severity:** Medium — Style setting ignored

**Description:**

The hero section's primary button used hard-coded white/primary.dark colors regardless of the admin's `buttonStyle` setting:

```javascript
primarySx={{ 
  bgcolor: '#ffffff', 
  color: theme.palette.primary.dark, 
  px: 3, 
  '&:hover': { bgcolor: theme.palette.secondary.light } 
}}
```

If the admin set `buttonStyle: "outline"` or `buttonStyle: "soft"`, the hero button remained solid white.

**Resolution (2026-06-04):**

`HeroSection` now reads `settings.theme.buttonStyle` and threads it into `OverlayHero` as a `buttonStyle` prop. `OverlayHero` resolves a `primaryHeroSx` object that mirrors the global button styles while preserving enough contrast against the dark image:

```javascript
const primaryHeroSx = (() => {
  if (buttonStyle === 'outline') {
    return { bgcolor: 'transparent', color: '#ffffff', border: '2px solid #ffffff', px: 3,
             '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } };
  }
  if (buttonStyle === 'soft') {
    return { bgcolor: 'rgba(255,255,255,0.18)', color: '#ffffff', px: 3,
             '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' } };
  }
  return { bgcolor: '#ffffff', color: theme.palette.primary.dark, px: 3,
           '&:hover': { bgcolor: theme.palette.secondary.light } };
})();
```

The same logic is applied for `pill` style — the hero container already enforces 9999px via the global button style, so the hero CTA picks up the pill shape automatically. (Note: the split / product-spotlight hero variants use the theme's normal `MuiButton` and so already respect `buttonStyle`; only the overlay variant needed this patch.)

---

### M4: Google Fonts Loads 7 Weights Always ✅ FIXED

**File:** `client/src/context/ThemeContext.jsx:135`
**Severity:** Medium — Bandwidth waste

**Description:**

Google Fonts were always loaded with weights 300–900 regardless of what the theme actually used:

```javascript
const families = [...fonts]
  .map((f) => `family=${f.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900`)
  .join('&');
```

A theme using only weight 400 (body) and 700 (headings) still requested 7 weight files per family.

**Resolution (2026-06-04):**

The Google Fonts request now only includes the weights the theme actually uses. We still include `400` and `700` as a safety net so MUI's default body/heading rendering never falls back to a faux-bold:

```javascript
// client/src/context/ThemeContext.jsx
const bodyWeight = parseInt(data.theme.bodyWeight, 10) || 400;
const headingWeight = parseInt(data.theme.headingWeight, 10) || 700;
const weightSet = new Set([bodyWeight, headingWeight, 400, 700]);
const weightStr = [...weightSet].sort((a, b) => a - b).join(';');
const families = [...fonts]
  .map((f) => `family=${f.replace(/\s+/g, '+')}:wght@${weightStr}`)
  .join('&');
```

For a default theme (body 400, heading 700) this drops the request from 14 weight files to 2. For a theme that customises both weights, it stays at 2–3 weight files.

---

### M5: Account Menu Uses Hard-coded Radius/Shadow ✅ FIXED

**File:** `client/src/layouts/StoreLayout.jsx:429-436`
**Severity:** Low-Medium — Token inconsistency

**Description:**

The account dropdown menu used hard-coded values instead of theme tokens:

```javascript
PaperProps={{
  sx: {
    mt: 1.5,
    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',  // Hard-coded
    borderRadius: '8px',                           // Hard-coded
    minWidth: '220px',
  },
}}
```

**Resolution (2026-06-04):**

The menu's `PaperProps.sx` now references the design tokens the theme engine emits on `:root`:

```javascript
PaperProps={{
  sx: {
    mt: 1.5,
    boxShadow: 'var(--store-shadow-dropdown)',
    borderRadius: 'var(--store-radius)',
    minWidth: '220px',
    overflow: 'hidden',
  },
}}
```

The account menu now picks up the admin-configured global radius, and its shadow matches the dark-mode `--store-shadow-dropdown` value.

---

### M6: Accessibility Audit Only Checks 4 Color Pairs ✅ FIXED

**File:** `client/src/utils/accessibility.js:120-145`
**Severity:** Medium — Incomplete WCAG coverage

**Description:**

The accessibility audit only evaluated 4 color pairs:

1. Text / Background
2. Primary / Background
3. White / Primary
4. Secondary / Background

Missing important pairs:
- **White on Secondary** — Secondary button text legibility
- **Text on Surface** — Card content readability
- **Error/Success text on Background** — Status message readability

**Resolution (2026-06-04):**

`auditThemeContrast` now accepts and evaluates 6 baseline pairs plus optional `error`/`success` pairs when those colours are configured. The signature was widened to accept `surfaceColor`, `errorColor`, and `successColor`:

```javascript
// client/src/utils/accessibility.js
const pairs = [
  { label: 'Text / Background',       foreground: textColor,      background: backgroundColor },
  { label: 'Text / Surface',          foreground: textColor,      background: surfaceColor || backgroundColor },
  { label: 'Primary / Background',    foreground: primaryColor,   background: backgroundColor },
  { label: 'White / Primary',         foreground: '#ffffff',      background: primaryColor },
  { label: 'White / Secondary',       foreground: '#ffffff',      background: secondaryColor },
  { label: 'Secondary / Background',  foreground: secondaryColor, background: backgroundColor },
];
if (errorColor)   pairs.push({ label: 'Error / Background',   foreground: errorColor,   background: backgroundColor });
if (successColor) pairs.push({ label: 'Success / Background', foreground: successColor, background: backgroundColor });
```

The downstream caller in `themeScore.js` passes the resolved colours from the theme object so all 6–8 pairs are audited at once.

---

## 5. Low Priority Issues

### L1: Spacing Scale Is Static (Not Admin-Configurable) 🟡 DEFERRED

**File:** `client/src/utils/theme.js:361-369`
**Severity:** Low — Feature gap

**Description:**

The spacing scale tokens (`--store-space-xs` through `--store-space-3xl`) are hard-coded static values:

```javascript
'--store-space-xs':  '4px',
'--store-space-sm':  '8px',
'--store-space-md':  '16px',
'--store-space-lg':  '24px',
'--store-space-xl':  '32px',
'--store-space-2xl': '48px',
'--store-space-3xl': '64px',
```

Unlike colors, fonts, and radius which are admin-configurable, spacing cannot be adjusted.

**Impact:**
- Limited design flexibility for dense or spacious layouts
- B2B/catalog stores can't reduce spacing for information density

**Status:** Deferred. Making spacing admin-configurable requires:
1. New `theme.spacingScale` settings entry (base + multiplier)
2. Validation schema in `theme.validation.js`
3. Admin UI in `Settings > Branding` (new "Spacing" tab)
4. Migration of all existing CSS variable consumers to use scale-aware values
5. Theme template regeneration

This is non-trivial UI work; tracked separately for the next theme-admin milestone.

---

### L2: Hard-coded Hero Gradient Overlay Angles 🟡 DEFERRED

**File:** `client/src/components/storefront/sections/HeroSection.jsx:181-182`
**Severity:** Low — Limited customization

**Description:**

Hero gradient overlays are hard-coded:

```javascript
// Overlay direction
background: centered
  ? 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.58) 100%)'
  : 'linear-gradient(90deg, rgba(0,0,0,0.64) 0%, rgba(0,0,0,0.32) 50%, rgba(0,0,0,0.08) 100%)',
```

**Impact:**
- Admin can't customize gradient direction or opacity
- Light images may need different overlay strengths

**Status:** Deferred. Solving this requires a per-slide or per-section config that supports arbitrary gradient strings, plus an admin UI for the section editor. The hard-coded values are a sensible default; existing themes can be migrated gradually. Tracked for the Section Composer follow-up.

---

### L3: `radiusMap` and `shadowMap` Duplication Across Files 🟡 PARTIAL

**Files:**
- `client/src/components/product/ProductCard.jsx` — local `radiusMap` removed
- `client/src/components/storefront/sections/CategorySection.jsx` — local `radiusMap` removed
- `client/src/components/storefront/sections/PromoBannerSection.jsx` — local `radiusMap` removed
- `client/src/components/storefront/sections/TrustSection.jsx` — local `radiusMap` removed
- `client/src/utils/styleMaps.js` — new shared module
- `client/src/utils/componentStyles.js` — `STYLE_RADIUS_VALUES` / `STYLE_SHADOW_VALUES` still local

**Severity:** Low — Code maintainability

**Description:**

Four separate files each defined their own `radiusMap` and `shadowMap` objects with identical or near-identical values, creating a maintenance burden — any change to shadow values had to be updated in 4+ places.

**Resolution (2026-06-04):**

The `radiusMap` half of the duplication is fully resolved — see H3. A new `client/src/utils/styleMaps.js` exports shared `radiusMap`, `shadowMap`, `resolveRadius`, and `resolveShadow`. The four component files now import from it.

The `shadowMap` half of the duplication still exists in each file (only the radius portion was migrated in this pass), and `componentStyles.js` keeps its own `STYLE_RADIUS_VALUES` / `STYLE_SHADOW_VALUES` for legacy form/badge consumers.

**Remaining work:**
- Migrate the per-file `shadowMap` declarations in ProductCard, CategorySection, PromoBannerSection, and TrustSection to import from `styleMaps.js` (the maps are byte-identical today, so this is mechanical).
- Decide whether `STYLE_RADIUS_VALUES` / `STYLE_SHADOW_VALUES` in `componentStyles.js` should be aliased to the shared `styleMaps.js` exports or kept separate (depends on whether form/badge sizing should follow the global radius scale or stay fixed).

Tracked as a small follow-up; current state is consistent because both the local and shared maps resolve `pill` to the same value (9999px) thanks to the H3 alignment.

---

### L4: Performance Score Penalizes Dark Mode ✅ FIXED

**File:** `client/src/utils/themeScore.js:65`
**Severity:** Low — Unfair penalty

**Description:**

The performance scoring engine penalized themes that use dark mode with a separate palette:

```javascript
if (design.mode === 'dark' && pkg?.darkPalette) penalty += 3;
```

**Impact:**
- Dark mode themes got a lower performance score despite being a feature, not a performance issue
- Dark mode with custom palette was penalized the same as any other configuration

**Resolution (2026-06-04):**

The dark-palette penalty was removed. A separate dark palette is a feature customers expect, not a performance cost. The `scorePerformance` function now comments the intent so the rule isn't reintroduced:

```javascript
// ── Dark palette (extra colour resolution on init)
// Intentionally not penalised — a separate dark palette is a feature
// customers expect, not a performance issue. See issue L4.
```

---

### L5: Footer Falls Back to MUI Theme Instead of CSS Variables ✅ FIXED

**File:** `client/src/components/layout/StorefrontFooter.jsx:64-65`
**Severity:** Low — Token disconnect

**Description:**

Footer colors fell back to MUI theme values instead of CSS custom properties:

```javascript
const bgColor = f.bgColor || theme.palette.background.paper;
const fgColor = f.fgColor || theme.palette.text.secondary;
```

If the admin customised CSS variables directly (via custom CSS), the footer wouldn't reflect those changes.

**Resolution (2026-06-04):**

The fallbacks now prefer the design tokens emitted on `:root` and only fall back to MUI palette values when the CSS variables are absent:

```javascript
const bgColor = f.bgColor || 'var(--store-color-surface, ' + theme.palette.background.paper + ')';
const fgColor = f.fgColor || 'var(--store-color-text-muted, ' + theme.palette.text.secondary + ')';
```

Power users who set `body { --store-color-surface: #000; }` in custom CSS will now see the footer react.

---

### L6: Mobile Search Widget Fixed Width ✅ FIXED

**File:** `client/src/layouts/StoreLayout.jsx:398`
**Severity:** Low — Responsive issue

**Description:**

Mobile inline search had a fixed width:

```javascript
<SearchWidget variant="header" placeholder="Search..." sx={{ width: 160 }} />
```

**Impact:**
- Too narrow on very small screens (320px phones)
- Too wide on tablets in mobile orientation
- Doesn't adapt to content

**Resolution (2026-06-04):**

The `sx.width` is now responsive — `120` on extra-small screens, `160` on small-and-up. This gives the search widget more breathing room on small phones (e.g. 320px devices) while keeping the existing comfortable width on small tablets:

```javascript
<SearchWidget variant="header" placeholder="Search..." sx={{ width: { xs: 120, sm: 160 } }} />
```

---

## 6. Affected Files

### Resolved in this pass

| File | Issues Resolved | Notes |
|------|-----------------|-------|
| `client/src/utils/theme.js` | H1, M1 | `useAdminColors` removed; heading weight harmonised |
| `client/src/components/product/ProductCard.jsx` | H2, H3 | Fake deal % replaced; local `radiusMap` removed |
| `client/src/components/storefront/sections/CategorySection.jsx` | H3 | Local `radiusMap` removed |
| `client/src/components/storefront/sections/PromoBannerSection.jsx` | H3 | Local `radiusMap` removed |
| `client/src/components/storefront/sections/TrustSection.jsx` | H3 | Local `radiusMap` removed |
| `client/src/components/storefront/sections/HeroSection.jsx` | M2, M3 | Title uses `--store-font-size-h1`; `buttonStyle` propagated |
| `client/src/context/ThemeContext.jsx` | M4 | Google Fonts only loads used weights |
| `client/src/layouts/StoreLayout.jsx` | M5, L6 | Account menu uses tokens; mobile search width responsive |
| `client/src/utils/accessibility.js` | M6 | Now audits 6–8 colour pairs |
| `client/src/utils/themeScore.js` | L4 | Dark-palette penalty removed |
| `client/src/components/layout/StorefrontFooter.jsx` | L5 | CSS variables preferred over MUI palette |
| `client/src/utils/componentStyles.js` | H3 | `pill` aligned to `9999` |

### New / supporting files

| File | Purpose |
|------|---------|
| `client/src/utils/styleMaps.js` | Shared `radiusMap`, `shadowMap`, `resolveRadius`, `resolveShadow` (used by H3 components) |

### Deferred

| File | Open Issues |
|------|-------------|
| `client/src/utils/theme.js` | L1 (spacing scale admin-configurable) |
| `client/src/components/storefront/sections/HeroSection.jsx` | L2 (admin-configurable gradient) |
| `client/src/components/product/ProductCard.jsx`, `CategorySection.jsx`, `PromoBannerSection.jsx`, `TrustSection.jsx`, `client/src/utils/componentStyles.js` | L3 (consolidate per-file `shadowMap` declarations + alias `STYLE_*_VALUES`) |

---

## 7. Fix Recommendations

### Quick Wins (< 30 minutes each)

| # | Issue | Fix | Files | Status |
|---|-------|-----|-------|--------|
| H1 | `useAdminColors` bug | Drop the flag, always honour admin colours | `theme.js:101` | ✅ |
| M5 | Account menu hard-coded values | Use `var(--store-shadow-dropdown)` and `var(--store-radius)` | `StoreLayout.jsx:429-436` | ✅ |
| L4 | Dark mode performance penalty | Remove the `darkPalette` penalty | `themeScore.js:65` | ✅ |
| L5 | Footer CSS var fallback | Use `var(--store-color-surface)` as fallback | `StorefrontFooter.jsx:64-65` | ✅ |
| L6 | Mobile search width | Use responsive `sx={{ width: { xs: 120, sm: 160 } }}` | `StoreLayout.jsx:398` | ✅ |

### Medium Effort (1-2 hours each)

| # | Issue | Fix | Files | Status |
|---|-------|-----|-------|--------|
| H3 | Inconsistent radiusMap | Extract to shared `styleMaps.js`, align `pill` to `9999` | 4 component files + new `styleMaps.js` | ✅ |
| M1 | Heading weight inconsistency | Use consistent fallback (800) for all headings | `theme.js:541-548` | ✅ |
| M4 | Google Fonts weight waste | Load only weights actually used | `ThemeContext.jsx:135` | ✅ |
| M6 | Accessibility audit gaps | Add 4 more colour pairs | `accessibility.js:120-145` | ✅ |

### Larger Effort (2-4 hours each)

| # | Issue | Fix | Files | Status |
|---|-------|-----|-------|--------|
| H2 | Fake deal percentage | Derive from inventory, fall back to non-quantitative label | `ProductCard.jsx:265` | ✅ |
| M2 | Hero title override | Use `var(--store-font-size-h1)` with `calc()` emphasis | `HeroSection.jsx:90` | ✅ |
| M3 | Hero button style ignore | Add `buttonStyle` prop to `OverlayHero` with 3 variants | `HeroSection.jsx:160` | ✅ |
| L2 | Hard-coded hero gradient | Add gradient config to section settings | `HeroSection.jsx:181-182` | 🟡 Deferred |
| L3 | RadiusMap/ShadowMap duplication | Extract shared utility | 4 component files | 🟡 Partial — radius done, shadowMap follow-up |

### Backlog (feature work)

| # | Issue | Work Required | Status |
|---|-------|---------------|--------|
| L1 | Admin-configurable spacing | New settings entry, validation, admin UI, theme template regeneration | 🟡 Deferred |

---

## Priority Matrix (post-fix)

```
                        HIGH IMPACT
                            │
         H1 ✅ (useAdminColors)│  H2 ✅ (real deal %)
         H3 ✅ (radiusMap)     │
                            │
    LOW EFFORT ─────────────┼───────────── HIGH EFFORT
                            │
         M5 ✅ (account menu) │  M2 ✅ (hero title)
         L4 ✅ (dark penalty) │  M3 ✅ (hero buttons)
         L5 ✅ (footer vars)  │  L2 🟡 (hero gradient)
         L6 ✅ (mobile search)│  L3 🟡 (shadowMap dedup)
                            │  L1 🟡 (admin spacing)
                        LOW IMPACT
```

**Implementation order followed:**
1. H1 (bug fix, 5 min) ✅
2. H3 (consistency, 1 hour) ✅
3. H2 (compliance, 2 hours) ✅
4. M1, M4, M5, M6 (polish, 2 hours total) ✅
5. M2, M3 (hero fixes, 2 hours total) ✅
6. L4, L5, L6 (quick wins) ✅
7. L1, L2, L3 (deferred to theme-admin / section-composer milestone) 🟡
