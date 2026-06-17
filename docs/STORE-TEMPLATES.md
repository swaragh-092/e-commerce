# Store Templates System — Architecture Document

> Last verified: 2026-05-29  
> Status: Fully implemented — all 11 phases complete (see Section 12)

---

## 1. System Overview

The Store Templates system allows admins to install full storefront blueprints that change design tokens, layout styling, homepage section order, demo content, page templates, and dynamic data sources — all through safe JSON configuration without custom code.

### Key Principles

- **Settings table is the live source of truth** — templates write to settings, they don't render directly.
- **No executable code** — packages cannot contain CSS, JS, or HTML injection.
- **Scoped installs** — admins choose what to apply (design, layout, sections, content, data sources, page templates).
- **Atomic writes** — all changes happen in a single DB transaction.
- **Rollback safety** — every install creates a before/after snapshot for one-click restore.
- **API Builder integration** — templates can create safe, restricted public data endpoints for dynamic product/category sections.

---

## 2. File Map

### Backend

```
server/src/modules/theme/
├── theme.routes.js              # Express routes (auth + permission gates)
├── theme.controller.js          # HTTP adapter (no business logic)
├── theme.service.js             # Core logic: validate, preview, apply, rollback, export, import
├── theme.validation.js          # Joi schemas for package format + API requests
├── themePackage.model.js        # Sequelize model: saved/imported template library
├── themeActivation.model.js     # Sequelize model: install history with snapshots
└── builtin/                     # 12 built-in .theme.json packages
    ├── premium-retail.theme.json
    ├── clean-minimal.theme.json
    ├── luxury-dark.theme.json
    ├── fashion-drop.theme.json
    ├── beauty-studio.theme.json
    ├── grocery-fresh.theme.json
    ├── tech-pro.theme.json
    ├── kids-play.theme.json
    ├── artisan-craft.theme.json
    ├── sports-gear.theme.json
    ├── bookstore-classic.theme.json
    └── b2b-catalog.theme.json
```

### Frontend — Admin

```
client/src/pages/admin/ThemeGalleryPage.jsx              # Main Store Templates page
client/src/components/admin/themes/
├── ThemeCard.jsx                    # Template card with preview, badges, actions
├── ThemeDetailModal.jsx             # Full detail view with sections, palette, install
├── ThemePreviewModal.jsx            # Full-screen preview with device toggle + compare
├── StorefrontTemplatePreview.jsx    # Renders full storefront preview using shared sections
├── StorefrontPreview.jsx            # Legacy/simple preview (deprecated)
├── ThemeApplyDialog.jsx             # Install scope picker with smart defaults
├── ThemeImportDialog.jsx            # Import .theme.json with validation summary
└── ThemeHistoryPanel.jsx            # Activation history with rollback
```

### Frontend — Shared Section Components

```
client/src/components/storefront/sections/
├── sectionRegistry.js           # Section type constants, definitions, helpers
├── SectionFallback.jsx          # SectionFrame wrapper + UnsupportedSection fallback
├── HeroSection.jsx              # Hero carousel with variants (overlay, split, spotlight)
├── TrustSection.jsx             # Value props + trust badges
├── PromoBannerSection.jsx       # Promo banner grid
├── EditorialSection.jsx         # Image + text editorial blocks
├── ContentGridSection.jsx       # Testimonials, FAQ, logo-cloud
├── CategorySection.jsx          # Category shortcuts + featured collection grid
└── ProductRowSection.jsx        # Product rows (carousel/grid) with API Builder support
```

### Frontend — Live Storefront

```
client/src/pages/storefront/HomeExperience.jsx    # Live homepage renderer using shared sections
client/src/pages/storefront/ProductDetailPage.jsx # Consumes productPage.* template settings
client/src/pages/storefront/ProductListPage.jsx   # Consumes catalog.* template settings
client/src/pages/storefront/SearchResultsPage.jsx # Shares collection layout with ProductListPage
client/src/pages/storefront/SalePage.jsx          # Shares collection layout with ProductListPage
```

### Frontend — Services

```
client/src/services/themeService.js    # API client for all theme endpoints
client/src/utils/theme.js              # buildStorefrontTheme() — MUI theme builder from tokens
```

### Database Migrations

```
server/migrations/
├── 20260527100000-create-theme-packages-and-activations.js
├── 20260528120000-add-data-source-refs-to-theme-activations.js
└── 20260528130000-add-created-by-template-id-to-api-definitions.js
```

---

## 3. Database Schema

### theme_packages

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | |
| slug | VARCHAR(100) UNIQUE | Package identifier |
| name | VARCHAR(255) | Display name |
| version | VARCHAR(20) | Semver |
| author | VARCHAR(255) | |
| description | TEXT | |
| category | VARCHAR(50) | Industry category |
| tags | JSONB | Searchable tags array |
| preview_image | TEXT | URL to preview screenshot |
| package_data | JSONB | Full template package JSON |
| source | VARCHAR(20) | 'imported' or 'builtin' |
| created_by | UUID FK→users | |
| created_at, updated_at | TIMESTAMP | |

