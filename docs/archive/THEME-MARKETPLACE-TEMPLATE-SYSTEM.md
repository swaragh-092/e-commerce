# Store Templates and Theme Marketplace System

> Status: upgraded product and technical direction  
> Last updated: 2026-05-29  
> Replaces: color-only Theme Gallery concept  
> Product decision: Theme Gallery must become Store Templates. Branding settings remain for fine tuning.

## 1. Executive Summary

The current Theme Gallery is too close to the existing Branding settings. It shows theme cards, color strips, import/export, and apply buttons, but the real effect is mostly color and token changes. That is not enough to compete with Shopify, Wix, Squarespace, or other modern commerce/site builders.

The upgraded feature should be a Store Template System:

- Settings > Branding is for small edits: colors, fonts, radius, dark mode, button style, card style.
- Store Templates is for full storefront transformation: design, layout, homepage sections, merchandising blocks, demo content, preview, install scopes, history, and rollback.
- Theme packages are not just color presets. They are safe, versioned storefront blueprints.

A real template should make a store feel like it chang
ed industry, strategy, and conversion flow in one action. Example: installing a Grocery template should not only turn buttons green. It should create a grocery-style homepage with category shortcuts, fresh deals, delivery value props, product rows, and appropriate banners.

## 2. Why The Current Gallery Feels Weak

Current state:

- Branding tab already has suggested custom themes.
- Theme Gallery also shows theme cards.
- Cards mostly communicate colors.
- Preview is a mock view, not a full storefront-level template preview.
- Applying a theme mainly updates theme and layout settings.
- Built-in themes are not enough in count or depth.

This creates duplication:

| Area | Current Role | Problem |
| --- | --- | --- |
| Branding tab | Edit colors and tokens | Correct place for this |
| Theme Gallery | Browse/apply themes | Too similar to Branding presets |
| Preview modal | Mock storefront | Does not show full homepage transformation |
| Built-in themes | 3 simple options | Not enough to feel like a marketplace |

Senior product call: if the gallery only applies colors, remove it. If the gallery applies full store templates, keep it and upgrade it heavily.

## 3. Competitor Benchmark

Competitors are not winning because they have color presets. They win because templates provide a complete starting point.

| Competitor | What Users Expect | Lesson For Us |
| --- | --- | --- |
| Shopify | Theme editor with sections, theme settings, templates, and app embeds | A theme is a structured storefront system, not just palette settings |
| Wix | Large template library with sample content, color themes, galleries, inner pages, and business features | Templates should make a new business look ready immediately |
| Squarespace | Preset templates and flexible design system/Blueprint style starting points | Templates should feel polished, curated, and easy to customize |

References:

- Shopify theme editor features: https://help.shopify.com/en/manual/online-store/themes/customizing-themes/theme-editor/features-overview
- Shopify theme templates and sections: https://help.shopify.com/en/manual/online-store/themes/theme-structure/page-types
- Wix templates overview: https://support.wix.com/en/article/about-templates
- Squarespace feature index/templates: https://www.squarespace.com/feature-index
- Squarespace getting started/templates and Blueprint: https://support.squarespace.com/hc/en-us/articles/206756327-getting-started-with-your-squarespace-website

## 4. Product Positioning

Rename the feature:

| Old Name | New Name | Reason |
| --- | --- | --- |
| Theme Gallery | Store Templates | Clearer and bigger than colors |
| Theme Package | Store Template Package | Better expresses layout and content |
| Apply Theme | Install Template | More accurate when layout/content can change |
| Suggested Custom Themes | Quick Brand Presets | Keeps color-only presets in Branding |

Navigation:

- Settings > General remains settings.
- Settings > Branding remains token editing.
- Settings > Store Templates becomes the marketplace/template page.
- Branding tab includes a CTA: Browse Store Templates.

## 5. Product Vision

Store Templates should let an admin launch a professional storefront in minutes.

A template must include:

1. Brand design
   - colors
   - typography
   - dark/light mode
   - button styles
   - card styles
   - border radius
   - background style
   - header style

2. Layout system
   - navigation behavior
   - category bar behavior
   - header variant
   - footer style
   - announcement bar style
   - homepage section order
   - product row layouts
   - category shortcut layouts

3. Merchandising strategy
   - section types
   - featured product rows
   - sale product rows
   - new arrival rows
   - best seller rows
   - category-led discovery
   - promo banner placement

4. Demo content
   - hero slides
   - promo banners
   - announcement copy
   - value propositions
   - placeholder imagery

5. Safety workflow
   - preview before install
   - install scopes
   - no custom code by default
   - activation history
   - rollback

## 6. Clear Separation: Branding vs Store Templates

### 6.1 Branding Settings

Purpose: edit the current live brand manually.

Use Branding for:

- Primary color
- Accent color
- Background color
- Surface color
- Text color
- Font family
- Heading font
- Dark mode
- Button style
- Card style
- Border radius

Branding should keep quick presets, but those presets should be small:

- Premium Retail
- Clean Minimal
- Luxury Dark

These are quick brand presets, not marketplace templates.

### 6.2 Store Templates

Purpose: install a complete storefront blueprint.

Use Store Templates for:

- Full homepage layout
- Full preview
- Industry-specific design
- Demo content
- Import/export
- Template library
- Installation history
- Rollback

The template page should answer: What kind of store do I want to launch?

The Branding page should answer: How do I fine tune my current brand?

## 7. Target User Experience

### 7.1 Store Templates Page

Page title: Store Templates

Primary actions:

- Import Template
- Export Current Store As Template
- Save Current Design

Tabs:

- Built-in Templates
- My Templates
- Installed History

Filters:

- All
- Fashion
- Electronics
- Grocery
- Beauty
- Luxury
- Kids
- Books
- Sports
- Handmade
- B2B
- Services

Search fields:

- name
- category
- tag
- industry
- mood
- layout type

Template card must show:

- Real preview screenshot or generated preview
- Industry category
- Template name
- Best for text
- Included sections count
- Mobile-ready badge
- Conversion pattern badge
- Preview button
- Install button

Bad card design:

- Color strips only
- No storefront preview
- No category meaning
- No business outcome

Good card design:

- Screenshot-like preview
- Best for fashion launches
- Includes hero, category grid, trending row, promo banners
- Design + layout + demo content

### 7.2 Preview Flow

Preview should be full screen and should feel like browsing a real store.

Preview modes:

- Desktop
- Tablet
- Mobile
- Current vs Template comparison
- Design only
- Design + Layout
- Full demo content

Preview must use the same theme builder as production:

- buildStorefrontTheme()
- same MUI ThemeProvider behavior
- same typography
- same dark mode logic
- same button/card/background styles

Preview must show:

- header
- announcement bar
- hero
- category shortcuts
- product rows
- promo banners
- value props
- footer

### 7.3 Install Flow

Install dialog:

Install Luxury Fashion

Options:

- Apply design: colors, fonts, buttons, cards
- Apply layout styling: nav, footer, announcement
- Apply homepage structure: section order and block types
- Replace demo content: hero slides, banners, announcement text

Defaults:

- Design: on
- Layout styling: on
- Homepage structure: off for existing stores, on for empty stores
- Demo content: off for existing stores, on for empty stores after confirmation

Warning for demo content:

This replaces current hero slides, promo banners, value props, and announcement text. Your previous content will be saved in activation history and can be restored.

## 8. Template Quality Bar

A built-in template is accepted only if it changes more than colors.

Minimum required package content:

- Complete design.theme object
- Nav style
- Footer style
- Announcement style
- Homepage sections array
- At least 2 hero slides in demoContent
- At least 3 value props
- At least 2 promo banners
- At least 3 product/category sections
- Mobile preview tested
- Accessibility contrast checked
- Rollback tested

Reject a built-in template if:

- It only changes colors
- It has no homepage strategy
- It has no industry-specific copy
- It has no mobile preview behavior
- It relies on custom CSS or JavaScript

## 9. Built-in Template Library Target

Phase 1 may keep 3 themes for technical validation. Competitor-level product requires 20 to 40 high-quality templates over time.

Initial 12 strong templates:

