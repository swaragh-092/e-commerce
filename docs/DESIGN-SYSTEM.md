# Design System — Complete Reference

> Last updated: 2026-06-04
> Status: Production-grade config-first theme system with 130+ CSS custom properties
> Latest pass: Resolved 12 of 15 issues tracked in `docs/DESIGN-SYSTEM-ISSUES.md`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Design Tokens](#3-design-tokens)
4. [Typography System](#4-typography-system)
5. [Color System](#5-color-system)
6. [Dark Mode](#6-dark-mode)
7. [Shape & Shadows](#7-shape--shadows)
8. [Component Styles](#8-component-styles)
9. [Layout Tokens](#9-layout-tokens)
10. [Storefront Sections](#10-storefront-sections)
11. [Component Reference](#11-component-reference)
12. [Admin Configuration](#12-admin-configuration)
13. [Custom CSS Guide](#13-custom-css-guide)
14. [Performance & Accessibility](#14-performance--accessibility)
15. [File Reference](#15-file-reference)

---

## 1. Overview

This platform uses a **config-first, CSS-variable-driven design system** built on MUI (Material-UI) v5/v7 with Emotion. There are zero traditional CSS files — all styling is done via:

1. **MUI `sx` prop** — inline component styles
2. **MUI `createTheme()`** — global theme configuration
3. **CSS Custom Properties** — 130+ `--store-*` design tokens emitted to `:root`
4. **Critical CSS injection** — above-the-fold performance optimization

The system is fully admin-configurable at runtime through a JSON settings store, with 12 built-in theme templates and a complete template marketplace system.

### Key Principles

- **Single source of truth** — Settings table drives all visual output
- **No executable code in themes** — Templates are pure JSON configuration
- **Runtime resolution** — Colors, fonts, and styles resolve at page load, not build time
- **Token hierarchy** — Brand → Semantic → Component → State tokens
- **Dark mode first-class** — Separate dark palette with customer toggle

---

## 2. Architecture

### Data Flow

```
Admin Settings (DB/JSON)
    │
    ▼
SettingsContext (ThemeContext.jsx)
    │
    ├──► resolveStorefrontThemeState()  →  Resolved colors, mode, style options
    │
    ├──► buildStorefrontTheme()         →  MUI createTheme() config
    │       │
    │       ▼
    │   ThemeProvider (MUI)
    │       │
    │       ▼
    │   All components via sx prop / theme.palette.*
    │
    ├──► buildStorefrontCssVariables()  →  130+ CSS custom properties
    │       │
    │       ▼
    │   document.documentElement.style.setProperty()
    │
    └─► useComponentStyles(name)       →  Per-component tokens (11 types)
```

### Resolution Order (Dark Mode)

```
1. Customer localStorage toggle ('customerDarkMode')
2. Admin-configured mode (settings.theme.mode)
3. Browser prefers-color-scheme media query
4. Default: 'light'
```

### Key Files

| File | Lines | Role |
|------|-------|------|
| `client/src/utils/theme.js` | ~665 | Core theme engine: `resolveStorefrontThemeState()`, `buildStorefrontTheme()`, `buildStorefrontCssVariables()`, `buildCriticalThemeCss()` |
| `client/src/context/ThemeContext.jsx` | ~335 | Settings provider, dark mode toggle, CSS variable injection, Google Fonts loading (weight-aware), custom CSS/scripts injection |
| `client/src/utils/componentStyles.js` | 158 | 11 component style defaults, radius/shadow resolver utilities |
| `client/src/utils/styleMaps.js` | ~50 | Shared `radiusMap` / `shadowMap` + `resolveRadius` / `resolveShadow` used by every storefront section (H3) |
| `client/src/utils/themeScore.js` | 135 | Performance and accessibility scoring engine |
| `client/src/utils/accessibility.js` | ~165 | WCAG 2.1 contrast ratio calculations, 6–8 pair audit |
| `client/src/utils/sectionPresets.js` | 202 | Section preset gallery and defaults |
| `config/default.json` | 493 | Master default configuration |
| `server/src/modules/theme/builtin/*.theme.json` | ~400 each | 12 built-in theme templates |

---

## 3. Design Tokens

### Token Categories

All tokens are emitted as CSS custom properties on `:root` and can be used in custom CSS via `var(--store-*)`.

#### Brand Colors (9 tokens)

| Token | Default (Light) | Default (Dark) | Description |
|-------|-----------------|----------------|-------------|
| `--store-color-primary` | `#0f766e` | `#4fd1a5` | Primary brand color |
| `--store-color-secondary` | `#f97316` | `#ffb86b` | Secondary accent color |
| `--store-color-background` | `#f7f3ec` | `#101514` | Page background |
| `--store-color-surface` | `#fffaf2` | `#17211f` | Card/surface background |
| `--store-color-text` | `#1f2933` | `#f8fafc` | Primary text color |
| `--store-color-text-muted` | `#64748b` | `#cbd5e1` | Secondary/muted text |
| `--store-color-text-disabled` | `#94a3b8` | `#475569` | Disabled text |
| `--store-color-divider` | `rgba(15,118,110,0.14)` | `rgba(148,163,184,0.18)` | Divider/border color |
| `--store-color-border` | same as divider | same as divider | Semantic alias for divider |

#### Derived Colors (7 tokens)

| Token | Description |
|-------|-------------|
| `--store-color-primary-dark` | Darker shade of primary |
| `--store-color-primary-light` | Lighter tint of primary |
| `--store-color-on-primary` | Text color on primary background (always `#ffffff`) |
| `--store-color-secondary-dark` | Darker shade of secondary |
| `--store-color-secondary-light` | Lighter tint of secondary |
| `--store-color-on-secondary` | Text color on secondary background |
| `--store-color-on-surface` | Text color on surface (same as text) |

#### Semantic Colors (4 tokens)

| Token | Default | Description |
|-------|---------|-------------|
| `--store-color-error` | `#e11d48` | Error/danger state |
| `--store-color-warning` | `#d97706` | Warning state |
| `--store-color-success` | `#059669` | Success state |
| `--store-color-info` | `#0284c7` | Information state |

#### Interaction State Tokens (6 tokens)

| Token | Description |
|-------|-------------|
| `--store-color-primary-hover` | Primary color on hover |
| `--store-color-primary-active` | Primary color on active/press |
| `--store-color-surface-hover` | Surface background on hover |
| `--store-color-surface-active` | Surface background on active |
| `--store-color-overlay` | Overlay backdrop (light: 32%, dark: 56%) |
| `--store-color-scrim` | Modal scrim (light: 48%, dark: 72%) |

#### Shape/Radius Tokens (11 tokens)

| Token | Derivation | Description |
|-------|------------|-------------|
| `--store-radius-sm` | `max(globalRadius - 4, 2)px` | Small radius |
| `--store-radius-md` | `{globalRadius}px` | Medium radius (alias) |
| `--store-radius` | `{globalRadius}px` | Base radius |
| `--store-radius-lg` | `{globalRadius + 4}px` | Large radius (alias) |
| `--store-radius-card` | Per-component resolved | Product card radius |
| `--store-radius-xl` | `{globalRadius + 8}px` | Extra large radius |
| `--store-radius-full` | `9999px` | Pill/circle radius |
| `--store-radius-button` | Configured by buttonStyle | Button radius |
| `--store-radius-input` | Per-component resolved | Input field radius |
| `--store-radius-chip` | Per-component resolved | Chip/badge radius |
| `--store-radius-badge` | Per-component resolved | Badge radius |

**Resolution logic** (`theme.js:125-139`):

```
'none'    → '0px'
'small'   → max(globalRadius - 4, 2)px
'medium'  → globalRadius px
'large'   → globalRadius + 4 px
'pill'    → '9999px'
'full'    → '9999px'
numeric   → {value}px
string    → used as-is
default   → globalRadius + offset px
```

#### Shadow Tokens (8 tokens)

| Token | Light Mode | Dark Mode |
|-------|------------|-----------|
| `--store-shadow-card` | Per-component resolved | Per-component resolved |
| `--store-shadow-soft` | `0 4px 14px rgba(15,23,42,0.08)` | `0 12px 28px rgba(0,0,0,0.20)` |
| `--store-shadow-medium` | `0 10px 28px rgba(15,23,42,0.12)` | `0 18px 38px rgba(0,0,0,0.26)` |
| `--store-shadow-strong` | `0 18px 44px rgba(15,23,42,0.18)` | `0 24px 56px rgba(0,0,0,0.34)` |
| `--store-shadow-hover` | `0 12px 28px rgba(15,23,42,0.13)` | `0 18px 40px rgba(0,0,0,0.30)` |
| `--store-shadow-dropdown` | `0 12px 32px rgba(31,41,51,0.12)` | `0 12px 32px rgba(0,0,0,0.28)` |
| `--store-shadow-none` | `none` | `none` |
| `--store-focus-ring` | `0 0 0 3px color-mix(in srgb, {primary} 18%, transparent)` | Same |

**Shadow resolution** (`theme.js:141-166`):

```
'none'   → 'none'
'soft'   → light or dark variant
'medium' → light or dark variant
'strong' → light or dark variant
default  → cardStyle fallback (elevated → shadow, flat → none)
```

#### Typography Tokens (13 tokens)

| Token | Description |
|-------|-------------|
| `--store-font-body` | Body font family stack |
| `--store-font-heading` | Heading font family stack |
| `--store-font-weight-body` | Body font weight (default: 400) |
| `--store-font-weight-heading` | Heading font weight (default: 700) |
| `--store-font-weight-bold` | Bold weight (always 700) |
| `--store-font-variation` | Variable font axes settings |
| `--store-type-scale` | Active scale preset name |
| `--store-font-size-h1` through `--store-font-size-h6` | Heading sizes |
| `--store-font-size-body` | Body text size |
| `--store-font-size-small` | Small text size |
| `--store-line-height` | Base line height |
| `--store-line-height-tight` | Tight line height (1.25) |
| `--store-line-height-relaxed` | Relaxed line height (1.75) |
| `--store-line-height-h1` through `--store-line-height-h6` | Per-heading line heights |
| `--store-letter-spacing` | Body letter spacing |
| `--store-heading-letter-spacing` | Heading letter spacing |
| `--store-letter-spacing-tight` | Tight spacing (-0.02em) |
| `--store-letter-spacing-wide` | Wide spacing (0.04em) |

#### Spacing Tokens (7 tokens, static)

| Token | Value |
|-------|-------|
| `--store-space-xs` | `4px` |
| `--store-space-sm` | `8px` |
| `--store-space-md` | `16px` |
| `--store-space-lg` | `24px` |
| `--store-space-xl` | `32px` |
| `--store-space-2xl` | `48px` |
| `--store-space-3xl` | `64px` |

#### Transition Tokens (6 tokens, static)

| Token | Value |
|-------|-------|
| `--store-transition-fast` | `150ms cubic-bezier(0.4, 0, 0.2, 1)` |
| `--store-transition-normal` | `250ms cubic-bezier(0.4, 0, 0.2, 1)` |
| `--store-transition-slow` | `350ms cubic-bezier(0.4, 0, 0.2, 1)` |
| `--store-ease-in` | `cubic-bezier(0.4, 0, 1, 1)` |
| `--store-ease-out` | `cubic-bezier(0, 0, 0.2, 1)` |
| `--store-ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` |

#### Z-Index Tokens (6 tokens, static)

| Token | Value |
|-------|-------|
| `--store-z-dropdown` | `1000` |
| `--store-z-sticky` | `1020` |
| `--store-z-fixed` | `1030` |
| `--store-z-modal` | `1050` |
| `--store-z-popover` | `1060` |
| `--store-z-tooltip` | `1070` |

#### Container/Layout Tokens (6 tokens, static)

| Token | Value |
|-------|-------|
| `--store-container-sm` | `600px` |
| `--store-container-md` | `960px` |
| `--store-container-lg` | `1280px` |
| `--store-container-xl` | `1440px` |
| `--store-header-height` | `64px` |
| `--store-footer-min-height` | `200px` |

#### Component Tokens (14 tokens)

| Token | Description |
|-------|-------------|
| `--store-button-radius` | Button border radius |
| `--store-button-padding-x` | Button horizontal padding (20px) |
| `--store-button-padding-y` | Button vertical padding (10px) |
| `--store-button-height` | Button height (40px) |
| `--store-card-radius` | Card border radius |
| `--store-card-padding` | Card padding (16px) |
| `--store-input-radius` | Input field radius |
| `--store-input-height` | Input field height (40px) |
| `--store-chip-radius` | Chip border radius |
| `--store-chip-height` | Chip height (28px) |
| `--store-badge-radius` | Badge border radius |
| `--store-avatar-radius` | Avatar border radius (50%) |

#### Component-Specific Hierarchy Tokens (12 tokens)

| Token | Description |
|-------|-------------|
| `--component-product-card-radius` | Product card radius |
| `--component-product-card-shadow` | Product card shadow |
| `--component-category-card-radius` | Category card radius |
| `--component-category-card-shadow` | Category card shadow |
| `--component-promo-card-radius` | Promo card radius |
| `--component-promo-card-shadow` | Promo card shadow |
| `--component-brand-card-radius` | Brand card radius |
| `--component-brand-card-shadow` | Brand card shadow |
| `--component-trust-card-radius` | Trust card radius |
| `--component-trust-card-shadow` | Trust card shadow |
| `--component-review-card-radius` | Review card radius |
| `--component-content-card-radius` | Content card radius |

#### Style Flag Tokens (3 tokens)

| Token | Values | Description |
|-------|--------|-------------|
| `--store-style-background` | `softGradient` \| `solid` | Background rendering mode |
| `--store-style-button` | `solid` \| `soft` \| `outline` \| `pill` | Button style variant |
| `--store-style-card` | `elevated` \| `flat` \| `bordered` | Card style variant |

#### Mobile Override Tokens (5 tokens)

| Token | Description |
|-------|-------------|
| `--store-mobile-color-primary` | Mobile-specific primary color |
| `--store-mobile-color-background` | Mobile-specific background |
| `--store-mobile-color-surface` | Mobile-specific surface |
| `--store-mobile-color-text` | Mobile-specific text color |
| `--store-mobile-body-font-size` | Mobile body font size |
| `--store-mobile-heading-scale` | Mobile heading scale factor (default: 0.88) |
| `--store-mobile-section-padding` | Mobile section padding (default: 32px) |
| `--store-mobile-container-padding` | Mobile container padding (default: 16px) |

---

## 4. Typography System

### Scale Presets

6 built-in typography scales with fluid `clamp()` support:

| Preset | H1 Range | H2 Range | Body | Best For |
|--------|----------|----------|------|----------|
| `compact` | 1.9–2.8rem | 1.6–2.25rem | 0.95rem | Dense catalogs, B2B |
| `default` | 2–3.25rem | 1.7–2.5rem | 1rem | General retail |
| `editorial` | 2.35–4.75rem | 1.95–3.4rem | 1.05rem | Fashion, luxury |
| `display` | 2.6–5.5rem | 2.1–4rem | 1rem | Bold hero-driven |
| `goldenRatio` | 2.5–4.5rem | 1.9–3.25rem | 1.05rem | Balanced hierarchy |
| `minorThird` | 2.2–4rem | 1.85–3.1rem | 1rem | Musical proportion |

### Fluid Typography

Each preset includes `fluid` variants using CSS `clamp()`:

```css
/* Example: editorial h1 */
h1 { font-size: clamp(2.35rem, 7vw, 4.75rem); }
```

**Viewport range:** 320px (min) to 1280px (max), configurable via `typographyScale.fluidConfig`.

### Custom Fluid Typography

Admins can set `typographyScale.preset: 'custom'` and define:
- `typographyScale.h1Min` / `typographyScale.h1Max` — custom clamp range
- `typographyScale.minVw` / `typographyScale.maxVw` — custom viewport range
- Per-heading overrides (h1Min/h1Max, h2Min/h2Max, etc.)

### Font Stacks

```
Body:    "CustomFont", "Roboto", "Helvetica", "Arial", sans-serif
Heading: "CustomFont", "Roboto", sans-serif
```

**Custom font loading:**
- Google Fonts: Dynamically loaded via `<link>` tag
- Custom upload: `@font-face` injected via MUI CssBaseline
- Variable font axes: Supported via `fontVariationSettings`

### Font Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `fontFamily` | string | `Inter` | Body font family |
| `headingFont` | string | `Inter` | Heading font family |
| `headingWeight` | string | `700` | Heading font weight |
| `bodyWeight` | string | `400` | Body font weight |
| `lineHeight` | string | `1.5` | Base line height |
| `letterSpacing` | string | `0px` | Body letter spacing |
| `headingLetterSpacing` | string | `0px` | Heading letter spacing |
| `customFonts.bodyUrl` | string | — | Custom body font URL (woff2) |
| `customFonts.headingUrl` | string | — | Custom heading font URL |
| `customFonts.bodyFamily` | string | — | Custom body font name |
| `customFonts.headingFamily` | string | — | Custom heading font name |
| `variableFontAxes` | object | — | Variable font axis config |

---

## 5. Color System

### Color Derivation

The theme engine derives several color scales from the admin-configured primary/secondary:

```
Primary (#0f766e):
  ├── primaryDark:   #0b4f49  (darker shade)
  ├── primaryLight:  #ccfbf1  (lighter tint)
  ├── primaryHover:  #0d6b63  (interaction state)
  └── primaryActive: #094844  (interaction state)

Secondary (#f97316):
  ├── secondaryDark:  #c2410c
  ├── secondaryLight: #fed7aa
  ├── onSecondary:    #ffffff (light) / #1f2933 (dark)

Text:
  ├── textMuted:    #64748b (light) / #cbd5e1 (dark)
  └── textDisabled: #94a3b8 (light) / #475569 (dark)
```

### Background Styles

| Style | Rendering |
|-------|-----------|
| `softGradient` | `linear-gradient(180deg, bg 0%, surface 48%, bg 100%)` |
| `solid` | Solid `backgroundColor` |

### Button Styles

| Style | Primary Button | Secondary Button |
|-------|----------------|------------------|
| `solid` | Gradient fill, white text | Outlined, primary text |
| `soft` | Transparent + 22% primary bg | Same |
| `outline` | Transparent + primary border | Same |
| `pill` | Rounded (9999px) gradient | Same |

### Card Styles

| Style | Rendering |
|-------|-----------|
| `elevated` | Shadow + subtle border |
| `flat` | No shadow, transparent border |
| `bordered` | No shadow, visible border |

---

## 6. Dark Mode

### Three-Tier Resolution

```javascript
// ThemeContext.jsx:29-34
const customerDarkMode = localStorage.getItem('customerDarkMode');
// → 'dark', 'light', or null (follows system/admin)

const themeMode = customerDarkMode || settings.theme.mode || prefersDark ? 'dark' : 'light';
```

### Dark Palette Override

Admins can configure a separate `darkPalette` with different colors for dark mode:

```json
{
  "darkPalette": {
    "primaryColor": "#4fd1a5",
    "secondaryColor": "#ffb86b",
    "backgroundColor": "#101514",
    "surfaceColor": "#17211f",
    "textColor": "#f8fafc",
    "errorColor": "#fb7185",
    "warningColor": "#fbbf24",
    "successColor": "#34d399",
    "infoColor": "#38bdf8"
  }
}
```

### Dark Mode Toggle

```javascript
// Customer-facing toggle
const { isDark, toggleDarkMode } = useCustomerTheme();

// In component
<Button onClick={toggleDarkMode}>
  {isDark ? 'Light Mode' : 'Dark Mode'}
</Button>
```

### Mobile Overrides

Separate mobile-specific colors applied via `@media (max-width: 600px)`:

```css
@media (max-width: 600px) {
  :root {
    --store-color-primary: var(--store-mobile-color-primary) !important;
    --store-color-background: var(--store-mobile-color-background) !important;
    --store-color-surface: var(--store-mobile-color-surface) !important;
    --store-color-text: var(--store-mobile-color-text) !important;
  }
}
```

---

## 7. Shape & Shadows

### Border Radius System

The global `borderRadius` setting (default: 8px) generates a full radius scale:

```
globalRadius = 8px

--store-radius-sm:    4px   (8 - 4)
--store-radius-md:    8px   (global)
--store-radius-lg:    12px  (8 + 4)
--store-radius-xl:    16px  (8 + 8)
--store-radius-full:  9999px
```

### Per-Component Radius

Each component type resolves its own radius independently:

```javascript
// componentStyles.js
productCard.radius:  'medium'  → 8px
categoryCard.radius: 'medium'  → 8px
promoCard.radius:    'large'   → 12px
brandCard.radius:    'medium'  → 8px
trustCard.radius:    'medium'  → 8px
reviewCard.radius:   'large'   → 12px
```

### Shadow System

Three shadow levels plus contextual shadows:

| Level | Light Mode | Dark Mode |
|-------|------------|-----------|
| Soft | `0 4px 14px rgba(15,23,42,0.08)` | `0 12px 28px rgba(0,0,0,0.20)` |
| Medium | `0 10px 28px rgba(15,23,42,0.12)` | `0 18px 38px rgba(0,0,0,0.26)` |
| Strong | `0 18px 44px rgba(15,23,42,0.18)` | `0 24px 56px rgba(0,0,0,0.34)` |
| Hover | `0 12px 28px rgba(15,23,42,0.13)` | `0 18px 40px rgba(0,0,0,0.30)` |
| Card (elevated) | `0 18px 45px rgba(31,41,51,0.08)` | `0 18px 45px rgba(0,0,0,0.22)` |

---

## 8. Component Styles

### Supported Components (11 types)

| Component | Key Properties | Variants |
|-----------|---------------|----------|
| `productCard` | variant, imageRatio, imageFit, showBrand, showCategory, showRating, showWishlist, showSaleCountdown, priceStyle, badgeStyle, badgePosition, hoverEffect, radius, shadow, density | classic, minimal, editorial, deal, marketplace |
| `categoryCard` | variant, imageRatio, imageFit, titlePlacement, showSubtitle, showProductCount, hoverEffect, radius, shadow, density | image-tile, icon-grid, compact-chips |
| `promoCard` | variant, imagePlacement, titleSize, ctaStyle, radius, shadow | split-image, asymmetric, cards, banner-stack |
| `brandCard` | variant, imageRatio, hoverEffect, radius, shadow | logo-card |
| `trustCard` | variant, titleSize, radius, shadow | icon-row, card-grid |
| `reviewCard` | variant, showRating, radius, shadow | quote-card |
| `contentCard` | variant, imageRatio, titleSize, hoverEffect, radius, shadow | editorial |
| `cartItem` | variant, imageRatio, radius, shadow, density, showVariantPill, hoverEffect | standard |
| `checkoutBlock` | variant, radius, shadow, density, headerStyle, ctaStyle | boxed |
| `formControl` | variant, radius, density, fill, focusStyle, labelStyle | outlined, filled |
| `badgeChip` | variant, radius, size, weight, textTransform, letterSpacing | soft, outline |

### Component Style Defaults

```javascript
// componentStyles.js:1-99
COMPONENT_STYLE_DEFAULTS = {
  productCard: {
    variant: 'classic',
    imageRatio: '4/3',
    imageFit: 'cover',
    showBrand: true,
    showCategory: true,
    showRating: true,
    showWishlist: true,
    showSaleCountdown: true,
    priceStyle: 'bold',
    badgeStyle: 'pill',
    badgePosition: 'top-right',
    hoverEffect: 'lift',
    radius: 'medium',
    shadow: 'soft',
    density: 'comfortable',
  },
  // ... 10 more component types
};
```

### Accessing Component Styles

```javascript
import { useComponentStyles } from '../hooks/useSettings';

const ProductCard = () => {
  const productCardStyle = useComponentStyles('productCard');
  
  // productCardStyle.variant, .imageRatio, .hoverEffect, etc.
};
```

---

## 9. Layout Tokens

### Header Styles

| Style | Rendering | Text Color |
|-------|-----------|------------|
| `gradient` | `linear-gradient(135deg, primary.dark, primary.main 58%, secondary.dark)` | White |
| `solid` | `primary.main` solid fill | White |
| `glass` | `background.paper + e8 opacity + blur(14px)` | Text color |

### Breakpoints

```javascript
// theme.js:553-560
breakpoints: {
  values: {
    xs: 0,
    sm: 600,
    md: 960,
    lg: 1280,
    xl: 1920,
  },
}
```

### Container Widths

| Token | Value |
|-------|-------|
| `--store-container-sm` | 600px |
| `--store-container-md` | 960px |
| `--store-container-lg` | 1280px |
| `--store-container-xl` | 1440px |

---

## 10. Storefront Sections

### Section Types (33 total)

| Family | Section Type | Variants |
|--------|-------------|----------|
| **Hero** | `hero-carousel` | overlay, split, split-editorial, centered, full-bleed, product-spotlight |
| **Merchandising** | `product-row` | carousel, grid, grid-compact |
| | `category-shortcuts` | image-tiles, icon-grid, compact-chips |
| | `featured-collection-grid` | image-tiles, icon-grid, compact-chips |
| | `brand-showcase` | — |
| | `recently-viewed` | — |
| **Trust** | `value-props` | icon-row, card-grid |
| | `trust-badges` | icon-row, card-grid |
| | `testimonials` | cards, quote-wall, carousel |
| | `faq` | — |
| **Conversion** | `newsletter-signup` | banner, inline-form |
| **Campaign** | `countdown-sale` | bar, card |
| | `promo-banners` | cards, banner-stack, asymmetric |
| **Content** | `editorial-image-text` | image-left, image-right, overlap-card |
| | `logo-cloud` | — |

### Section Data Flow

```
Settings (homepage.sections)
    │
    ▼
SectionRenderer (type → component)
    │
    ▼
Section Component (HeroSection, ProductRowSection, etc.)
    │
    ├── mode="live"  → real data from API
    └── mode="preview" → mock/real data from admin
```

### Lazy Loading

Sections below the fold are lazy-loaded via `IntersectionObserver`:

```javascript
// SectionRenderer.jsx:28-57
const LazySectionGate = ({ enabled, minHeight, rootMargin = '720px 0px', children }) => {
  // IntersectionObserver with 720px rootMargin
  // Shows Skeleton placeholder until section enters viewport
};
```

---

## 11. Component Reference

### ProductCard

**File:** `client/src/components/product/ProductCard.jsx`

**5 Variants:**
- `classic` — Standard card with all elements
- `minimal` — No shadow, border only
- `editorial` — Taller image ratio
- `deal` — Sale badge + claim progress bar
- `marketplace` — Add-to-cart button in actions

**Key Features:**
- `prefers-reduced-motion` support
- Configurable image ratio, hover effect, badge position
- Sale countdown, discount badges
- Wishlist button integration
- Dynamic price formatting

**Usage:**
```jsx
<ProductCard product={product} compact={false} fromCategory="shoes" />
```

### HeroSection

**File:** `client/src/components/storefront/sections/HeroSection.jsx`

**5 Variants:**
- `overlay` — Full-width background with gradient overlay
- `split` — Image + text side by side
- `split-editorial` — Same as split, editorial feel
- `centered` — Centered text over darkened background
- `product-spotlight` — Split with floating product badge card

**Key Features:**
- Auto-rotation with configurable interval
- Screen reader announcements (`aria-live="polite"`)
- Primary + secondary CTAs
- Eyebrow chip with icon

**Usage:**
```jsx
<HeroSection 
  section={{ variant: 'split-editorial', autoPlay: true, interval: 6500 }}
  slides={heroSlides}
  mode="live"
/>
```

### CategorySection

**File:** `client/src/components/storefront/sections/CategorySection.jsx`

**3 Variants:**
- `image-tiles` — Grid of image cards
- `icon-grid` — Compact icon-based grid
- `compact-chips` — Horizontal scrolling chips

**Key Features:**
- Overlay title placement support
- Product count display
- Configurable image ratio and hover effects

### StorefrontFooter

**File:** `client/src/components/layout/StorefrontFooter.jsx`

**Features:**
- Dynamic menu support (fetches from MenuService)
- Social links with proper accessibility
- Configurable columns based on content presence
- Copyright year auto-update

---

## 12. Admin Configuration

### Settings Groups (21 total)

| Group | Keys | Purpose |
|-------|------|---------|
| `theme` | 18 | Colors, fonts, weights, radius, styles |
| `componentStyles` | 11 | Product/category/promo/brand/trust/review/content cards + cart/checkout/form/badge |
| `nav` | 2 | Sticky, category bar |
| `footer` | 6+ | Colors, links, social, contact |
| `announcement` | 5 | Text, link, colors, dismiss |
| `homepage` | 4+ | Sections, hero, value props, promos |
| `catalog` | 5+ | Layout, grid, filters, sorting |
| `productPage` | 6+ | Layout, SKU, badges, buttons |
| `general` | 6 | Store name, currency, locale |
| `seo` | 7+ | Meta, OG, analytics |
| `advanced` | 4 | Custom CSS, head/body scripts |

### Theme Application Scopes

When applying a template, admins can select which scopes to apply:

| Scope | Settings Groups |
|-------|----------------|
| `design` | theme |
| `layoutStyle` | nav, footer, announcement |
| `homepageSections` | homepage |
| `demoContent` | announcement, homepage |
| `pageTemplates` | productPage, catalog |
| `componentStyles` | componentStyles |
| `dataSources` | api_definitions table |
| `sectionPresets` | sectionPresets |

### Admin UI Locations

| Feature | Route | Permission |
|---------|-------|------------|
| Theme Gallery | `/admin/themes` | SETTINGS_READ |
| Store Designer | `/admin/store-designer` | SETTINGS_MANAGE |
| Section Composer | `/admin/sections` | SETTINGS_MANAGE |
| Design Tokens Editor | Settings > Branding | SETTINGS_READ |
| Contrast Panel | Settings > Branding | SETTINGS_READ |

---

## 13. Custom CSS Guide

### Using Design Tokens

Admins can inject custom CSS via Settings > Advanced > Custom CSS:

```css
/* Brand color on custom element */
.custom-banner {
  background-color: var(--store-color-primary);
  color: var(--store-color-on-primary);
  border-radius: var(--store-radius-card);
  padding: var(--store-space-lg);
  box-shadow: var(--store-shadow-soft);
}

/* Hover states */
.custom-link {
  color: var(--store-color-primary);
  transition: color var(--store-transition-fast);
}
.custom-link:hover {
  color: var(--store-color-primary-hover);
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .custom-element {
    border-color: var(--store-color-divider);
  }
}

/* Mobile adjustments */
@media (max-width: 600px) {
  .custom-section {
    padding: var(--store-mobile-section-padding);
  }
}
```

### Available Token Categories

```css
/* Colors */
var(--store-color-primary)         /* Brand primary */
var(--store-color-secondary)       /* Brand secondary */
var(--store-color-background)      /* Page background */
var(--store-color-surface)         /* Card/surface background */
var(--store-color-text)            /* Primary text */
var(--store-color-text-muted)      /* Secondary text */
var(--store-color-error)           /* Error state */
var(--store-color-success)         /* Success state */
var(--store-color-warning)         /* Warning state */
var(--store-color-info)            /* Info state */

/* Interaction */
var(--store-color-primary-hover)   /* Primary on hover */
var(--store-color-primary-active)  /* Primary on active */
var(--store-color-surface-hover)   /* Surface on hover */
var(--store-focus-ring)            /* Focus ring */

/* Shape */
var(--store-radius)                /* Base radius */
var(--store-radius-sm)             /* Small radius */
var(--store-radius-lg)             /* Large radius */
var(--store-radius-full)           /* Pill/circle */

/* Shadows */
var(--store-shadow-soft)           /* Soft shadow */
var(--store-shadow-medium)         /* Medium shadow */
var(--store-shadow-strong)         /* Strong shadow */
var(--store-shadow-hover)          /* Hover shadow */

/* Typography */
var(--store-font-body)             /* Body font stack */
var(--store-font-heading)          /* Heading font stack */
var(--store-font-size-h1)          /* H1 size */
var(--store-font-size-body)        /* Body size */

/* Spacing */
var(--store-space-xs)              /* 4px */
var(--store-space-sm)              /* 8px */
var(--store-space-md)              /* 16px */
var(--store-space-lg)              /* 24px */
var(--store-space-xl)              /* 32px */

/* Transitions */
var(--store-transition-fast)       /* 150ms */
var(--store-transition-normal)     /* 250ms */
var(--store-transition-slow)       /* 350ms */

/* Z-index */
var(--store-z-modal)               /* 1050 */
var(--store-z-dropdown)            /* 1000 */
var(--store-z-tooltip)             /* 1070 */
```

### Component-Specific Tokens

```css
/* Product cards */
var(--component-product-card-radius)
var(--component-product-card-shadow)

/* Category cards */
var(--component-category-card-radius)
var(--component-category-card-shadow)

/* Promo cards */
var(--component-promo-card-radius)
var(--component-promo-card-shadow)

/* Trust cards */
var(--component-trust-card-radius)
var(--component-trust-card-shadow)
```

---

## 14. Performance & Accessibility

### Performance Scoring (`themeScore.js`)

The scoring engine evaluates themes on:

| Factor | Penalty | Rationale |
|--------|---------|-----------|
| Extra fonts (>1) | 8pt per font | Extra network requests + CLS risk |
| Custom CSS >5000 chars | 15pt | Style recalc time |
| Custom CSS >2000 chars | 8pt | Moderate impact |
| Extra sections (>4) | 4pt each (max 20) | More DOM, more LCP candidates |
| Data sources (>0) | 5pt each (max 15) | Extra async fetches |
| Component overrides (>5) | 5pt | Heavier MUI theme merge |
| Dark palette | 3pt | Extra color resolution |

**Score Labels:**
- 90-100: Fast (green)
- 75-89: Good (green)
- 55-74: Fair (yellow)
- 0-54: Heavy (red)

### Accessibility Scoring (`accessibility.js`)

WCAG 2.1 contrast ratio evaluation for 4 critical color pairs:

| Pair | Foreground | Background |
|------|------------|------------|
| Text / Background | `--store-color-text` | `--store-color-background` |
| Primary / Background | `--store-color-primary` | `--store-color-background` |
| White / Primary | `#ffffff` | `--store-color-primary` |
| Secondary / Background | `--store-color-secondary` | `--store-color-background` |

**WCAG Thresholds:**
- AA Normal: 4.5:1
- AA Large: 3.0:1
- AAA Normal: 7.0:1
- AAA Large: 4.5:1

**Score Calculation:**
```javascript
weights = { AAA: 100, AA: 75, 'AA Large': 40, Fail: 0, 'N/A': 0 };
score = sum(pair scores) / pair count;
```

### Critical CSS Injection

For above-the-fold performance, a minimal CSS block is injected into `<head>`:

```css
:root {
  --store-color-primary: #0f766e;
  --store-color-background: #f7f3ec;
  --store-color-surface: #fffaf2;
  --store-color-text: #1f2933;
  --store-font-body: "Inter", "Roboto", sans-serif;
  --store-font-heading: "Inter", "Roboto", sans-serif;
  --store-font-size-h1: clamp(2rem, 5vw, 3.25rem);
  --store-font-size-body: 1rem;
  --store-radius: 8px;
}
body {
  margin: 0;
  background: var(--store-color-background);
  color: var(--store-color-text);
  font-family: var(--store-font-body);
  font-size: var(--store-font-size-body);
}
```

### Reduced Motion Support

Components respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
    animation: none !important;
  }
}
```

---

## 15. File Reference

### Core Theme Files

```
client/src/
├── context/ThemeContext.jsx              — Settings provider, dark mode, CSS injection
├── utils/
│   ├── theme.js                          — Core theme engine (661 lines)
│   ├── componentStyles.js                — Component style defaults (158 lines)
│   ├── themeScore.js                     — Performance/accessibility scoring (135 lines)
│   ├── accessibility.js                  — WCAG contrast calculations (153 lines)
│   └── sectionPresets.js                 — Section preset gallery (202 lines)
├── hooks/
│   └── useSettings.js                    — useSettings, useFeature, useComponentStyles
├── layouts/
│   ├── StoreLayout.jsx                   — Storefront layout (538 lines)
│   └── AdminLayout.jsx                   — Admin dashboard layout (709 lines)
├── components/
│   ├── product/
│   │   ├── ProductCard.jsx               — Product card (338 lines)
│   │   └── ProductRow.jsx                — Product grid/carousel
│   ├── layout/
│   │   ├── StorefrontFooter.jsx          — Footer (289 lines)
│   │   ├── CategoryNav.jsx               — Category navigation (92 lines)
│   │   └── DarkModeToggle.jsx            — Dark mode toggle
│   └── storefront/sections/
│       ├── sectionRegistry.js            — Section type definitions (166 lines)
│       ├── SectionRenderer.jsx           — Section type → component resolver (203 lines)
│       ├── HeroSection.jsx               — Hero carousel (344 lines)
│       ├── ProductRowSection.jsx         — Product rows (210 lines)
│       ├── CategorySection.jsx           — Category shortcuts (229 lines)
│       ├── PromoBannerSection.jsx        — Promo banners (165 lines)
│       ├── TrustSection.jsx              — Trust badges (146 lines)
│       ├── EditorialSection.jsx          — Editorial blocks (115 lines)
│       ├── NewsletterSection.jsx         — Newsletter signup
│       ├── CountdownSection.jsx          — Countdown timer
│       ├── ContentGridSection.jsx        — Testimonials/FAQ/logo-cloud
│       ├── BrandShowcaseSection.jsx      — Brand showcase
│       └── RecentlyViewedSection.jsx     — Recently viewed products
```

### Server-Side Theme Files

```
server/src/modules/theme/
├── theme.routes.js                       — API routes (11 endpoints)
├── theme.controller.js                   — HTTP adapter
├── theme.service.js                      — Core logic: validate, preview, apply, rollback
├── theme.validation.js                   — Joi schemas
├── themePackage.model.js                 — ThemePackage model
├── themeActivation.model.js              — ThemeActivation model
└── builtin/
    ├── premium-retail.theme.json         — General retail
    ├── clean-minimal.theme.json          — Minimalist
    ├── luxury-dark.theme.json            — Dark luxury
    ├── fashion-drop.theme.json           — Fashion
    ├── beauty-studio.theme.json          — Beauty
    ├── grocery-fresh.theme.json          — Grocery
    ├── tech-pro.theme.json               — Electronics
    ├── kids-play.theme.json              — Kids
    ├── artisan-craft.theme.json          — Handmade
    ├── sports-gear.theme.json            — Sports
    ├── bookstore-classic.theme.json      — Books
    └── b2b-catalog.theme.json            — B2B
```

### Configuration

```
config/
└── default.json                          — Master default configuration (493 lines)
```

---

## Quick Reference: Theme Settings Schema

```json
{
  "theme": {
    "primaryColor": "#0f766e",
    "secondaryColor": "#f97316",
    "backgroundColor": "#f7f3ec",
    "surfaceColor": "#FFFFFF",
    "textColor": "#1F2933",
    "fontFamily": "Inter",
    "headingFont": "Inter",
    "headingWeight": "700",
    "bodyWeight": "400",
    "lineHeight": "1.5",
    "letterSpacing": "0px",
    "headingLetterSpacing": "0px",
    "borderRadius": "8px",
    "mode": "light",
    "headerStyle": "glass",
    "buttonStyle": "solid",
    "cardStyle": "elevated",
    "backgroundStyle": "softGradient",
    "darkPalette": { "...optional dark mode overrides..." },
    "mobileOverrides": { "...optional mobile overrides..." },
    "typographyScale": { "preset": "default", "fluid": true },
    "customFonts": { "...optional custom font upload..." },
    "variableFontAxes": { "...optional variable font config..." }
  }
}
```