### theme_activations

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK) | |
| theme_package_id | UUID FK→theme_packages | Nullable (built-in may not be in library) |
| theme_name | VARCHAR(255) | Name at time of install |
| theme_version | VARCHAR(20) | Version at time of install |
| applied_scopes | JSONB | Array of scopes applied |
| before_snapshot | JSONB | Settings state before install |
| after_snapshot | JSONB | Settings state after install |
| data_source_refs | JSONB | Array of created API Builder refs |
| applied_by | UUID FK→users | |
| rolled_back_at | TIMESTAMP | Null until rolled back |
| rolled_back_by | UUID FK→users | |
| created_at | TIMESTAMP | |

### api_definitions (extended)

| Column | Type | Purpose |
|--------|------|---------|
| created_by_template_id | VARCHAR(255) | Template slug that owns this definition |

---

## 4. API Contract

| Method | Path | Permission | Purpose |
|--------|------|-----------|---------|
| GET | /api/themes/builtin | SETTINGS_READ | List 12 built-in templates |
| GET | /api/themes/library | SETTINGS_READ | List saved/imported templates |
| GET | /api/themes/activations | SETTINGS_READ | List install history (last 50) |
| GET | /api/themes/store-status | SETTINGS_READ | Check if store is empty (for smart defaults) |
| POST | /api/themes/validate | SETTINGS_READ | Validate a package JSON |
| POST | /api/themes/preview | SETTINGS_READ | Preview merged settings + change diff |
| POST | /api/themes/import | SETTINGS_MANAGE | Save validated package to library |
| POST | /api/themes/export | SETTINGS_READ | Export current store as template JSON |
| POST | /api/themes/apply | SETTINGS_MANAGE | Install template with selected scopes |
| POST | /api/themes/activations/:id/rollback | SETTINGS_MANAGE | Restore before-snapshot |
| DELETE | /api/themes/library/:id | SETTINGS_MANAGE | Delete imported template |

### Apply Request Shape

```json
{
  "packageData": { /* full template package */ },
  "scopes": ["design", "layoutStyle", "homepageSections", "dataSources", "pageTemplates"],
  "replaceDemoContent": false
}
```

### Apply Response

```json
{
  "success": true,
  "data": { "activationId": "uuid" },
  "message": "Theme applied successfully"
}
```

---

## 5. Package Schema (v3)

```
schemaVersion: 3
meta:
  slug, name, version, author, description, category, tags,
  previewImage, mobilePreviewImage, bestFor, platformCompatibility
capabilities:
  design, layoutStyle, homepageSections, demoContent, pageTemplates, dataSources, customCode(false)
design:
  theme: { mode, primaryColor, secondaryColor, backgroundColor, surfaceColor, textColor,
           fontFamily, headingFont, headingWeight, bodyWeight, lineHeight, letterSpacing,
           headingLetterSpacing, borderRadius, headerStyle, buttonStyle, cardStyle, backgroundStyle }
layout:
  nav: { sticky, showCategoryBar }
  footerStyle: { bgColor, fgColor }
  announcementStyle: { bgColor, fgColor, dismissible }
  homepageSections: [ { id, type, enabled, title, subtitle, source, dataSourceKey,
                        count, layout, viewAllLink, autoPlay, interval, variant, items, ... } ]
demoContent:
  announcementText, heroSlides[], valueProps[], promoBanners[]
dataSources:
  [ { key, type:"apiBuilder", definition: { name, slug, isActive, config: { responseMode, includeMeta, blocks[] } } } ]
pageTemplates:
  product: { layout, showTrustBadges, showRelatedProducts, showRecentlyViewed, showStickyAddToCart, showBreadcrumbs }
  collection: { layout, productsPerRow, filterLayout, showBreadcrumbs }
```

### Forbidden Fields (rejected by validation)

- customCSS, headScripts, bodyScripts

### Allowed Section Types

hero-carousel, value-props, category-shortcuts, promo-banners, product-row, brand-showcase, editorial-image-text, testimonials, logo-cloud, newsletter-signup, countdown-sale, featured-collection-grid, faq, trust-badges

### Allowed Product Sources

featured, sale, bestSellers, newest, recommended

---

## 6. Install Flow (theme.service.js → apply)

```
1. Validate package (Joi schema + data source security checks)
2. Determine affected settings groups from scopes
3. BEGIN TRANSACTION
4. Read before-snapshot from settings table
5. If dataSources scope: upsert template-owned API Builder definitions
   - Namespace slugs: template-{templateSlug}-{key}
   - Enforce resource/field/filter allowlists
   - Mark with createdByTemplateId
6. Build settings rows from package (design, layout, sections, demo, pageTemplates)
7. bulkUpdate settings via SettingsService
8. Read after-snapshot
9. Create ThemeActivation record with snapshots + dataSourceRefs
10. Write audit log
11. COMMIT
```