| Template | Category | Store Strategy |
| --- | --- | --- |
| Premium Retail | General | Balanced hero, featured categories, trending products |
| Clean Minimal | General | Product-first grid, low visual noise |
| Luxury Dark | Luxury | Editorial hero, premium cards, gold accents |
| Fashion Drop | Fashion | Campaign hero, new arrivals, lookbook banners |
| Beauty Studio | Beauty | Soft palette, routine bundles, trust/value props |
| Grocery Fresh | Grocery | Category shortcuts, delivery banner, weekly deals |
| Tech Pro | Electronics | Dark layout, specs-focused product rows, deal sections |
| Kids Play | Kids | Rounded colorful UI, playful category discovery |
| Artisan Craft | Handmade | Warm serif design, story-led homepage |
| Sports Gear | Sports | Bold dark/red design, performance-focused banners |
| Bookstore Classic | Books | Serif typography, curated rows, author picks |
| B2B Catalog | B2B | Clean catalog-first layout, enquiry-led CTAs |

Next 20 templates should target narrower use cases:

- Streetwear launch
- Jewelry luxury
- Furniture studio
- Pet supplies
- Health supplements
- Bakery
- Restaurant ordering
- Home decor
- Digital products
- Auto parts
- Stationery
- Farm produce
- Electronics accessories
- Fitness equipment
- Wedding boutique
- Perfume store
- Organic skincare
- Wholesale catalog
- Local services
- Educational products

## 10. Template Package Format V2 Target

Current implementation uses schemaVersion 1 with design, layout, and demoContent. That is good for safety. The upgraded target should evolve toward schemaVersion 2.

### 10.1 V2 Goals

- Support richer storefront sections
- Support page templates beyond homepage
- Support mobile-specific layout hints
- Support conversion metadata
- Keep runtime settings as the source of truth
- Keep imported packages safe and code-free

### 10.2 Example Package

~~~json
{
  "schemaVersion": 2,
  "meta": {
    "slug": "fashion-drop",
    "name": "Fashion Drop",
    "version": "2.0.0",
    "author": "Platform Templates",
    "description": "Launch-ready fashion storefront for seasonal collections and new arrivals.",
    "category": "fashion",
    "industries": ["fashion", "apparel", "lifestyle"],
    "tags": ["fashion", "launch", "editorial", "new-arrivals"],
    "previewImage": "https://cdn.example.com/templates/fashion-drop/preview.png",
    "mobilePreviewImage": "https://cdn.example.com/templates/fashion-drop/mobile.png",
    "platformCompatibility": ">=2.0.0"
  },
  "capabilities": {
    "design": true,
    "layoutStyle": true,
    "homepageSections": true,
    "demoContent": true,
    "pageTemplates": true,
    "customCode": false
  },
  "design": {
    "theme": {
      "mode": "light",
      "primaryColor": "#111827",
      "secondaryColor": "#ec4899",
      "backgroundColor": "#fff7fb",
      "surfaceColor": "#ffffff",
      "textColor": "#111827",
      "fontFamily": "Inter",
      "headingFont": "Playfair Display",
      "headingWeight": "700",
      "bodyWeight": "400",
      "lineHeight": "1.55",
      "letterSpacing": "0px",
      "headingLetterSpacing": "-0.02em",
      "borderRadius": "14px",
      "headerStyle": "glass",
      "buttonStyle": "solid",
      "cardStyle": "elevated",
      "backgroundStyle": "softGradient"
    }
  },
  "layout": {
    "nav": {
      "sticky": true,
      "showCategoryBar": true,
      "variant": "center-logo"
    },
    "footerStyle": {
      "bgColor": "#111827",
      "fgColor": "#f9fafb"
    },
    "announcementStyle": {
      "bgColor": "#ec4899",
      "fgColor": "#ffffff",
      "dismissible": true
    },
    "homepageSections": [
      { "id": "hero", "type": "hero-carousel", "enabled": true, "autoPlay": true, "interval": 6000 },
      { "id": "categories", "type": "category-shortcuts", "enabled": true, "title": "Shop The Edit", "layout": "grid" },
      { "id": "new-arrivals", "type": "product-row", "enabled": true, "title": "New Arrivals", "source": "newest", "count": 8, "layout": "carousel" },
      { "id": "promo", "type": "promo-banners", "enabled": true },
      { "id": "best-sellers", "type": "product-row", "enabled": true, "title": "Best Sellers", "source": "bestSellers", "count": 8, "layout": "grid" },
      { "id": "value-props", "type": "value-props", "enabled": true }
    ]
  },
  "demoContent": {
    "announcementText": "New season styles just landed. Free shipping over $100.",
    "heroSlides": [
      {
        "eyebrow": "New Collection",
        "title": "Dress Like The Drop Just Started",
        "subtitle": "Fresh silhouettes, bold color, and limited-run essentials.",
        "buttonText": "Shop New Arrivals",
        "buttonLink": "/products?sort=newest",
        "secondaryButtonText": "View Lookbook",
        "secondaryButtonLink": "/collections/lookbook",
        "image": "https://cdn.example.com/templates/fashion-drop/hero-1.jpg",
        "position": "left"
      }
    ],
    "valueProps": [
      { "icon": "LocalShipping", "title": "Fast Shipping", "text": "Dispatch within 24 hours." },
      { "icon": "Replay", "title": "Easy Returns", "text": "Simple returns within 14 days." },
      { "icon": "Verified", "title": "Curated Quality", "text": "Pieces selected for daily wear." }
    ],
    "promoBanners": [
      {
        "kicker": "Limited Offer",
        "title": "Weekend Wardrobe Refresh",
        "subtitle": "Save on selected styles for a short time.",
        "ctaText": "Shop Sale",
        "link": "/products?sale=true",
        "color": "#111827",
        "accentColor": "#ec4899"
      }
    ]
  },
  "pageTemplates": {
    "product": {
      "layout": "media-left-details-right",
      "showTrustBadges": true,
      "showRelatedProducts": true
    },
    "collection": {
      "layout": "sidebar-filters-grid",
      "productsPerRow": 4
    }
  }
}
~~~

## 11. Safety Rules

A Store Template must never silently install executable code.

We explicitly define two template categories:
1. **Normal Templates**: Standard packages imported or created by users.
2. **Trusted/Verified Templates**: Platform-verified or official templates.

Forbidden in normal packages:

- customCSS (Only trusted/verified templates may include customCSS, subject to SETTINGS_ADVANCED and explicit consent)
- headScripts
- bodyScripts
- arbitrary HTML blocks
- external JavaScript URLs
- payment settings
- shipping settings
- tax settings
- gateway credentials
- messaging credentials
- feature toggles

Advanced settings already exist, but they require SETTINGS_ADVANCED. Template installation must not be a backdoor into advanced injection.

## 12. Permissions

| Action | Permission |
| --- | --- |
| View built-in templates | SETTINGS_READ |
| Preview template | SETTINGS_READ |
| Export current template | SETTINGS_READ |
| Import template to library | SETTINGS_MANAGE |
| Install template | SETTINGS_MANAGE |
| Roll back template install | SETTINGS_MANAGE |
| Delete custom library template | SETTINGS_MANAGE |
| Apply custom CSS from a future trusted template (only for trusted/verified templates) | SETTINGS_ADVANCED plus explicit consent |

Server-side enforcement must happen in service logic, not only in the UI.

## 13. Runtime Data Model

Important principle:

The settings table remains the live storefront source of truth.

Template tables are library/history. They do not render the storefront directly.

~~~text
settings
  live active config used by storefront

theme_packages
  saved template records

theme_activations
  install history with before/after snapshots and rollback
~~~

Current implementation already points in the right direction:

- theme package files are loaded from built-in packages
- imported packages can be saved to library
- apply writes to settings through SettingsService.bulkUpdate()
- activation history stores snapshots
- rollback uses previous snapshot

Keep this architecture.

## 14. API Contract Target

Current route names are good enough for V1. Rename UI wording, not necessarily API paths immediately.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/themes/builtin | List built-in templates |
| GET | /api/themes/library | List saved/imported templates |
| GET | /api/themes/activations | List install history |
| POST | /api/themes/validate | Validate a package |
| POST | /api/themes/preview | Return merged preview data and changes |
| POST | /api/themes/import | Save imported template to library |
| POST | /api/themes/export | Export current store as template JSON |
| POST | /api/themes/apply | Apply selected scopes to settings |
| POST | /api/themes/activations/:id/rollback | Restore previous activation snapshot |
| DELETE | /api/themes/library/:id | Delete custom saved template |

Request for apply:

~~~json
{
  "packageData": {},
  "scopes": ["design", "layoutStyle"],
  "replaceDemoContent": false
}
~~~

Existing stores default to:

~~~json
{
  "scopes": ["design", "layoutStyle"],
  "replaceDemoContent": false
}
~~~

