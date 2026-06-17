# Theme System Competitor Gap Roadmap

> Status: planning document  
> Goal: move from "homepage templates with colors" to a real store design system where cards, pages, sections, and prebuilt themes are editable.

## 1. Current Problem

The current template system is much better than the first version, but the user-facing value is still limited in a few important areas:

- Product cards look mostly the same across themes.
- Category cards look mostly the same across themes.
- Brand, promo, trust, newsletter, and editorial cards are not fully configurable.
- Most editing power is concentrated on the homepage.
- Prebuilt themes can be installed, but not deeply edited as theme presets.
- Product, collection, search, sale, category, cart, checkout, account, and content pages do not all have equal template control.
- Admins need a real visual editing model, not only JSON-backed template installs.

Senior opinion: the right direction is not "more colors." The right direction is **component-level design control** plus **page-level layout control**.

For the admin UX problem specifically, see [Theme Editing UX Audit](./THEME-EDITOR-UX-AUDIT.md). The short version: editing must move into one visual Store Designer instead of being scattered across Theme Gallery, Settings, and Section Composer.

## 2. Product Direction

We should evolve from:

```text
Theme = colors + fonts + homepage sections
```

to:

```text
Theme = design tokens + component styles + page templates + section presets + content/data bindings
```

This keeps the platform safer and simpler than Shopify Liquid while still giving merchants a meaningful design system.

## 3. New Theme Package Capability Model

Add new optional capabilities:

```json
{
  "capabilities": {
    "design": true,
    "layoutStyle": true,
    "homepageSections": true,
    "demoContent": true,
    "pageTemplates": true,
    "dataSources": true,
    "componentStyles": true,
    "sectionPresets": true,
    "customCode": false
  }
}
```

## 4. Component Styles

Add a `componentStyles` object to the theme package.

Example:

```json
{
  "componentStyles": {
    "productCard": {
      "variant": "editorial",
      "imageRatio": "4/5",
      "imageFit": "cover",
      "showBrand": true,
      "showCategory": false,
      "showRating": true,
      "showWishlist": true,
      "priceStyle": "bold",
      "badgeStyle": "pill",
      "hoverEffect": "lift",
      "radius": "large",
      "shadow": "soft"
    },
    "categoryCard": {
      "variant": "image-tile",
      "imageRatio": "1/1",
      "titlePlacement": "overlay",
      "hoverEffect": "zoom",
      "radius": "large"
    },
    "promoCard": {
      "variant": "split-image",
      "titleSize": "large",
      "imagePlacement": "right",
      "ctaStyle": "text-link"
    }
  }
}
```

### Components To Support

| Component | Why It Matters |
| --- | --- |
| productCard | Main merchandising surface. Biggest visual impact after hero. |
| categoryCard | Shapes discovery experience. Important for marketplaces and grocery/catalog stores. |
| promoCard | Campaign feel. Helps themes look less identical. |
| brandCard | Needed for B2B, retail, electronics, beauty. |
| blogCard/contentCard | Needed for content-led stores and SEO pages. |
| trustCard | Needed for premium/B2B/high-ticket stores. |
| reviewCard/testimonialCard | Social proof layout. |

## 5. Product Card Variants

Recommended variants:

| Variant | Best For |
| --- | --- |
| `classic` | General retail |
| `compact` | B2B/catalog-heavy stores |
| `editorial` | Fashion/luxury/beauty |
| `marketplace` | Dense product browsing |
| `minimal` | Clean/minimal stores |
| `deal` | Sale and discount-heavy stores |

Editable fields:

- image ratio: `1/1`, `4/5`, `4/3`, `3/4`
- show/hide brand
- show/hide category
- show/hide rating
- show/hide wishlist
- show/hide sale countdown
- badge position
- hover effect
- border radius
- shadow level
- price typography
- quick action layout

## 6. Category Card Variants

Recommended variants:

| Variant | Best For |
| --- | --- |
| `image-tile` | Fashion, lifestyle, beauty |
| `icon-grid` | Electronics, services, B2B |
| `compact-chip` | Grocery, mobile-first stores |
| `overlay-title` | Premium discovery pages |
| `collection-card` | Large collection landing pages |

Editable fields:

- image ratio
- title position: below, overlay, centered
- subtitle visibility
- item count visibility
- hover effect
- radius
- shadow
- grid density

## 7. Page Templates Beyond Homepage

We need template control for all major storefront pages.

| Page | Required Controls |
| --- | --- |
| Homepage | already strong; continue improving sections |
| Product detail | gallery layout, info layout, tabs/accordion, sticky cart, trust blocks |
| Product listing | filter position, grid density, collection hero, sort position |
| Category page | category hero, subcategory display, SEO content block, product grid |
| Search page | empty state, filters, result layout |
| Sale page | campaign hero, countdown, deal card style |
| Brand page | brand hero, brand grid/card style |
| Blog/content pages | article card style, content layout |
| Cart | compact/full cart, upsells, trust messages |
| Checkout | mostly controlled/safe; allow branding and trust layout only |
| Account | order card style, dashboard layout |

## 8. Editable Prebuilt Themes

Prebuilt themes should not be a dead install.

After applying a theme, admin should be able to:

- edit component styles
- edit section variants
- edit page templates
- save the edited version as "My Theme"
- export the edited version
- compare edited version against original
- reset one section/component/page back to the original theme default

This means we need store-level "active theme draft" behavior.

## 9. Proposed Settings Groups

Use the existing settings system as the live source of truth.

Add groups:

```text
componentStyles
sectionPresets
pageTemplates
```

Example settings:

```text
componentStyles.productCard
componentStyles.categoryCard
componentStyles.promoCard
componentStyles.brandCard

sectionPresets.hero
sectionPresets.productRow
sectionPresets.categoryGrid

pageTemplates.home
pageTemplates.product
pageTemplates.collection
pageTemplates.category
pageTemplates.search
pageTemplates.sale
pageTemplates.brand
pageTemplates.cart
pageTemplates.account
```

## 10. Admin UI Needed

Add a new **Design Studio** or improve Theme Gallery into three editing layers:

1. **Theme**
   - colors
   - fonts
   - radius
   - shadows
   - buttons
   - global spacing

2. **Components**
   - product card editor
   - category card editor
   - promo card editor
   - brand card editor
   - trust card editor

3. **Pages**
   - homepage section composer
   - product page layout
   - collection/category layout
   - search/sale layout
   - cart/account layout

## 11. Implementation Phases

### Phase A — Component Style Tokens

Status: foundation implemented. Templates can now validate, preview, apply, export, store, and read `componentStyles`. Next substep is connecting the live storefront cards to those tokens.

Backend:

- [x] extend theme validation schema with `componentStyles`
- [x] apply/export `componentStyles` through settings
- [x] add default component style settings

Frontend:

- [x] create `componentStyles.js` defaults/helper
- [x] create `useComponentStyles(componentName)`
- [x] make `ProductCard` consume `componentStyles.productCard`
- [x] make `CategorySection` consume `componentStyles.categoryCard`

### Phase B — Product And Category Card Editor

Status: first admin editor implemented inside Settings → Branding as Storefront Card Styles. It saves `componentStyles.productCard` and `componentStyles.categoryCard` object tokens.

Admin:

- [x] create product card style editor controls
- [x] create category card style editor controls
- [x] add lightweight live preview mocks
- [x] controls for variant, image ratio, badges, rating, wishlist, shadow, radius
- [x] built-in templates ship distinct product/category card style profiles
- [x] install dialog applies `componentStyles` as a real scope
- [x] template preview uses scoped `componentStyles` so card designs display before install
- [x] promo, brand, and trust sections consume component style tokens
- [x] live `BrandStrip` consumes `brandCard` tokens
- [x] built-in templates include promo/brand/trust style profiles
- [x] admin editors for promo, brand, and trust card tokens
- [x] export/save dialogs can include or exclude component style tokens
- [x] replace preview mocks with real product/category data

Storefront:

- product card variants: classic, compact, editorial, marketplace, minimal, deal

### Phase C — Promo/Brand/Trust Card Editors

Status: completed.

Admin:

- [x] create promo card style controls
- [x] create brand card style controls
- [x] create trust/review card style controls
- [x] controls for variant, image ratio, title position, density, hover

Storefront:

- [x] category variants: image-tile, icon-grid, compact-chip, overlay-title, collection-card

### Phase D — Page Template Expansion

Status: completed. Product, collection, category, brand, cart, account, and blog/content page template settings now have defaults, admin controls, export/install mapping, and storefront consumption. Existing category/blog page settings are now returned by the settings API instead of being dead form fields.

Add real templates for:

- [x] product detail page layout controls
- [x] collection/product listing layout controls
- [x] category/blog settings groups registered in settings API
- [x] category page header/subcategory settings consumed by storefront
- [x] brand page templates connected to theme package pageTemplates
- [x] cart/account page templates
- [x] blog/content page storefront consumption

### Phase E — Editable Theme Drafts

Status: completed.

Add:

- [x] save edited prebuilt theme as custom theme
- [x] reset component/page/section to original theme
- [x] compare original vs edited
- [x] export edited package

### Phase F — Section Presets And Composer Upgrade

Status: completed. The section composer now uses shared smart presets, imported template presets can be applied through install/export scopes, existing sections can be reset to recommended defaults, and Add Section includes a preset gallery grouped by business goal.

Add:

- [x] shared `sectionPresets` utility for recommended section defaults
- [x] Add Section dialog creates meaningful sections instead of empty shells
- [x] Section Composer edit pane can apply a smart preset to the current section
- [x] imported `sectionPresets` are used by Add Section and Apply Smart Preset
- [x] package-level `sectionPresets` export/import/apply scope
- [x] preset gallery grouped by business goal: hero, conversion, trust, merchandising, content

## 12. Priority Recommendation

Do this order:

1. Product card style system
2. Category card style system
3. Component style persistence/export/import
4. Admin component style editors
5. Category/brand/cart/account page templates
6. Editable theme drafts

Reason: product and category cards appear everywhere. Improving them gives the highest visible return across homepage, listing pages, search, sale, category, and brand pages.

## 13. What This Gives Us Compared To Competitors

| Area | Current | After Roadmap |
| --- | --- | --- |
| Colors/fonts | Good | Good |
| Homepage sections | Good | Strong |
| Product cards | Weak/medium | Strong |
| Category cards | Medium | Strong |
| Page templates | Medium | Strong |
| Theme editing | Medium | Strong |
| Designer workflow | Import/export only | Edit, save, reset, export |
| Shopify comparison | simpler but limited | simpler, safer, more accessible |

## 14. Senior Opinion

Do not try to copy Shopify Liquid.

The better product for this platform is:

```text
Safe visual theme system + component style editor + page templates + API Builder data
```

That is easier for merchants, safer for SaaS, and still powerful enough to create meaningfully different stores.