### Rollback Flow

```
1. Find activation by ID
2. Reject if already rolled back
3. BEGIN TRANSACTION
4. Write beforeSnapshot back into settings via bulkUpdate
5. Deactivate template-owned API definitions (if still owned)
6. Mark activation as rolled back
7. Write audit log
8. COMMIT
```

---

## 7. API Builder Security (Template Data Sources)

### Allowed Resources

products, categories, brands, productImages, tags, media, pages

### Blocked Resources

settings, menus, menuItems, productVariants, productAttributes, attributeTemplates, attributeValues, orders, users, payments, shipping, tax, credentials, analytics, admin

### Limits

- Max blocks per definition: 8
- Max relation depth: 2
- Max item limit per block: 50 (clamped)
- Max filters per block: 10
- Max relations per block: 12
- Max data sources per package: 12

### Ownership Tracking

- `createdByTemplateId` column on api_definitions
- Description prefix: `[template-data-source] template={slug} key={key}`
- Rollback deactivates (not deletes) template-owned definitions

---

## 8. Live Storefront Data Flow

### Homepage (HomeExperience.jsx)

```
1. Load settings via useHomepageSettings hook
2. Parse homepage.sections from settings
3. For each product-row section:
   a. If section.dataSourceSlug exists → fetch /api/api-builder/public/{slug}
      - 2000ms timeout
      - Circuit breaker: trips at 3 consecutive failures, 30s backoff
      - Fallback: returns empty array, never breaks page
   b. Else → fetch via getProducts() with source params
4. Render sections using SectionRenderer with normalized section data
5. Unknown sections → UnsupportedSection fallback (visible in dev, hidden in prod)
```

### Product Detail Page

Reads from settings:
- `productPage.templateLayout` → layout variant
- `productPage.showTrustBadges`
- `productPage.showRelatedProducts`
- `productPage.showRecentlyViewed`
- `productPage.showStickyAddToCart`
- `productPage.showBreadcrumbs`

### Collection/Search/Sale Pages

Reads from settings:
- `catalog.templateLayout` → layout variant
- `catalog.gridColumns` → products per row
- `catalog.filterLayout` → sidebar/drawer/topbar
- `catalog.showBreadcrumbs`

---

## 9. Section Registry Architecture

The section registry (`sectionRegistry.js`) is the shared contract between preview and live rendering.

### Exports

| Export | Purpose |
|--------|---------|
| SECTION_TYPES | Frozen enum of all section type strings |
| SECTION_DEFINITIONS | Type → { label, family, data, live, preview } |
| SECTION_LABELS | Type → human label |
| getSectionType(section) | Extract type string |
| isKnownSectionType(type) | Check if registered |
| getSectionLabel(type) | Get human label |
| isHeroSection(section) | Check if hero family |
| needsProductData(section) | Check if needs product fetch |
| needsCategoryData(section) | Check if needs category fetch |
| getSectionDefinition(type) | Get full definition object |
| getSectionSupportSummary(sections) | Aggregate live/preview/unknown counts |

### Section Families

| Family | Sections | Data Requirement |
|--------|----------|-----------------|
| hero | hero-carousel | content (slides) |
| trust | value-props, trust-badges | content |
| merchandising | category-shortcuts, product-row, brand-showcase, featured-collection-grid | products/categories/brands |
| campaign | promo-banners, countdown-sale | content |
| story | editorial-image-text | content |
| conversion | newsletter-signup | content |

---

## 10. Shared Section Components

All shared components accept `mode="live"` or `mode="preview"`.

| Component | Sections Served | Key Props |
|-----------|----------------|-----------|
| HeroSection | hero-carousel | section, slides, mode; variants: overlay, split, split-editorial, centered, full-bleed |
| TrustSection | value-props, trust-badges | section, items, mode; variants: icon-row, card-grid |
| PromoBannerSection | promo-banners | section, banners, mode; variants: cards, banner-stack, asymmetric |
| EditorialSection | editorial-image-text | section, mode; variants: image-left, image-right, overlap-card |
| ContentGridSection | testimonials, logo-cloud, faq | section, fallbackTitle, kind, mode |
| CategorySection | category-shortcuts, featured-collection-grid | section, categories, configuredTiles, loading, mode; variants: image-tiles, icon-grid, compact-chips |
| ProductRowSection | product-row | section, products, loading, count, pricingEnabled, mode; variants: carousel, grid, grid-compact with dense cards |
| NewsletterSection | newsletter-signup | section, mode; variants: banner, inline-form |
| CountdownSection | countdown-sale | section, mode |
| SectionRenderer | ALL (wrapper) | section, mode, data, index |