New/empty stores may recommend:

~~~json
{
  "scopes": ["design", "layoutStyle", "homepageSections", "demoContent"],
  "replaceDemoContent": true
}
~~~

## 15. Frontend Architecture

### 15.1 Store Templates Page

Current file:

- client/src/pages/admin/ThemeGalleryPage.jsx

Target rename later:

- client/src/pages/admin/StoreTemplatesPage.jsx

Responsibilities:

- fetch built-in templates
- fetch library templates
- fetch activation history
- filter/search templates
- open preview modal
- open install dialog
- import/export templates
- rollback installs

### 15.2 Template Card

Current file:

- client/src/components/admin/themes/ThemeCard.jsx

Target behavior:

- show real preview image or rendered screenshot
- show included scopes
- show industry/category
- show number of sections
- show tags
- show Preview and Install actions

### 15.3 Preview Modal

Current file:

- client/src/components/admin/themes/ThemePreviewModal.jsx

Target behavior:

- use buildStorefrontTheme()
- show desktop/tablet/mobile controls
- render real homepage sections from package
- compare current vs template
- support install directly from preview

### 15.4 Apply Dialog

Current file:

- client/src/components/admin/themes/ThemeApplyDialog.jsx

Target behavior:

- explain exactly what will change
- show impacted setting groups
- warn before demo content replacement
- show rollback guarantee

### 15.5 Branding Tab

Current file:

- client/src/components/admin/settings/buildSettingsPanels.jsx

Target behavior:

- keep quick brand presets
- remove marketplace-like language from this tab
- CTA: Browse Store Templates
- explain: Templates change layout and homepage. Branding only changes visual tokens.

## 16. Backend Architecture

Current module:

- server/src/modules/theme/

Keep these responsibilities:

### theme.validation.js

- strict schema validation
- reject unknown fields
- reject custom code
- limit arrays and text lengths
- validate colors, URLs, section types, product sources

### theme.service.js

- load built-in templates
- list library templates
- import validated template
- export current settings as package
- preview without writes
- apply selected scopes atomically
- create activation history
- rollback from snapshot

### theme.controller.js

- HTTP adapter only
- no business logic

### theme.routes.js

- auth and permission boundaries
- read vs manage operations

## 17. Preview System Upgrade

The preview must not be a toy mock. It should become a reusable StorefrontPreview renderer.

Target file:

- client/src/components/admin/themes/StorefrontTemplatePreview.jsx

Inputs:

~~~js
{
  packageData,
  mode: 'desktop' | 'tablet' | 'mobile',
  scopePreview: ['design', 'layoutStyle', 'homepageSections', 'demoContent'],
  currentSettings
}
~~~

It should render:

- announcement bar
- header
- hero carousel
- category shortcuts
- product rows with placeholder products
- promo banners
- value props
- footer

It must share:

- buildStorefrontTheme()
- homepage section rendering logic where practical
- production typography and style rules

## 18. Template Install Semantics

A template install is a scoped settings write.

| Scope | Writes To | Default Existing Store | Default Empty Store |
| --- | --- | --- | --- |
| design | theme.* | On | On |
| layoutStyle | nav.*, footer visual keys, announcement visual keys | On | On |
| homepageSections | homepage.sections | Off | On |
| demoContent | homepage hero/value/promo content, announcement text | Off | On with confirmation |
| pageTemplates | future product/collection/page layout settings | Off | On |

Install must be atomic:

- validate package
- build rows
- read before snapshot
- bulkUpdate rows in transaction
- read after snapshot
- create activation record
- write audit log
- return activation

Rollback must be atomic:

- find activation
- reject if already rolled back
- write beforeSnapshot back into settings
- mark activation rolled back
- write audit log

## 19. Export Behavior

Export Current Store As Template should create a package from current settings.

Export should include:

- design.theme from settings.theme
- layout.nav from settings.nav
- footerStyle from settings.footer visual keys
- announcementStyle from settings.announcement visual keys
- homepageSections from settings.homepage.sections
- optional demo content if admin selects it

Export should not include:

- advanced.*
- payment settings
- credentials
- shipping/tax settings
- feature toggles
- private admin settings

Export UI should ask:

- Include homepage structure?
- Include demo content?
- Include current hero images and banners?

## 20. Import Behavior

Import must be safe and staged.

Flow:

1. Admin selects .theme.json file.
2. Client parses JSON.
3. Server validates package.
4. UI shows package summary.
5. Admin can preview.
6. Admin can save to library or install.

Do not install immediately after import.

Validation errors should be human-friendly:

Bad:

- Validation failed

Good:

- heroSlides[0].image must be an HTTPS URL
- customCSS is not allowed in template packages
- schemaVersion 3 is not supported by this platform

## 21. Design System Requirements

To compete, themes need more style dimensions than color.

Current theme tokens should support:

- primaryColor
- secondaryColor
- backgroundColor
- surfaceColor
- textColor
- fontFamily
- headingFont
- headingWeight
- bodyWeight
- lineHeight
- letterSpacing
- headingLetterSpacing
- borderRadius
- headerStyle
- buttonStyle
- cardStyle
- backgroundStyle

Recommended next tokens:

- spacingScale
- containerWidth
- productImageRatio
- cardImageRadius
- priceStyle
- badgeStyle
- saleColor
- successColor
- headerVariant
- footerVariant
- sectionSpacing
- heroHeight
- mobileHeroBehavior

## 22. Homepage Section System Requirements

A competitor-level template system needs flexible sections.

Supported now or near-term:

- hero-carousel
- value-props
- category-shortcuts
- promo-banners
- product-row
- brand-showcase

Recommended next sections:

- editorial-image-text
- testimonials
- logo-cloud
- newsletter-signup
- countdown-sale
- featured-collection-grid
- before-after-gallery
- FAQ
- Instagram/social gallery placeholder
- recently-viewed-products
- bundle-offer
- trust-badges

Every section needs:

- id
- type
- enabled
- title/subtitle when relevant
- layout variant
- responsive behavior
- content source
- max item count

## 23. Empty Store vs Existing Store Behavior

Templates should behave differently based on store maturity.

Empty store:

- recommend applying design, layout, homepage structure, and demo content
- show message: This gives you a launch-ready starting point.

Existing store:

- default to design and layout only
- preserve current campaigns
- warn before replacing content
- highlight rollback

Heuristic for empty store:

- no orders
- few or no products
- homepage content still equals defaults
- store setup checklist incomplete

## 24. Marketplace-Like Polish

Even without paid marketplace, the UI should feel like one.

Add:

- featured templates row
- category filters
- template badges
- full preview screenshots
- mobile preview screenshots
- template detail page/modal
- changelog/version text
- best for copy
- included sections list
- accessibility/performance badges
- last updated date

Template detail should show:

- overview
- included layouts
- included sections
- color palette
- typography
- desktop preview
- mobile preview
- install options

## 25. Quality, Accessibility, and Performance

Every built-in template must pass:

- contrast check for primary text/background
- keyboard usable install dialog
- mobile preview no horizontal scroll
- no unbounded image sizes
- no script injection
- no broken URLs in seed/demo data
- install and rollback test
- export and re-import test

Performance rules:

- preview images should be optimized
- template JSON should stay under 1 MB
- homepage demo content arrays should be capped
- built-in package loading should be cached or static
- heavy preview rendering should be lazy-loaded

## 26. Implementation Roadmap

### Phase 1: Fix Product Positioning

- Rename UI from Theme Gallery to Store Templates.
- Keep route /admin/themes for now, but show Store Templates in UI.
- Change Branding copy to explain quick presets vs templates.
- Replace color-strip cards with preview-style cards.
- Add stronger empty states and category filters.

### Phase 2: Real Preview

- Create StorefrontTemplatePreview component.
- Use buildStorefrontTheme() shared utility.
- Render package homepage sections.
- Add desktop/tablet/mobile preview switch.
- Add current vs template comparison.

### Phase 3: Strong Built-in Library

- Upgrade from 3 templates to 12 templates.
- Each template includes design, layout, homepage sections, and demo content.
- Use industry-specific content and merchandising strategy.
- Add preview images.

### Phase 4: Safer Import/Export

- Improve validation error messages.
- Add export options for structure/content.
- Add import summary screen.
- Add save-to-library after preview.

### Phase 5: Advanced Template System

- Add pageTemplates for product and collection pages.
- Add more section types.
- Add mobile-specific layout hints.
- Add template versioning and upgrade flow.

### Phase 6: Marketplace Polish

- Featured templates
- Template detail page
- Sorting by popularity/newest/category
- Ratings internally later if needed
- Admin-created template sharing workflow

## 27. Immediate Changes To Make In Current UI

1. Rename page heading:

Current:

- Theme Gallery

New:

- Store Templates

2. Rename sidebar item:

Current:

- Theme Gallery

New:

- Store Templates

3. Rename Branding card title:

Current:

- Theme & Colors

New:

- Branding & Quick Presets

4. Change Branding description:

Current:

- Start with a suggested theme, then fine-tune every color and token.

New:

- Use quick presets for colors and typography. For full homepage layouts, sections, and demo content, browse Store Templates.

5. Change button:

Current:

- Browse Theme Gallery

New:

- Browse Store Templates

6. Improve Store Templates card:

Current:

- color strips

New:

- preview image or rendered mini storefront
- included sections
- category badge
- best-for copy

## 28. Acceptance Criteria For Competitor-Level V1

The feature is not competitor-level until all are true:

- Store Templates page does not feel like duplicate Branding settings.
- Applying a template can change the homepage structure.
- Preview shows a real storefront layout, not only colors.
- Existing store content is protected by default.
- Demo content replacement is explicit.
- Activation history and rollback work.
- At least 12 templates exist with real industry strategy.
- Export/import round trip works.
- Normal admins cannot inject advanced CSS/JS through templates.
- The product language says Store Templates, not Theme Gallery.

## 29. Success Metrics

Track:

- template preview opens
- template installs
- install scope selection
- demo content replacement rate
- rollback rate
- import success/failure rate
- export count
- time from new store creation to first publish-ready homepage
- most installed templates
- templates with high rollback rate

High rollback rate means a template is misleading or too destructive.

## 30. Final Product Decision

Do not compete with Shopify/Wix/Squarespace by copying their full code theme systems. That is too heavy.

Compete by being simpler:

- no code themes
- safe JSON templates
- instant preview
- scoped install
- rollback
- designer-friendly export/import
- full-store transformation through configuration

This is the right product lane:

Store Templates are config-first storefront blueprints. Branding settings are fine-tuning controls. Together they give admins speed first, control second, and safety always.


## 31. Current Reality Check After Phase 6

Phase 6 gives the feature a much better marketplace shell: better cards, stronger browsing, preview/detail flow, import/export, history, and a richer package schema.

But the product can still feel color-only because the live storefront path has not caught up with the template ambition.

Verified implementation facts:

- Theme install writes settings through server/src/modules/theme/theme.service.js.
- The default install scopes are design and layoutStyle.
- homepageSections only apply when that scope is selected.
- demoContent only applies when replaceDemoContent is true and demoContent scope is selected.
- pageTemplates exist in validation, but are not applied to live product, collection, or page layouts yet.
- StorefrontTemplatePreview supports richer v2 sections.
- HomeExperience currently renders only the older live storefront section set.
- API Builder exists and can generate public data endpoints, but templates do not use it yet.

This means the admin can preview a richer template, but the live storefront may still behave like the same homepage with different colors unless homepage sections, demo content, and live renderers are all wired.

Senior call: Phase 6 is marketplace polish. Phase 7 must be storefront transformation.

## 32. Why It Still Feels Like Only Colors

The weak feeling is not mainly a UI problem. It is an application-depth problem.

### 32.1 Default Apply Scope Is Conservative

Current install defaults protect existing stores, which is correct. But for new or empty stores, the default should be stronger.

Current behavior:

- design: on
- layoutStyle: on
- homepageSections: off unless selected
- demoContent: off unless selected
- pageTemplates: not implemented in apply path

Recommended behavior:

| Store Type | Default Scopes |
| --- | --- |
| Empty/new store | design, layoutStyle, homepageSections, demoContent, pageTemplates, dataSources |
| Existing/live store | design, layoutStyle only |
| Existing store with explicit full install | design, layoutStyle, homepageSections, demoContent, pageTemplates, dataSources |

The UI should detect or ask:

- Is this a new store setup?
- Do you want a launch-ready template?
- Do you want to preserve existing homepage content?

### 32.2 Preview Has More Section Types Than Live Storefront

The preview can show richer sections such as:

- editorial-image-text
- testimonials
- logo-cloud
- newsletter-signup
- countdown-sale
- featured-collection-grid
- faq
- trust-badges

But the live homepage renderer currently handles:

- hero-carousel
- value-props
- category-shortcuts
- promo-banners
- product-row
- brand-showcase

This creates a mismatch:

- Preview looks richer.
- Installed store may ignore richer sections.
- Admin feels the template did not really apply.

Rule: any section type allowed by theme.validation.js must either render on the live storefront or be blocked from install with a clear message.

### 32.3 Page Templates Are Validated But Not Live

The package schema supports:

- pageTemplates.product
- pageTemplates.collection
- pageTemplates.page

But there is no completed settings destination and live renderer behavior for those template layouts yet.

Until product and collection page layouts change, competitors will still feel ahead because their templates affect inner pages, not just the homepage.

### 32.4 Templates Have No Data Identity

A competitor-level Fashion template should not just say product-row.

It should know:

- show new arrivals
- show sale products
- show featured handbags
- show trending categories
- show promoted brands

Right now templates mostly describe layout blocks. They do not own strong data-source definitions.

That is exactly where the existing API Builder should be used.

## 33. Use API Builder As The Template Data-Source Layer

API Builder should not replace Store Templates. It should power them.

Store Templates answer:

- What should the storefront look like?
- What sections exist?
- What business strategy does the page follow?

API Builder answers:

- What data should each section pull?
- Which products/categories/brands/pages/media are used?
- Which filters, sorts, limits, fields, and relations are exposed?

This is the missing bridge.

### 33.1 Existing API Builder Capabilities

The current API Builder already has:

- Admin route: /admin/api-builder
- Server route: /api/api-builder
- Public route: /api/api-builder/public/:slug
- Feature flag: apiBuilder
- Resource blocks
- Field selection
- Filters
- Sorting
- Relations
- Preview endpoint
- Public URL builder

Current API Builder resources include:

- products
- categories
- brands
- pages
- menus
- menuItems
- productImages
- productVariants
- productAttributes
- variantOptions
- attributeTemplates
- attributeValues
- tags
- media
- settings

For Store Templates, do not expose the full API Builder surface. Use a safe subset.

### 33.2 Recommended Template Data Sources

Add data sources to template packages.

Example:

~~~json
{
  "schemaVersion": 3,
  "meta": {
    "slug": "fashion-drop",
    "name": "Fashion Drop",
    "version": "3.0.0",
    "category": "fashion"
  },
  "dataSources": [
    {
      "key": "new-arrivals",
      "type": "apiBuilder",
      "definition": {
        "name": "Fashion Drop New Arrivals",
        "slug": "template-fashion-drop-new-arrivals",
        "isActive": true,
        "config": {
          "responseMode": "object",
          "includeMeta": true,
          "blocks": [
            {
              "key": "products",
              "resource": "products",
              "enabled": true,
              "mode": "filtered",
              "limit": 8,
              "fields": ["id", "name", "slug", "price", "salePrice", "avgRating", "reviewCount"],
              "relations": [
                {
                  "key": "images",
                  "resource": "productImages",
                  "enabled": true,
                  "mode": "all",
                  "limit": 1,
                  "fields": ["url", "alt", "isPrimary"]
                }
              ],
              "filters": [
                { "field": "isFeatured", "operator": "equals", "source": "static", "value": true }
              ],
              "sortBy": "createdAt",
              "sortOrder": "DESC"
            }
          ]
        }
      }
    }
  ],
  "layout": {
    "homepageSections": [
      {
        "id": "new-arrivals",
        "type": "product-row",
        "enabled": true,
        "title": "New Arrivals",
        "layout": "carousel",
        "dataSourceKey": "new-arrivals"
      }
    ]
  }
}
~~~

The section does not need to know every product rule. It only references dataSourceKey.

### 33.3 How The Live Storefront Should Use It

Install flow:

1. Validate the template package.
2. Validate dataSources with a restricted API Builder schema.
3. Create or update API Builder definitions with safe template-owned slugs.
4. Save homepage sections with dataSourceKey.
5. Store created API definition ids/slugs in the activation record.
6. Live storefront reads section.dataSourceKey.
7. Frontend fetches /api/api-builder/public/:slug for that section.
8. Section renders using returned products/categories/brands/media.