### Not Yet Extracted to Shared Components

| Section | Current Location | Status |
|---------|-----------------|--------|
| brand-showcase | BrandShowcaseSection.jsx | Shared live/preview contract; live delegates to BrandStrip, preview renders safe placeholders |

---

## 11. Preview System

### StorefrontTemplatePreview.jsx

- Uses `buildStorefrontTheme()` to create real MUI theme from package tokens
- Wraps in `ThemeProvider` for accurate rendering
- Renders: announcement bar → header → sections → footer
- Supports device modes: desktop (100%), tablet (768px), mobile (375px)
- Supports comparison mode: current settings side-by-side with template
- Uses same shared section components as live storefront
- Fetches real product, category, and brand data for preview sections where possible

### ThemePreviewModal.jsx

- Full-screen dialog (90vh)
- Device toggle (desktop/tablet/mobile)
- Compare switch (current vs template)
- Direct "Install Template" action from preview

---

## 12. Smart Install Defaults

The system detects store maturity via `/api/themes/store-status`:

```json
{ "isEmpty": true, "orderCount": 0, "productCount": 2 }
```

**Empty store** (0 orders, <5 products):
- Default scopes: design, layoutStyle, homepageSections, pageTemplates, dataSources
- replaceDemoContent: true
- Shows "launch-ready" messaging

**Existing store**:
- Default scopes: design, layoutStyle, homepageSections, pageTemplates, dataSources
- replaceDemoContent: false
- Shows warning before content replacement

**"Start Fresh" button**: Applies all scopes + replaceDemoContent in one click.

---

## 13. Export Behavior

Exports current store settings as a valid schema v3 package:

- design.theme from settings.theme.*
- layout.nav from settings.nav.*
- layout.footerStyle from settings.footer.{bgColor, fgColor}
- layout.announcementStyle from settings.announcement.{bgColor, fgColor}
- layout.homepageSections from settings.homepage.sections (strips dataSourceKey/Slug)
- pageTemplates.product from settings.productPage.*
- pageTemplates.collection from settings.catalog.*
- demoContent (optional) from settings.homepage.{heroSlides, valueProps, promoBanners} + announcement.text

Does NOT export: advanced settings, payment/shipping/tax config, credentials, feature toggles.

---

## 14. Built-in Templates (12)

| Template | Category | Sections | Data Sources | Page Templates |
|----------|----------|----------|--------------|----------------|
| Premium Retail | general | 8 | 1 (featured products) | product + collection |
| Clean Minimal | general | 7 | 1 | product + collection |
| Luxury Dark | luxury | 9 | 1 | product + collection |
| Fashion Drop | fashion | 9 | 1 (featured products) | product + collection |
| Beauty Studio | beauty | 9 | 1 | product + collection |
| Grocery Fresh | grocery | 9 | 1 | product + collection |
| Tech Pro | electronics | 9 | 1 | product + collection |
| Kids Play | kids | 9 | 1 | product + collection |
| Artisan Craft | handmade | 9 | 1 | product + collection |
| Sports Gear | sports | 9 | 1 | product + collection |
| Bookstore Classic | books | 9 | 1 | product + collection |
| B2B Catalog | b2b | 8 | 1 | product + collection |

Each template includes: design tokens, nav/footer/announcement styling, 7-9 homepage sections, 2 hero slides, 3-4 value props, 2 promo banners, 1 API Builder data source, product + collection page template settings.

---

## 15. Current Gaps (vs. Competitor Level)

| Gap | Impact | Spec Phase |
|-----|--------|-----------|
| No preview images for built-in templates (all null) | Cards look like color swatches | Future |
| No template composer (drag-and-drop sections) | Section Composer exists, full template composer is next | 10+ |
| No AI-assisted template generation | Missing differentiator | 11 |

---

## 16. Functional Sections

Homepage sections are not just visual — they have real functionality:

### Newsletter Signup (newsletter-signup)

- **Frontend**: Real email input with form submission
- **Backend**: `POST /api/newsletter/subscribe` (public, rate-limited 5/min)
- **Storage**: `newsletter_subscribers` table (email, status, source, timestamps)
- **Admin**: `GET /api/newsletter` (list subscribers, requires SETTINGS_READ)
- **Behavior**: Shows success/already-subscribed/error feedback inline

### Countdown Timer (countdown-sale)

- **Config**: Admin sets `section.endDate` (ISO date string) in Section Composer
- **Behavior**: Real live countdown updating every second (DD:HH:MM:SS)
- **Auto-hide**: Section disappears when timer expires (live mode)
- **Preview**: Shows static 00D 00H 00M 00S

### FAQ Accordion (faq)