This gives every template a real merchandising brain.

Example outcomes:

| Template | API Builder Data Sources |
| --- | --- |
| Fashion Drop | new arrivals, sale edit, featured brands, category tiles |
| Grocery Fresh | fresh produce, weekly deals, pantry categories |
| Tech Pro | featured electronics, accessories, promoted brands |
| Bookstore Classic | new books, staff picks, author/category features |
| B2B Catalog | promoted categories, bulk products, brand grid |

Now templates change the business structure, not only colors.

## 34. Safe API Builder Rules For Templates

Do not allow imported templates to create arbitrary public APIs.

Template-owned API Builder definitions must use a restricted allowlist.

### 34.1 Allowed Resources For Template Data Sources

Recommended v1 allowlist:

- products
- categories
- brands
- productImages
- tags
- media
- pages, only published public pages

Recommended v1 blocked resources:

- settings
- menus, unless explicitly reviewed
- menuItems, unless explicitly reviewed
- productVariants, unless stock/price fields are intentionally public
- productAttributes, unless fields are intentionally public
- attributeTemplates and attributeValues, unless needed for filters
- anything related to orders, users, payments, shipping, tax, credentials, analytics, or admin configuration

Even though settings is currently available in API Builder, templates should not be allowed to create public settings APIs.

### 34.2 Field Allowlist

For products, start with:

- id
- name
- slug
- shortDescription
- price
- salePrice
- saleLabel
- isFeatured
- avgRating
- reviewCount
- brandId
- createdAt

Avoid by default:

- quantity
- internal sku, unless store owner wants it public
- long description if it contains rich HTML
- private metadata

For media/images:

- url
- alt
- isPrimary
- sortOrder

### 34.3 Limits

Template-created data sources should be capped:

- max blocks: 8
- max relations depth: 2
- max section item limit: 24
- max public page size: 50
- max filters per block: 10
- no query-driven filters in built-in templates unless needed

### 34.4 Ownership And Cleanup

When a template creates API Builder definitions, mark them as template-owned using a persistent ownership field.

Required schema coordination with the API Builder module schema:
- `createdByTemplateId` (mapped to DB column `created_by_template_id` in `api_definitions` table): reliably tracks template-created definitions.

Recommended fields or metadata:
- source: template
- templateSlug
- activationId
- lockedByTemplate, optional
- createdByTemplateId: stores the template's slug (e.g. `meta.slug`) to reliably track template-created definitions.

Rollback behavior:

- If the API definition was created by that activation and has not been edited by the admin, remove it or deactivate it.
- If the admin edited it, keep it and mark it detached from the activation.

This prevents template installs from polluting the API Builder library.

## 35. Package Format Upgrade: Schema Version 3

Schema v2 is good for design, homepage sections, demo content, and future page templates.

Schema v3 should add template data sources.

Target shape:

~~~json
{
  "schemaVersion": 3,
  "capabilities": {
    "design": true,
    "layoutStyle": true,
    "homepageSections": true,
    "demoContent": true,
    "pageTemplates": true,
    "dataSources": true,
    "customCode": false
  },
  "dataSources": [
    {
      "key": "featured-products",
      "type": "apiBuilder",
      "definition": {
        "name": "Template Featured Products",
        "slug": "template-featured-products",
        "isActive": true,
        "config": {
          "responseMode": "object",
          "includeMeta": true,
          "blocks": []
        }
      }
    }
  ],
  "layout": {
    "homepageSections": [
      {
        "id": "featured",
        "type": "product-row",
        "enabled": true,
        "title": "Featured Products",
        "dataSourceKey": "featured-products"
      }
    ]
  }
}
~~~

Rules:

- dataSource.key must be unique inside the package.
- section.dataSourceKey must reference an existing dataSources key.
- API Builder slug should be namespaced with template slug.
- Imported templates cannot overwrite existing custom API definitions unless the admin confirms.

## 36. Phase 7 Implementation Plan: Make Templates 100x Stronger

Phase 7 goal: installing a template must visibly change the live storefront layout, section strategy, and product/category data.

### 36.1 Backend

1. Add dataSources to theme.validation.js.
2. Add a restricted API Builder schema for template-owned definitions.
3. Add dataSources to applyRequestSchema scopes.
4. Extend theme.service.js apply flow:
   - validate package
   - create/update template-owned API definitions
   - save created definition references in ThemeActivation
   - apply homepage sections with dataSourceKey
   - apply pageTemplates when destination settings exist
5. Extend rollback:
   - restore settings
   - deactivate/delete template-owned API definitions when safe
6. Add export behavior:
   - export dataSource references only by default
   - export full API definitions only when admin selects Include data sources

### 36.2 Frontend

1. Add dataSources scope to ThemeApplyDialog.
2. Default dataSources on for empty stores.
3. Show included data sources in ThemeDetailModal.
4. Show API Builder warning in import summary:
   - This template will create 3 storefront data endpoints.
5. Update StorefrontTemplatePreview:
   - render same dataSourceKey behavior with mock data
   - show labels for products/categories/brands sourced from API Builder
6. Update ThemeGalleryPage:
   - filter/sort by section count and data-source count
   - badge templates that include dynamic data

### 36.3 Live Storefront

1. Add live renderers for every allowed section type:
   - editorial-image-text
   - testimonials
   - logo-cloud
   - newsletter-signup
   - countdown-sale
   - featured-collection-grid
   - faq
   - trust-badges
2. Add section data fetching:
   - if section.dataSourceKey exists, resolve it to the API Builder public slug
   - fetch /api/api-builder/public/:slug with error wrapping and a circuit breaker:
     - Wrap each section's fetch, parsing, and normalization in a try-catch with a request timeout (2000ms).
     - Implement a simple in-memory circuit-breaker mechanism (keyed by dataSourceKey or slug) that tracks consecutive failures (trips at 3 consecutive failures), transitions to an 'open' state for a backoff duration (30 seconds), and logs a warning when the circuit trips.
   - normalize output for ProductRow, CategoryShortcuts, BrandStrip, and future sections
3. Keep fallback behavior:
   - if data source fails or returns empty/null results, return a fallback object containing the error reason and placeholderData instead of throwing a page-level error.
   - never break the full homepage

### 36.4 Built-In Templates

Upgrade built-ins from color/design packages into real store launch kits.

Each built-in should include:

- 6 to 10 homepage sections
- 3 to 6 template data sources
- product/category/brand merchandising strategy
- desktop and mobile preview image
- pageTemplates for product and collection pages
- clear bestFor copy

Example for Fashion Drop:

- hero-carousel: seasonal campaign
- category-shortcuts: women, men, accessories, shoes
- product-row: New Arrivals from API Builder data source
- editorial-image-text: lookbook story
- featured-collection-grid: curated categories
- promo-banners: sale and free shipping
- testimonials: social proof
- newsletter-signup: style updates

## 37. Phase 7 Acceptance Criteria

Phase 7 is done only when these pass:

- Installing Fashion Drop changes the live homepage section order and section types.
- New v2 section types render on the live storefront, not only in preview.
- At least one section uses an API Builder data source.
- Product rows can be template-specific without hardcoding product logic.
- Import summary shows data sources before install.
- Template install can create safe API Builder definitions.
- Rollback restores settings and cleans template-created API definitions when safe.
- pageTemplates are either implemented or hidden from install capability.
- Preview and live storefront use the same section vocabulary.
- Existing stores remain protected by default.

## 38. Senior Recommendation

Yes, use API Builder here, but use it carefully.

Do not make admins manually build APIs before using templates. That would make the template system feel complicated.

Instead:

- Store Templates own the visual and merchandising blueprint.
- API Builder powers dynamic product/category/brand data behind the scenes.
- The install dialog clearly says what data endpoints will be created.
- Security allowlists prevent templates from exposing private settings or admin data.

This is the right competitor-level direction:

- Branding settings = edit tokens.
- Store Templates = install full storefront strategy.
- API Builder = dynamic data engine for template sections.

Without API Builder integration, templates will remain mostly visual. With API Builder integration, each template can behave like a real industry-specific storefront.

## 39. Senior Reality Check: What Is Still Missing

The current system is improved, but it is not yet a competitor-level template engine.

The main problem is not that the colors are weak. The main problem is that templates do not yet control enough of the storefront experience.

Right now, the product mostly has:

- theme tokens
- homepage section order
- some demo content
- a template gallery UI
- early API Builder data-source support

Competitors have:

- page-level templates
- section/block systems
- responsive layout controls
- visual preview that matches live storefront
- business-type specific starting points
- inner-page designs
- reusable content blocks
- dynamic CMS/data bindings

Shopify's theme model is built around templates, sections, and blocks. Shopify documents that a template is made from sections, and sections are composed of blocks. That is the key mental model we need to learn from, even if we keep our safer JSON/config-first architecture.

Wix and Wix Studio push templates as full responsive starting points, with business-type sections, section templates, and responsive layout tooling. Squarespace's Blueprint-style approach pushes step-by-step site generation, not just selecting a color palette.

Sources:

- Shopify theme structure: https://help.shopify.com/en/manual/online-store/themes/theme-structure
- Shopify sections and blocks: https://help.shopify.com/en/manual/online-store/themes/theme-structure/sections-and-blocks
- Wix Editor sections: https://support.wix.com/en/article/wix-editor-adding-and-setting-up-sections
- Wix Studio responsive templates: https://www.wix.com/studio/templates
- Squarespace AI and Blueprint AI Builder: https://support.squarespace.com/hc/en-us/articles/16282290976013-Using-Squarespace-AI

Conclusion: we should stop thinking "theme gallery" and start building a config-first storefront builder.

## 40. Product Ladder: From Weak To Strong

This is the maturity ladder.

| Level | Name | What Changes | User Feeling |
| --- | --- | --- | --- |
| 1 | Color Preset | colors, fonts, radius | "Same site, new paint" |
| 2 | Theme | colors, fonts, header/footer styling | "Looks different, works same" |
| 3 | Store Template | homepage sections, demo content, product/category strategy | "This feels like a new store" |
| 4 | Page Template System | product page, collection page, brand page, static page layouts | "The whole site changed" |
| 5 | Section/Block Builder | reusable configurable sections with blocks | "I can customize like Shopify/Wix" |
| 6 | AI/Guided Template Builder | asks business type and generates layout/content/data sources | "It built my store for me" |

Current state is between Level 2 and Level 3.

Target for the next serious release: Level 4.

Target for competitor-level: Level 5.

Target for differentiation: Level 6.

## 41. What Must Change So Templates Feel 100x Better

### 41.1 Build A Real Section/Block System

A section should not be a fixed hardcoded renderer only.

A section should contain configurable blocks:

~~~json
{
  "id": "hero-fashion",
  "type": "hero",
  "variant": "split-editorial",
  "settings": {
    "height": "large",
    "imagePosition": "right",
    "contentAlign": "left"
  },
  "blocks": [
    { "type": "eyebrow", "text": "New Season" },
    { "type": "heading", "text": "The Drop Is Live" },
    { "type": "text", "text": "Fresh styles for the week ahead." },
    { "type": "button", "label": "Shop New Arrivals", "href": "/products?sort=newest" }
  ]
}
~~~

This gives templates real layout variety without allowing unsafe code.

Minimum section families:

- hero
- product-grid
- product-carousel
- category-grid
- brand-strip
- image-text
- promo-grid
- testimonials
- trust-badges
- newsletter
- faq
- countdown
- logo-cloud
- lookbook
- collection-feature

Each section family needs variants:

| Section | Required Variants |
| --- | --- |
| hero | split, centered, full-bleed, video-style placeholder, editorial |
| product-grid | 2-column, 3-column, 4-column, masonry-like, carousel |
| category-grid | icon grid, image tiles, editorial tiles, compact chips |
| image-text | image left, image right, overlap card, full-width story |
| promo-grid | 2-up, 3-up, banner stack, asymmetric |
| testimonials | cards, quote wall, carousel |

This is where the visual difference will come from.

### 41.2 Add Page Templates, Not Only Homepage Templates

Competitors feel strong because inner pages also change.

We need template control for:

- home page
- collection/product listing page
- product detail page
- brand page
- search results page
- static content page
- cart page polish, later
- account page polish, later

V1 mapping:

| Template Area | Settings Group | Live Page |
| --- | --- | --- |
| pageTemplates.collection | catalog | ProductListPage, SearchResultsPage, SalePage |
| pageTemplates.product | productPage | ProductDetailPage |
| pageTemplates.brand | brandsPage | BrandsPage, BrandDetailPage |

Collection page variants:

- sidebar filters + grid
- top filter bar + wide grid
- editorial collection header + grid
- compact B2B table/list
- image-led category browsing

Product page variants:

- media left/details right
- sticky purchase panel
- gallery top/details below
- luxury editorial layout
- specs-first layout for electronics
- trust-heavy layout for beauty/health

This is the fastest path to making installs feel real.

### 41.3 Make API Builder The Merchandising Engine

Each template should ship with data-source recipes, not generic product rows.

Bad:

~~~json
{ "type": "product-row", "title": "Featured Products" }
~~~

Good:

~~~json
{
  "type": "product-row",
  "title": "Fresh Deals This Week",
  "dataSourceKey": "weekly-deals",
  "emptyStateStrategy": "fallback-to-featured"
}
~~~

Template data source examples:

| Template | Data Sources |
| --- | --- |
| Fashion Drop | new arrivals, sale edit, accessories, promoted brands |
| Grocery Fresh | weekly deals, fresh produce, pantry staples, delivery categories |
| Tech Pro | featured electronics, top accessories, newest gadgets, promoted brands |
| Beauty Studio | skincare routine, best sellers, new arrivals, reviews |
| B2B Catalog | bulk products, promoted categories, brand directory |

This is how a template becomes a store strategy.

### 41.4 Add Template Content Intelligence

Templates should include real business copy patterns.

For each template, define:

- announcement text
- hero copy
- product-row titles
- CTA labels
- empty-state copy
- footer value props
- trust language
- SEO title pattern
- category description patterns

Example:

| Industry | CTA Style |
| --- | --- |
| Fashion | Shop The Drop, Explore New Arrivals |
| Grocery | Order Fresh, Shop Weekly Deals |
| Electronics | Compare Specs, Shop Latest Tech |
| Beauty | Build Your Routine, Shop Best Sellers |
| B2B | Request Quote, View Catalog |

This small detail makes templates feel intentionally designed.

### 41.5 Add Responsive Layout Rules

A template must define desktop, tablet, and mobile behavior.

Example:

~~~json
{
  "responsive": {
    "desktop": { "columns": 4, "heroHeight": "720px" },
    "tablet": { "columns": 2, "heroHeight": "560px" },
    "mobile": { "columns": 1, "heroHeight": "auto", "stackHero": true }
  }
}
~~~

Every section should support:

- desktop columns
- tablet columns
- mobile columns
- spacing scale
- image ratio
- hide/show on device
- stacking behavior
- mobile CTA placement

Without this, previews will look good on desktop and weak on mobile.

## 42. The Better Architecture: Template Engine, Not Theme Gallery

Recommended architecture:

~~~text
Store Template Package
  meta
  capabilities
  design tokens
  layout shell
  section tree
  page templates
  content presets
  data-source recipes
  responsive rules

Template Engine
  validate package
  resolve install scopes
  create API Builder data sources
  map page templates to settings
  write settings atomically
  create activation snapshot
  support rollback

Live Storefront Renderer
  read settings
  render section tree
  resolve data sources
  use responsive rules
  fail gracefully per section
~~~

This keeps the system safe:

- no user Liquid code
- no arbitrary JavaScript
- no direct DB template rendering
- no unsafe public APIs

But it becomes powerful:

- layouts change
- sections change
- data changes
- product pages change
- collection pages change
- mobile behavior changes

## 43. Practical Next Phases

### Phase 8: Page Templates

Goal: installs affect product and collection pages.

Backend:

- Add `pageTemplates` to apply scopes.
- Map `pageTemplates.product` into `productPage.*`.
- Map `pageTemplates.collection` into `catalog.*`.
- Include page-template changes in activation snapshots.
- Export page templates from current settings.

Frontend:

- Add Page Templates checkbox in install dialog.
- Show "Product page" and "Collection page" in template detail.
- Update ProductDetailPage to support layout variants.
- Update ProductListPage/SearchResultsPage/SalePage to support collection layout variants.

Acceptance:

- Luxury template can produce an editorial product page.
- B2B template can produce a compact catalog/table-style listing.
- Grocery template can produce category-first browsing.

### Phase 9: Section Builder Runtime

Goal: all live homepage sections use one section registry.

Build:

- `sectionRegistry`
- `SectionRenderer`
- per-section schemas
- per-section variants
- shared preview/live renderers