- **Behavior**: Expandable accordion — click question to reveal answer
- **Single-expand**: Only one item open at a time
- **Content**: From `section.items` array (admin-curated via Section Composer)
- **Preview**: All items collapsed

### Recently Viewed (recently-viewed)

- **Storage**: localStorage (`recently_viewed_products` key)
- **Tracking**: `trackRecentlyViewed()` called from ProductDetailPage on product load
- **Capacity**: Stores last 12 products (id, name, slug, price, salePrice, image)
- **Rendering**: Carousel via ProductRow component
- **Hidden**: When no products have been viewed yet

### Testimonials (testimonials)

- **Content**: Admin-curated via `section.items` in templates/Section Composer
- **Fields**: title, text, author, role, image
- **Future**: Could pull from product reviews API

---

## 16. Section Builder Runtime (Phase 9)

The Section Builder adds **variants** and **block schemas** to the section system, making each section type render differently based on a `variant` field in the section config.

### Architecture

```
Section Registry (sectionRegistry.js)
  ├── SECTION_TYPES          — enum of all section type strings
  ├── SECTION_VARIANTS       — allowed variants per type
  ├── SECTION_BLOCK_SCHEMAS  — allowed block types per section
  ├── SECTION_DEFINITIONS    — metadata + defaultVariant per type
  └── Helper functions       — resolveSectionVariant(), getSectionVariants(), etc.

SectionRenderer (SectionRenderer.jsx)
  ├── Resolves type → component
  ├── Passes variant through section prop
  ├── Passes data (products, categories, slides, etc.)
  └── Wraps in SectionFrame + handles unknown types

Section Components (HeroSection, CategorySection, etc.)
  └── Read section.variant → render different layouts
```

### Supported Variants

| Section Type | Variants |
|-------------|----------|
| hero-carousel | overlay, split, split-editorial, centered, full-bleed |
| product-row | carousel, grid, grid-compact |
| category-shortcuts | icon-grid, image-tiles, compact-chips |
| promo-banners | cards, banner-stack, asymmetric |
| featured-collection-grid | image-tiles, icon-grid, compact-chips |
| editorial-image-text | image-left, image-right, overlap-card |
| testimonials | cards, quote-wall, carousel |
| value-props | icon-row, card-grid |
| trust-badges | icon-row, card-grid |
| newsletter-signup | banner, inline-form |
| countdown-sale | bar, card |

### How Variants Work

Templates specify `variant` in each section:

```json
{
  "id": "hero",
  "type": "hero-carousel",
  "variant": "split-editorial",
  "enabled": true
}
```

The section component reads `section.variant` and renders a different layout:
- `split-editorial` → image on one side, text on the other
- `centered` → centered text over darkened background
- `overlay` → left-aligned text over full-width image

### Block Schemas

Block schemas define what content blocks a section can contain (for future admin editing):

```json
{
  "hero-carousel": ["eyebrow", "heading", "text", "button", "secondary-button", "image"],
  "editorial-image-text": ["heading", "text", "button", "image"],
  "promo-banners": ["kicker", "heading", "text", "button"]
}
```

### SectionRenderer Component

Single entry point for rendering any section:

```jsx
<SectionRenderer
  section={section}        // { id, type, variant, enabled, title, ... }
  mode="live"              // or "preview"
  data={{ products, categories, slides, ... }}
  index={0}
/>
```

Used by:
- `StorefrontTemplatePreview` — admin preview (all sections via SectionRenderer)
- `HomeExperience` — live storefront (uses SectionRenderer with live data from buildSectionRendererData)

### Template Differentiation

With variants, two templates using the same section types look completely different:

| Template | Hero | Categories | Products | Promos |
|----------|------|-----------|----------|--------|
| Fashion Drop | split-editorial | image-tiles | carousel | asymmetric |
| Grocery Fresh | centered | compact-chips | grid | banner-stack |
| Tech Pro | overlay | icon-grid | grid | cards |
| B2B Catalog | centered | compact-chips | grid-compact | banner-stack |

---

## 17. Maturity Assessment

| Level | Name | Status |
|-------|------|--------|
| 1 | Color Preset | ✅ Done (Branding tab) |
| 2 | Theme (colors + header/footer) | ✅ Done |
| 3 | Store Template (homepage sections + demo content + data strategy) | ✅ Done |
| 4 | Page Template System (product/collection page layouts) | ✅ Done (real visual variants) |
| 5 | Section/Block Builder (variants + configurable sections) | ✅ Runtime done (Phase 9) |
| 6 | Section Composer (visual admin page) | ✅ Done (Phase 10) |

**Current level: 6** — Section composer UI provides drag-to-reorder, add/remove, variant selection, and save-to-template. — Section variants render different layouts per template. Admin composer UI (Phase 10) is complete.

---

## 18. Section Composer (Phase 10)

Admin page at `/admin/sections` that lets admins visually manage homepage sections without editing JSON.