Do not keep separate preview-only section renderers. That creates false previews.

Acceptance:

- Any section visible in preview renders live.
- Unknown sections show a safe admin warning/fallback.
- Section variants change layout meaningfully, not only spacing.

### Phase 10: Template Composer

Goal: admin can create a new template from existing sections.

Features:

- Add section
- Reorder section
- Duplicate section
- Hide section
- Edit section copy
- Pick data source
- Save as template
- Export template

This is where we start matching builder products instead of only marketplace products.

### Phase 11: AI-Assisted Store Builder

Goal: differentiate instead of copying competitors.

Flow:

1. Ask business type.
2. Ask style preference.
3. Ask product strategy.
4. Generate section tree.
5. Generate copy.
6. Generate API Builder data-source recipes.
7. Preview.
8. Install with rollback.

Example prompt:

> Create a premium skincare storefront for a small brand. Focus on routines, trust, before/after proof, and best sellers.

Output:

- design tokens
- homepage sections
- product page layout
- collection layout
- value props
- CTA copy
- API Builder product rows

This is the 100x direction.

## 44. Concrete Ideas That Will Make Us Feel Competitive

High-impact ideas:

1. **Template Detail Page**
   - show desktop/mobile screenshots
   - show included pages
   - show included sections
   - show data sources created
   - show install impact

2. **Before/After Diff**
   - "This install will change 18 settings, 7 homepage sections, 2 page templates, and create 4 data sources."

3. **Layout Variant Picker**
   - after choosing a template, admin picks:
     - Classic
     - Editorial
     - Compact
     - Conversion-focused

4. **Industry Template Packs**
   - Fashion Pack: 5 templates
   - Grocery Pack: 5 templates
   - Electronics Pack: 5 templates
   - B2B Pack: 5 templates

5. **Template Health Score**
   - contrast score
   - mobile score
   - section completeness
   - data-source completeness
   - rollback safety

6. **Smart Empty Store Setup**
   - "You have 0 orders and 3 products. Want a launch-ready store?"
   - default full install
   - create demo homepage without touching product data

7. **Template-Owned API Sources**
   - every product row has a named source
   - admin can later edit that source in API Builder
   - template does not hardcode business logic

8. **Page-Level Preview**
   - preview homepage
   - preview product page
   - preview collection page
   - preview mobile

9. **Template Versioning**
   - built-in templates can be upgraded
   - custom templates show compatibility
   - activation history knows version installed

10. **Guided "Make It Mine" Step**
   - after install, ask:
     - upload logo
     - choose hero image
     - pick featured categories
     - pick top products
     - edit announcement

This is where templates become useful instead of decorative.

## 45. Immediate Engineering Priority

Do not spend more time only polishing cards.

Priority order:

1. Implement `pageTemplates` apply path.
2. Make product and collection pages consume layout variants.
3. Create shared section registry used by preview and live storefront.
4. Make every built-in template include real data-source recipes.
5. Add page-level preview.
6. Add install impact diff.
7. Add template composer later.

The next code phase should be Phase 8: Page Templates.

Reason:

- It directly addresses the complaint that installs only change colors.
- It makes templates change more than colors.
- It is smaller than building a full drag-and-drop builder.
- It creates the foundation for competitor-level templates.

## 46. Senior Product Verdict

The current system is not bad. It is just still in the early layer.

But if we stop here, it will feel behind competitors because:

- Branding already covers colors.
- Store Templates must own layouts.
- Store Templates must own sections.
- Store Templates must own page templates.
- Store Templates must own data strategy.

The winning positioning is:

> Shopify has code themes. Wix has visual design freedom. Squarespace has curated site starting points. We provide safe, config-first commerce templates that install full store strategy in one click and can be edited without code.

That is strong.

But only if the implementation reaches beyond colors.

## 47. Implementation Update: Page Templates And Section Registry

Status after the latest implementation pass:

- `pageTemplates` are now a real install scope.
- Product page templates map into `productPage.*` settings.
- Collection page templates map into `catalog.*` settings.
- Product detail pages now react to template layout settings.
- Product listing/search/sale pages now react to collection layout settings.
- Built-in templates now include product and collection page template definitions.
- Live homepage and admin preview now use a shared section registry vocabulary.
- Unknown sections show a safe fallback instead of silently disappearing.

This moves the product from Level 2/3 toward Level 4 in the maturity ladder.

### 47.1 Files Added

- `client/src/components/storefront/sections/sectionRegistry.js`
- `client/src/components/storefront/sections/SectionFallback.jsx`

### 47.2 Section Registry Responsibilities

The section registry is now the shared contract between preview and live storefront rendering.

It defines:

- allowed section type constants
- human labels
- section family metadata
- data requirements: content/products/categories/brands
- whether the section has live support
- whether the section has preview support
- shared helpers for hero detection
- shared helpers for product/category data fetching decisions
- safe renderer factory
- support summary utility

This matters because competitor-level templates cannot have a preview-only fantasy. A section that appears in preview must either render live or show a clear unsupported-section fallback.

### 47.3 Current Section Support Matrix

| Section | Family | Data | Live | Preview |
| --- | --- | --- | --- | --- |
| hero-carousel | hero | content | yes | yes |
| value-props | trust | content | yes | yes |
| category-shortcuts | merchandising | categories | yes | yes |
| promo-banners | campaign | content | yes | yes |
| product-row | merchandising | products | yes | yes |
| brand-showcase | merchandising | brands | yes | yes |
| editorial-image-text | story | content | yes | yes |
| testimonials | trust | content | yes | yes |
| logo-cloud | trust | content | yes | yes |
| newsletter-signup | conversion | content | yes | yes |
| countdown-sale | campaign | content | yes | yes |
| featured-collection-grid | merchandising | categories | yes | yes |
| faq | trust | content | yes | yes |
| trust-badges | trust | content | yes | yes |

### 47.4 Why This Matters

Before this step:

- preview and live used separate switch statements
- adding a new section could accidentally work in preview but fail live
- unknown live sections could disappear silently
- data-fetch requirements were hardcoded inside `HomeExperience.jsx`

After this step:

- section names, labels, families, and data requirements live in one registry
- preview and live use the same section vocabulary
- unsupported sections are visible during preview/live rendering
- future admin screens can read registry metadata for badges, validation, and install impact

This is not yet a full shared renderer system, but it is the correct foundation.

## 48. Next Phase: Shared Section Components

The next implementation should remove the remaining renderer duplication.

Current state:

- preview and live share the registry
- preview and live still use separate render components for most sections

Target state:

- create reusable section components in `client/src/components/storefront/sections/`
- each section accepts a mode:
  - `mode="live"`
  - `mode="preview"`
- preview passes mock/placeholder data
- live passes real API Builder/storefront data
- styling and layout variants are shared

Recommended component split:

| Component | Purpose |
| --- | --- |
| `HeroSection.jsx` | hero-carousel variants |
| `ProductRowSection.jsx` | product rows/carousels/grids |
| `CategorySection.jsx` | category-shortcuts and featured-collection-grid |
| `PromoBannerSection.jsx` | promo-banners |
| `TrustSection.jsx` | value-props and trust-badges |
| `EditorialSection.jsx` | editorial-image-text |
| `ContentGridSection.jsx` | testimonials, FAQ, logo-cloud |
| `NewsletterSection.jsx` | newsletter-signup |
| `CountdownSection.jsx` | countdown-sale |

Acceptance criteria for Phase 10:

- preview and live import the same section component files
- adding a new section requires one registry entry and one component
- no duplicated switch logic grows back inside preview/live pages
- every built-in template section has matching live behavior
- section variants visibly change layout, not only spacing

This is the next necessary step before building a visual template composer.

## 49. Implementation Update: First Shared Section Component

The first shared section component has been extracted.

Added:

- `client/src/components/storefront/sections/TrustSection.jsx`

Now shared by:

- live homepage `value-props`
- live homepage `trust-badges`
- admin template preview `value-props`
- admin template preview `trust-badges`

Why this matters:

- Preview and live now share real rendering code for the first section family.
- The shared component supports `mode="live"` and `mode="preview"`.
- This proves the migration pattern for the rest of the section system.

Current shared-component status:

| Section Family | Shared Component | Status |
| --- | --- | --- |
| trust/value props | `TrustSection.jsx` | done |
| hero | `HeroSection.jsx` | done |
| categories | `CategorySection.jsx` | done |
| products | `ProductRowSection.jsx` | done |
| promo banners | `PromoBannerSection.jsx` | done |
| editorial | `EditorialSection.jsx` | done |
| content grids | `ContentGridSection.jsx` | done |
| newsletter | `NewsletterSection.jsx` | pending |
| countdown | `CountdownSection.jsx` | pending |

Next recommended extraction order:

1. `PromoBannerSection.jsx`
2. `EditorialSection.jsx`
3. `ContentGridSection.jsx`
4. `CategorySection.jsx`
5. `ProductRowSection.jsx` - done
6. `HeroSection.jsx` - done

Reason: extract simpler content sections first, then data-heavy sections, then the hero last because it has carousel state and more visual behavior.

## 50. Implementation Update: Shared Promo Banner Section

The second shared section component has been extracted.

Added:

- `client/src/components/storefront/sections/PromoBannerSection.jsx`

Now shared by:

- live homepage `promo-banners`
- admin template preview `promo-banners`

Important behavior:

- `mode="live"` uses real storefront links.
- `mode="preview"` renders as a non-navigating preview surface.
- Both modes share the same banner layout, typography, colors, CTA treatment, and fallback banner data.

Shared-component progress:

| Section Family | Shared Component | Status |
| --- | --- | --- |
| trust/value props | `TrustSection.jsx` | done |
| promo banners | `PromoBannerSection.jsx` | done |
| editorial | `EditorialSection.jsx` | done |
| content grids | `ContentGridSection.jsx` | done |
| categories | `CategorySection.jsx` | done |
| products | `ProductRowSection.jsx` | done |
| hero | `HeroSection.jsx` | done |

Next extraction: `ContentGridSection.jsx`.

Reason: testimonials, FAQ, and logo-cloud still duplicate preview/live card-grid behavior and can be unified before touching data-heavy sections.

## 51. Implementation Update: Shared Editorial Section

The third shared section component has been extracted.

Added:

- `client/src/components/storefront/sections/EditorialSection.jsx`

Now shared by:

- live homepage `editorial-image-text`
- admin template preview `editorial-image-text`

Important behavior:

- `mode="live"` uses storefront navigation links.
- `mode="preview"` keeps CTA behavior non-destructive.
- Both modes share image placement, reverse layout, typography, CTA treatment, image fallback, and responsive structure.

Shared-component progress:

| Section Family | Shared Component | Status |
| --- | --- | --- |
| trust/value props | `TrustSection.jsx` | done |
| promo banners | `PromoBannerSection.jsx` | done |
| editorial | `EditorialSection.jsx` | done |
| content grids | `ContentGridSection.jsx` | done |
| categories | `CategorySection.jsx` | done |
| products | `ProductRowSection.jsx` | done |
| hero | `HeroSection.jsx` | done |

Next extraction: `BrandShowcaseSection.jsx` or richer section variants.

## 52. Implementation Update: Shared Content Grid Section

The fourth shared section component has been extracted.

Added:

- `client/src/components/storefront/sections/ContentGridSection.jsx`

Now shared by:

- live homepage `testimonials`
- live homepage `logo-cloud`
- live homepage `faq`
- admin template preview `testimonials`
- admin template preview `logo-cloud`
- admin template preview `faq`

Important behavior:

- Supports `mode="live"` and `mode="preview"`.
- Supports normal card grids and logo grids.
- Preserves author/role rendering for testimonials.
- Uses safe fallback items when template content is missing.

Shared-component progress:

| Section Family | Shared Component | Status |
| --- | --- | --- |
| trust/value props | `TrustSection.jsx` | done |
| promo banners | `PromoBannerSection.jsx` | done |
| editorial | `EditorialSection.jsx` | done |
| content grids | `ContentGridSection.jsx` | done |
| categories | `CategorySection.jsx` | done |
| products | `ProductRowSection.jsx` | done |
| hero | `HeroSection.jsx` | done |

Next extraction: `BrandShowcaseSection.jsx` or richer section variants.

Reason: product rows are the core merchandising unit and the most important API Builder-backed section to unify next.

## 53. Implementation Update: Shared Category Section

The first data-backed shared section component has been extracted.

Added:

- `client/src/components/storefront/sections/CategorySection.jsx`

Now shared by:

- live homepage `category-shortcuts`
- live homepage `featured-collection-grid`
- admin template preview `category-shortcuts`
- admin template preview `featured-collection-grid`

Important behavior:

- `mode="live"` renders real category data or configured template tiles.
- `mode="preview"` renders safe placeholder category tiles.
- Supports loading skeletons for live data.
- Supports configured section items as category tiles.
- Supports view-all/action links in live mode without making preview destructive.

Shared-component progress:

| Section Family | Shared Component | Status |
| --- | --- | --- |
| trust/value props | `TrustSection.jsx` | done |
| promo banners | `PromoBannerSection.jsx` | done |
| editorial | `EditorialSection.jsx` | done |
| content grids | `ContentGridSection.jsx` | done |
| categories | `CategorySection.jsx` | done |
| products | `ProductRowSection.jsx` | done |
| hero | `HeroSection.jsx` | done |

Next extraction: `BrandShowcaseSection.jsx` or richer section variants.

Reason: product rows are the main merchandising surface and the most important API Builder-backed section family to make preview/live consistent.

## 54. Implementation Update: Shared Product Row Section

Added `client/src/components/storefront/sections/ProductRowSection.jsx`.

This closes the product-row preview/live gap. Before this step, live homepage rows used the real `ProductRow` and template preview used a separate simplified renderer. That meant the preview could claim a row/carousel layout that did not behave like the real storefront.

Now shared by:

- live homepage `product-row`
- admin template preview `product-row`
- API Builder-backed product rows, because live mode receives the `HomeExperience` data-source result

Important behavior:

- `mode="live"` delegates to the production `ProductRow` and `ProductCard` path.
- `mode="preview"` renders safe placeholder products from the same section config.
- Supports grid and carousel visual modes.
- Keeps sale rows hidden when pricing is disabled.
- Keeps preview non-destructive: preview view-all buttons do not navigate.

Shared-component progress:

| Section Family | Shared Component | Status |
| --- | --- | --- |
| trust/value props | `TrustSection.jsx` | done |
| promo banners | `PromoBannerSection.jsx` | done |
| editorial | `EditorialSection.jsx` | done |
| content grids | `ContentGridSection.jsx` | done |
| categories | `CategorySection.jsx` | done |
| products | `ProductRowSection.jsx` | done |
| hero | `HeroSection.jsx` | done |

Next extraction: `BrandShowcaseSection.jsx` or richer section variants.

Reason: hero is the strongest visual differentiator. If we want competitor-level templates, the hero cannot remain one generic banner. It needs shared variants such as split hero, editorial hero, video hero, product spotlight hero, centered luxury hero, and campaign hero.

## 55. Implementation Update: Shared Hero Section And Variants

Added `client/src/components/storefront/sections/HeroSection.jsx`.

This is the first visible step away from "same template, different colors." The hero is now a shared storefront section used by both the live homepage and the admin template preview.

Now shared by:

- live homepage `hero-carousel`
- admin template preview `hero-carousel`

Supported hero variants:

| Variant | Purpose |
| --- | --- |
| `overlay` | classic full-bleed campaign hero with image background |
| `centered` / `align: center` | luxury/editorial centered hero presentation |
| `split` / `split-editorial` / `editorial` | text + image split hero for fashion, handmade, organic, books |
| `product-spotlight` / `spotlight` | hero with featured product card overlay |

Important behavior:

- Live mode keeps carousel autoplay and previous/next controls.
- Preview mode is non-destructive: hero buttons render as buttons, not links.
- Existing packages without a variant still render as the old overlay hero.
- Hero slides can carry their own `variant`, or the section can define `variant`/`heroVariant`.
- This gives built-in templates a real layout difference, not only a palette difference.

Shared-component progress:

| Section Family | Shared Component | Status |
| --- | --- | --- |
| trust/value props | `TrustSection.jsx` | done |
| promo banners | `PromoBannerSection.jsx` | done |
| editorial | `EditorialSection.jsx` | done |
| content grids | `ContentGridSection.jsx` | done |
| categories | `CategorySection.jsx` | done |
| products | `ProductRowSection.jsx` | done |
| hero | `HeroSection.jsx` | done |

Next upgrade direction:

- Update built-in themes so each one uses a different hero variant.
- Add `BrandShowcaseSection.jsx` to remove the last preview/live split around brand rendering.
- Add section-specific variant controls in the theme package schema and admin builder UI.