### Features

- View all current homepage sections in a list
- Reorder sections (move up/down)
- Toggle sections on/off (enabled: true/false)
- Remove sections
- Edit section settings (title, subtitle, variant, count, source, viewAllLink, interval)
- Add new sections (pick type + variant from dropdown)
- Save changes to settings (writes to `homepage.sections`)
- Dirty state tracking (unsaved changes indicator)

### Files

| File | Purpose |
|------|---------|
| `client/src/pages/admin/SectionComposerPage.jsx` | Main page with section list |
| `client/src/components/admin/sections/SectionEditDialog.jsx` | Edit dialog for section settings |
| `client/src/components/admin/sections/AddSectionDialog.jsx` | Add new section dialog |

### Navigation

- Route: `/admin/sections`
- Sidebar: "Homepage Sections" (requires SETTINGS_MANAGE)

### Data Flow

```
1. Page loads → GET /api/settings/homepage → reads sections array
2. Admin edits (reorder, add, remove, toggle, edit settings)
3. Admin clicks Save → PUT /api/settings/bulk with [{ key: 'sections', value: [...], group: 'homepage' }]
4. Live storefront reads updated sections on next page load
```

---

## 17. Dependencies

### Backend Dependencies

- `server/src/modules/settings/settings.service.js` — bulkUpdate for atomic writes
- `server/src/modules/audit/audit.service.js` — audit logging
- `server/src/modules/apiBuilder/` — API Builder for template data sources
- `server/src/modules/index.js` — model registry (ThemePackage, ThemeActivation, ApiDefinition, Setting, Order, Product)

### Frontend Dependencies

- `client/src/utils/theme.js` — `buildStorefrontTheme()` for MUI theme creation
- `client/src/hooks/useHomepageSettings.js` — settings consumption for live storefront
- `client/src/hooks/useSettings.js` — general settings access
- `client/src/context/ThemeContext.jsx` — SettingsContext for preview comparison
- `client/src/services/api.js` — Axios instance for API calls

---

## 18. Security Model

### Package Validation

- Joi schema rejects unknown fields
- Explicitly forbidden: customCSS, headScripts, bodyScripts
- customCode capability must be `false`
- All URLs validated as HTTP/HTTPS
- All text fields length-capped
- Section types validated against allowlist
- Data source resources validated against allowlist

### Permission Gates

| Action | Required Permission |
|--------|-------------------|
| View/preview/export | SETTINGS_READ |
| Import/install/rollback/delete | SETTINGS_MANAGE |

### Data Source Security

- Resource allowlist (7 safe resources only)
- Field allowlist per resource
- Filter field allowlist per resource
- Sort field allowlist per resource
- Relation allowlist per resource
- Depth limit: 2
- Block limit: 8
- Item limit: 50
- No access to orders, users, payments, shipping, tax, credentials, analytics

---

## 19. Testing Checklist

To verify nothing is broken:

1. **Backend starts** — `cd server && npm run dev` (no import/syntax errors)
2. **Frontend builds** — `cd client && npm run build` (no compilation errors)
3. **GET /api/themes/builtin** — returns 12 templates
4. **GET /api/themes/store-status** — returns isEmpty boolean
5. **POST /api/themes/validate** — validates a built-in package
6. **POST /api/themes/preview** — returns mergedSettings + changes array
7. **POST /api/themes/apply** — creates activation, writes settings
8. **POST /api/themes/activations/:id/rollback** — restores before-snapshot
9. **POST /api/themes/export** — returns valid schema v3 package
10. **POST /api/themes/import** — saves to theme_packages table
11. **Live homepage** — renders sections from settings.homepage.sections
12. **Template preview** — renders all section types in StorefrontTemplatePreview
13. **Data source sections** — product-row with dataSourceSlug fetches from API Builder

---

## 20. Configuration

### Feature Flag

The theme system does not have its own feature flag — it's always available to users with SETTINGS_READ/SETTINGS_MANAGE permissions.

### Admin Navigation

- Route: `/admin/themes` (ThemeGalleryPage)
- Sidebar label: Currently "Theme Gallery" (spec says rename to "Store Templates")

### Settings Groups Written By Templates

| Scope | Settings Groups |
|-------|----------------|
| design | theme |
| layoutStyle | nav, footer, announcement |
| homepageSections | homepage |
| demoContent | announcement, homepage |
| pageTemplates | productPage, catalog |
| componentStyles | componentStyles |
| dataSources | (writes to api_definitions table, not settings) |

## Implementation Update: Shared Brand Showcase Section

Added `client/src/components/storefront/sections/BrandShowcaseSection.jsx`.

The `brand-showcase` section now uses one shared section contract instead of `BrandStrip` for live and `PreviewBrandShowcase` for admin preview.

Behavior:

- live mode delegates to the production `BrandStrip` component and receives real BrandContext data
- preview mode renders safe non-navigating brand placeholders
- `SectionRenderer` no longer needs the `brandRenderer` escape hatch
- `StorefrontTemplatePreview` no longer owns a custom brand renderer

This reduces one more preview/live mismatch and makes `SectionRenderer` closer to being the only section rendering entry point.

## Implementation Update: HomeExperience Uses SectionRenderer

`client/src/pages/storefront/HomeExperience.jsx` now uses the shared `SectionRenderer` for live homepage rendering.

Before this change, the admin template preview used `SectionRenderer`, but the live homepage still had a second local render map. That meant every section fix had to be wired twice.

Behavior after the change:

- live homepage and admin preview now share the same section type → component mapping
- `HomeExperience` is responsible only for resolving settings and fetching section data
- `SectionRenderer` is responsible for choosing the section component
- responsive hide flags still stay in the live homepage wrapper
- hero frame indexing is preserved
- product, category, and brand loading state is passed through section data

This is an important architecture milestone: template behavior now has one primary rendering path instead of separate live and preview render maps.

## Implementation Update: Shared Section Data Builder

Added `client/src/components/storefront/sections/sectionData.js`.

Both live homepage rendering and admin template preview now use `buildSectionRendererData()` to feed `SectionRenderer` the same data shape.

Used by:

- `client/src/pages/storefront/HomeExperience.jsx`
- `client/src/components/admin/themes/StorefrontTemplatePreview.jsx`

The helper normalizes:

- hero slides
- value props
- promo banners
- category tiles
- product rows by section id
- brands
- loading state
- pricing availability

This keeps `SectionRenderer` stable and avoids each caller inventing its own `data` object contract.



---

## 19. Hero Variants — Template Differentiation

Each built-in template uses a distinct hero variant, making the gallery feel meaningfully different:

| Template | Hero Variant | Visual Treatment |
|----------|-------------|-----------------|
| Clean Minimal | overlay | Full-bleed image, left-aligned text |
| Luxury Dark | overlay | Full-bleed dark image, left-aligned text |
| Sports Gear | overlay | Full-bleed action image, left text |
| Kids Play | overlay | Full-bleed playful image, left text |
| Artisan Craft | overlay | Full-bleed texture image, left text |
| Fashion Drop | split | Image + text side-by-side, rounded card |
| Grocery Fresh | split | Image + text side-by-side, clean layout |
| Beauty Studio | split | Image + text side-by-side, editorial |
| Bookstore Classic | split | Image + text side-by-side, literary |
| B2B Catalog | split | Image + text side-by-side, professional |
| Premium Retail | product-spotlight | Split with floating product badge card |
| Tech Pro | product-spotlight | Split with product specs overlay |

Variants are set via `"variant": "<value>"` in the hero section of each `.theme.json` file. The `HeroSection.jsx` shared component reads `section.variant` and dispatches to the appropriate renderer (OverlayHero, SplitHero, ProductSpotlightHero).

### All Supported Hero Variants
- **overlay** — Full-width background with gradient overlay and text (default)
- **split** — Image and text side by side in a contained card
- **split-editorial / editorial** — Same as split, editorial feel
- **product-spotlight / spotlight** — Split layout with floating product badge card over the image

## Implementation Update: Removed Legacy Section Renderer Factory

Removed `createSectionRenderer()` from `client/src/components/storefront/sections/sectionRegistry.js`.

Reason:

- `SectionRenderer.jsx` is now the only section type → component renderer entry point.
- `HomeExperience.jsx` and `StorefrontTemplatePreview.jsx` both use `SectionRenderer`.
- Keeping the old factory made it look like there were two supported render paths.

The registry now owns section metadata only: types, definitions, labels, data requirements, and variants.

## Implementation Update: Real Compact Product Rows

The `product-row` variant `grid-compact` now changes the actual product row rendering, not just metadata.

Updated files:

- `client/src/components/product/ProductRow.jsx`
- `client/src/components/product/ProductCard.jsx`
- `client/src/components/storefront/sections/ProductRowSection.jsx`

Behavior:

- `ProductRow` accepts `compact` and renders denser grid columns, smaller gaps, smaller skeletons, and tighter headers.
- `ProductCard` accepts `compact` and uses square imagery, smaller typography, tighter padding, hidden rating/timing details, and hidden wishlist actions.
- `ProductRowSection` maps `variant: "grid-compact"` to `ProductRow compact` in live mode.
- Admin preview placeholders also reflect compact density.

This makes B2B/catalog-heavy templates meaningfully different from campaign or fashion templates.

## Implementation Update: Real Editorial Section Variants

The `editorial-image-text` section now has real runtime variants.

Updated files:

- `client/src/components/storefront/sections/EditorialSection.jsx`
- selected `server/src/modules/theme/builtin/*.theme.json` templates

Supported variants:

- `image-right`: split editorial with image on the right
- `image-left`: split editorial with image on the left
- `overlap-card`: full editorial image with a floating copy card

Why this matters:

Editorial blocks are one of the fastest ways to make two store templates feel different. Fashion, luxury, beauty, books, and handmade templates can now use story-led layouts instead of repeating the same split section.

## Implementation Update: Real Trust Section Variants

The `value-props` and `trust-badges` variants now change runtime layout.

Updated files:

- `client/src/components/storefront/sections/TrustSection.jsx`
- `client/src/components/storefront/sections/SectionRenderer.jsx`
- selected `server/src/modules/theme/builtin/*.theme.json` templates

Supported variants:

- `icon-row`: compact horizontal icon + copy row
- `card-grid`: larger card-style trust blocks with stronger spacing and visual weight

This gives premium, B2B, tech, and artisan templates a stronger trust/proof section while keeping lightweight templates compact.

## Implementation Update: Real Newsletter Section Variants

The `newsletter-signup` section now supports real runtime variants.

Updated files:

- `client/src/components/storefront/sections/NewsletterSection.jsx`
- selected `server/src/modules/theme/builtin/*.theme.json` templates

Supported variants:

- `banner`: full-width high-emphasis conversion block
- `inline-form`: compact text + form row for minimal, catalog, and content-heavy templates

This keeps newsletter capture useful without forcing every template into the same large primary-colored banner.

## Next Roadmap

For the next competitor-level upgrade path, see [THEME-SYSTEM-COMPETITOR-GAP-ROADMAP.md](THEME-SYSTEM-COMPETITOR-GAP-ROADMAP.md). It covers editable product/category cards, component styles, page templates beyond homepage, editable prebuilt themes, and the recommended implementation phases.

## Section Preset Factory

Added `client/src/utils/sectionPresets.js`.

The Section Composer now creates useful default section configs instead of empty shells. Examples:

- Product rows default to featured products, carousel layout, count 8, and a `/products` view-all link.
- Category sections default to visual image tiles with sensible titles.
- Trust/value sections include starter proof points.
- Newsletter/countdown/editorial sections include CTA defaults.

`AddSectionDialog` uses `createDefaultSection()` when adding a section, and `SectionComposerPage` exposes **Apply Smart Preset** for resetting an existing section to recommended defaults while preserving its id and enabled state.

Template packages can now include a top-level `sectionPresets` object. Installing the `sectionPresets` scope writes those recipes to the `sectionPresets` settings group, export/save flows can include them, and the Section Composer uses installed presets when adding or resetting sections.

The Add Section dialog now includes a preset gallery grouped by business goal: Hero, Merchandising, Trust, Conversion, Content, and Campaign. Presets installed by a theme are marked with a **Theme** chip, so designers can quickly pick template-specific section recipes instead of starting from blank section configuration.

All 12 built-in templates now include validated `sectionPresets` derived from their own homepage recipes. This means each built-in template can influence the composer experience after installation, not only the initial homepage layout.

## Implementation Update: Preview Data Fidelity

`StorefrontTemplatePreview.jsx` now fetches live product/category/brand data for preview sections using the same section data contract as `HomeExperience.jsx`. Product rows also respect template-owned API Builder `dataSourceSlug` values where present.

This improves trust in preview because product rows, category grids, and brand sections are no longer placeholder-only. It is still not a full storefront iframe preview; the next larger upgrade would be a route-level preview session that renders the actual storefront route with temporary settings.
## Implementation Update: CSS Design Tokens

`client/src/utils/theme.js` now exposes `buildStorefrontCssVariables()`, and `ThemeContext.jsx` writes the resolved values to `document.documentElement`. `StorefrontTemplatePreview.jsx` also scopes those same variables onto the preview canvas, so template previews and before/after comparisons use the package tokens instead of inheriting the active storefront tokens.

Available first-layer variables include:

- `--store-color-primary`
- `--store-color-secondary`
- `--store-color-background`
- `--store-color-surface`
- `--store-color-text`
- `--store-color-text-muted`
- `--store-color-divider`
- `--store-radius`
- `--store-radius-card`
- `--store-radius-button`
- `--store-shadow-soft`
- `--store-shadow-medium`
- `--store-shadow-strong`
- `--store-shadow-hover`
- `--store-focus-ring`
- `--store-overlay-dark`
- `--store-font-body`
- `--store-font-heading`
- `--store-style-button`
- `--store-style-card`

Admins can use these in Advanced custom CSS, for example:

```css
.product-card-custom {
  border-color: var(--store-color-primary);
  border-radius: var(--store-radius-card);
}
```

Product cards, category cards, promo banners, and trust cards now consume the shared shadow/border/overlay tokens for core surfaces. The remaining design-token work is a deeper semantic/component token hierarchy and wider adoption across every storefront component.

