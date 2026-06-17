# Theme Marketplace - V1 Implementation Plan

> **Status**: Approved design target for implementation  
> **Date**: 2026-05-27  
> **Supersedes for implementation**: `docs/THEME-MARKETPLACE-TEMPLATE-SYSTEM.md`  
> **Main rule**: A theme may change store design with one click. It must not silently replace live marketing content or install custom code.

## 1. What We Are Building

Admins will be able to:

1. Browse built-in store themes.
2. Preview a theme before applying it.
3. Apply theme design settings to the storefront.
4. Import and export `.theme.json` files.
5. Save imported/custom themes in a library.
6. See install history and roll back a bad install.

The existing `settings` table remains the live storefront configuration. This feature does not replace it.

```text
settings            = what the storefront uses right now
theme_packages      = saved themes available in the gallery/library
theme_activations   = install history, snapshots, and rollback support
```

## 2. Important Product Rule

A package contains three kinds of data:

| Type | Examples | Installation Behavior |
| --- | --- | --- |
| Design | colors, fonts, radius, header/button/card style | Applied by default |
| Layout | sticky nav, category bar, footer/announcement colors, homepage section order | Admin may select |
| Content | hero text/images, promo banners, announcement message | Never applied unless admin selects `Replace demo content` |

Example:

```text
Current store: Diwali Sale hero banner
Installed theme: Luxury Dark

Expected result:
- Store becomes dark with gold buttons and serif headings.
- Diwali Sale content stays unchanged.
```

## 3. V1 Scope

### Included

- Three built-in themes: Premium Retail, Clean Minimal, Luxury Dark.
- Built-in gallery and custom theme library.
- Full-screen preview.
- Import/export JSON.
- Scoped installation.
- Activation history.
- Rollback.
- Strict server validation.
- Permission and audit integration.

### Not Included

- `customCSS`.
- `headScripts` or `bodyScripts`.
- Paid/external marketplace.
- Component/template code replacement.
- Automatically applying hero slides, promo banners, or announcement text.
- Twelve built-in themes before the flow is stable.

## 4. Existing Code This Uses

| Current File | How It Is Used |
| --- | --- |
| `config/default.json` | Defines existing theme, nav, footer, announcement, and homepage shapes |
| `server/src/modules/settings/settings.service.js` | Reads/writes active storefront settings |
| `server/src/app.js` | Mounts new `/api/themes` routes |
| `server/src/modules/index.js` | Auto-discovers new `*.model.js` files; do not manually register models |
| `client/src/context/ThemeContext.jsx` | Creates the live MUI storefront theme |
| `client/src/pages/storefront/HomeExperience.jsx` | Uses homepage sections/slides/promos |
| `client/src/components/admin/settings/SettingsPreviewPanel.jsx` | Existing preview reference |
| `client/src/routes/AppRoutes.jsx` | Adds `/admin/themes` page |
| `client/src/layouts/AdminLayout.jsx` | Adds Theme Gallery menu item |

Important repository facts:

- New migrations go in `server/migrations/`.
- New server modules go in `server/src/modules/theme/`.
- New admin pages go in `client/src/pages/admin/`.
- Models are auto-loaded; a new model file in the theme module is enough.

## 5. Safe Theme Package Format

Files use the extension:

```text
<slug>-v<version>.theme.json
```

Example package:

```json
{
  "schemaVersion": 1,
  "meta": {
    "slug": "luxury-dark",
    "name": "Luxury Dark",
    "version": "1.0.0",
    "author": "Platform Themes",
    "description": "Dark premium theme with gold accents.",
    "category": "luxury",
    "tags": ["dark", "premium", "serif"],
    "previewImage": "https://cdn.example.com/themes/luxury-dark.png"
  },
  "design": {
    "theme": {
      "mode": "dark",
      "primaryColor": "#d4af37",
      "secondaryColor": "#8b5cf6",
      "backgroundColor": "#0f1115",
      "surfaceColor": "#181b22",
      "textColor": "#f8fafc",
      "fontFamily": "Lato",
      "headingFont": "Playfair Display",
      "headingWeight": "700",
      "bodyWeight": "400",
      "lineHeight": "1.5",
      "letterSpacing": "0px",
      "headingLetterSpacing": "0px",
      "borderRadius": "4px",
      "headerStyle": "glass",
      "buttonStyle": "outline",
      "cardStyle": "elevated",
      "backgroundStyle": "solid"
    }
  },
  "layout": {
    "nav": {
      "sticky": true,
      "showCategoryBar": true
    },
    "footerStyle": {
      "bgColor": "#0a0a0a",
      "fgColor": "#e2e8f0"
    },
    "announcementStyle": {
      "bgColor": "#d4af37",
      "fgColor": "#0f1115"
    },
    "homepageSections": [
      { "id": "hero", "type": "hero-carousel", "enabled": true, "autoPlay": true, "interval": 6500 },
      { "id": "value-props", "type": "value-props", "enabled": true },
      { "id": "promo", "type": "promo-banners", "enabled": true },
      { "id": "trending", "type": "product-row", "enabled": true, "title": "Trending Now", "source": "featured", "count": 8, "layout": "carousel", "viewAllLink": "/products?featured=true" }
    ]
  },
  "demoContent": {
    "announcementText": "Free shipping on orders over $100",
    "heroSlides": [],
    "valueProps": [],
    "promoBanners": []
  }
}
```

### Why This Format

- `design` is safe to install by default.
- `layout` changes structure/styles, not campaign copy.
- `demoContent` is available for a brand-new store but is never silently installed.
- There is no custom CSS or JavaScript import path.

## 6. Supported Values in V1

Use only values already supported by the storefront UI and rendering logic.

### Theme Settings

| Key | Valid Values |
| --- | --- |
| `mode` | `light`, `dark` |
| `headerStyle` | `gradient`, `solid`, `glass` |
| `buttonStyle` | `solid`, `soft`, `outline` |
| `cardStyle` | `elevated`, `outlined`, `flat` |
| `backgroundStyle` | `softGradient`, `solid` |
| `headingWeight`, `bodyWeight` | `300`, `400`, `500`, `600`, `700`, `800`, `900` |

### Homepage Section Types

| Type | Supported |
| --- | --- |
| `hero-carousel` | Yes |
| `value-props` | Yes |
| `category-shortcuts` | Yes |
| `promo-banners` | Yes |
| `product-row` | Yes |
| `brand-showcase` | Yes |

## 7. Installation Choices Shown To Admin

The apply dialog must display these options:

```text
Install "Luxury Dark"

[x] Apply design: colors, fonts and component styles
[x] Apply layout styling: navigation, footer and announcement colors
[ ] Apply homepage section order
[ ] Replace homepage demo content and announcement text

Cancel                                  Install Theme
```

Default request:

```json
{
  "scopes": ["design", "layoutStyle"],
  "replaceDemoContent": false
}
```

Only when explicitly selected:

```json
{
  "scopes": ["design", "layoutStyle", "homepageSections", "demoContent"],
  "replaceDemoContent": true
}
```

## 8. Database Design

### 8.1 Existing `settings` Table

No schema change is required. After applying a theme, active values are stored using existing groups:

| Package Field | Settings Destination |
| --- | --- |
| `design.theme.*` | group `theme` |
| `layout.nav.*` | group `nav` |
| `layout.footerStyle.*` | group `footer` |
| `layout.announcementStyle.*` | group `announcement` |
| `layout.homepageSections` | group `homepage`, key `sections` |
| `demoContent.announcementText` | group `announcement`, key `text` |
| `demoContent.heroSlides` | group `homepage`, key `heroSlides` |
| `demoContent.valueProps` | group `homepage`, key `valueProps` |
| `demoContent.promoBanners` | group `homepage`, key `promoBanners` |

### 8.2 New Table: `theme_packages`

Purpose: themes available to browse or install.

Migration file:

```text
server/migrations/20260527100000-create-theme-packages-and-activations.js
```

Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID primary key | Generated UUID |
| `slug` | STRING(100), unique | Stable package slug |
| `name` | STRING(255) | Display name |
| `version` | STRING(20) | Package version |
| `author` | STRING(255), nullable | Theme author |
| `description` | TEXT, nullable | Gallery description |
| `category` | STRING(50), nullable | Filter category |
| `tags` | JSONB | Tag array |
| `preview_image` | TEXT, nullable | Preview image URL |
| `package_data` | JSONB | Validated full package |
| `source` | STRING(20) | `builtin`, `imported`, `saved` |
| `created_by` | UUID, nullable | User who imported/saved it |
| `created_at`, `updated_at` | DATE | Standard timestamps |

V1 decision: one saved package row represents one slug/version. If multiple versions of the same theme must later coexist, add `theme_package_versions` in v2.

### 8.3 New Table: `theme_activations`

Purpose: history and rollback.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID primary key | Activation ID |
| `theme_package_id` | UUID, nullable FK | Applied saved package, nullable for direct preview/import apply |
| `theme_name` | STRING(255) | Snapshot label for history |
| `theme_version` | STRING(20), nullable | Version applied |
| `applied_scopes` | JSONB | Selected installation scopes |
| `before_snapshot` | JSONB | Values before install |
| `after_snapshot` | JSONB | Values after install |
| `applied_by` | UUID FK | Admin who installed |
| `rolled_back_at` | DATE, nullable | Set when rolled back |
| `rolled_back_by` | UUID, nullable FK | Admin who rolled back |
| `created_at` | DATE | Install time |

Indexes:

```text
theme_packages.slug unique
theme_packages.source
theme_packages.category
theme_activations.created_at
theme_activations.theme_package_id
```

## 9. Backend Files

### New Files

```text
server/src/modules/theme/
├── builtin/
│   ├── premium-retail.theme.json
│   ├── clean-minimal.theme.json
│   └── luxury-dark.theme.json
├── themePackage.model.js
├── themeActivation.model.js
├── theme.validation.js
├── theme.service.js
├── theme.controller.js
└── theme.routes.js

server/migrations/
└── 20260527100000-create-theme-packages-and-activations.js
```

### Modified Files

```text
server/src/app.js
server/src/modules/settings/settings.service.js
server/src/modules/settings/settings.routes.js
```

Do **not** modify `server/src/modules/index.js` to register models. It already auto-loads all files ending in `.model.js`.

## 10. Backend Work Details

### 10.1 Migration and Models

Create Sequelize models:

```text
ThemePackage
ThemeActivation
```

Associations:

```text
ThemePackage.hasMany(ThemeActivation, { foreignKey: 'themePackageId', as: 'activations' })
ThemeActivation.belongsTo(ThemePackage, { foreignKey: 'themePackageId', as: 'themePackage' })
ThemeActivation.belongsTo(User, { foreignKey: 'appliedBy', as: 'appliedByUser' })
ThemeActivation.belongsTo(User, { foreignKey: 'rolledBackBy', as: 'rolledBackByUser' })
```

### 10.2 Validation

`theme.validation.js` must define strict Joi schemas for:

- Package metadata.
- Theme/design settings.
- Nav settings.
- Footer visual settings.
- Announcement visual settings.
- Homepage section definitions.
- Hero slides.
- Value props.
- Promo banners.
- API request bodies and ID params.

Required rules:

- Reject unknown package keys.
- `schemaVersion` must be `1`.
- Reject `customCSS`, `headScripts`, and `bodyScripts`.
- Maximum package JSON size: 1 MB.
- Maximum 20 tags.
- Maximum 20 homepage sections.
- Maximum 10 hero slides.
- Maximum 12 promo banners.
- Maximum 12 value props.
- Validate internal CTA links beginning with `/` and remote `http`/`https` URLs only.

### 10.3 Settings Service Change Required

The existing `SettingsService.bulkUpdate()` starts its own database transaction. Theme installation needs to write settings and activation history in one transaction.

Modify it to accept an optional transaction:

```js
const bulkUpdate = async (settingsInput, actingUserId, actingUser = null, options = {}) => {
  const { transaction: outerTransaction = null } = options;
  const write = async (transaction) => {
    // existing write loop
  };

  if (outerTransaction) {
    await write(outerTransaction);
  } else {
    await sequelize.transaction(write);
  }
};
```

The normal settings page continues to call `bulkUpdate()` without passing a transaction. Theme install passes its transaction.

### 10.4 Theme Service Methods

`theme.service.js` exports:

| Method | Responsibility |
| --- | --- |
| `listBuiltin()` | Read the three bundled JSON themes |
| `listLibrary(query)` | Return imported/saved `theme_packages` rows |
| `validatePackage(packageData)` | Validate and normalize JSON |
| `preview(packageData, scopes)` | Return merged settings and a diff, without DB writes |
| `importToLibrary(packageData, userId)` | Save a valid custom package |
| `exportCurrent(userId)` | Export current safe storefront design/layout |
| `apply(packageDataOrId, applyOptions, user)` | Apply selected fields atomically and write activation |
| `listActivations()` | Return activation history |
| `rollback(activationId, user)` | Restore `before_snapshot` atomically |
| `removeLibraryTheme(id, userId)` | Delete imported/saved package only |

### 10.5 Atomic Apply Flow

```text
1. Validate package and requested scopes.
2. Build settings rows only for selected scopes.
3. Read current affected settings and save before_snapshot.
4. Start one database transaction.
5. Call SettingsService.bulkUpdate(rows, user.id, user, { transaction }).
6. Read/build after_snapshot.
7. Create theme_activations record in the same transaction.
8. Create audit event in the same transaction.
9. Commit.
```

Failure behavior:

```text
If settings update fails, activation is not saved.
If activation save fails, settings are rolled back.
```

### 10.6 Rollback Flow

```text
1. Load activation by ID.
2. Reject if not found or already rolled back.
3. Start transaction.
4. Convert before_snapshot into settings rows.
5. Restore rows through transaction-aware SettingsService.bulkUpdate().
6. Mark activation rolled_back_at and rolled_back_by.
7. Record audit event.
8. Commit.
```

## 11. API Contract

All theme routes require authentication and settings permissions. The gallery is readable by admins with `SETTINGS_READ`; it is not a public storefront endpoint.

| Method | Route | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/themes/builtin` | `SETTINGS_READ` | List three built-in themes |
| `GET` | `/api/themes/library` | `SETTINGS_READ` | List imported/saved themes |
| `GET` | `/api/themes/activations` | `SETTINGS_READ` | List install history |
| `POST` | `/api/themes/validate` | `SETTINGS_READ` | Validate uploaded package |
| `POST` | `/api/themes/preview` | `SETTINGS_READ` | Preview changes without saving |
| `POST` | `/api/themes/import` | `SETTINGS_MANAGE` | Save package to library |
| `POST` | `/api/themes/export` | `SETTINGS_READ` | Export current safe package |
| `POST` | `/api/themes/apply` | `SETTINGS_MANAGE` | Apply uploaded/built-in package |
| `POST` | `/api/themes/activations/:id/rollback` | `SETTINGS_MANAGE` | Restore previous values |
| `DELETE` | `/api/themes/library/:id` | `SETTINGS_MANAGE` | Delete custom library package |

### Apply Request

```json
{
  "packageData": {},
  "scopes": ["design", "layoutStyle"],
  "replaceDemoContent": false
}
```

### Preview Response

```json
{
  "success": true,
  "data": {
    "mergedSettings": {
      "theme": {},
      "nav": {},
      "footer": {},
      "announcement": {},
      "homepage": {}
    },
    "changes": [
      {
        "group": "theme",
        "key": "primaryColor",
        "before": "#0F766E",
        "after": "#d4af37"
      }
    ]
  }
}
```

### Apply Response

```json
{
  "success": true,
  "data": {
    "activationId": "uuid"
  },
  "message": "Theme applied successfully"
}
```

## 12. Security Prerequisite

The current application has an `advanced` settings group containing:

```text
customCSS
headScripts
bodyScripts
```

These settings can affect or execute code on storefront pages. Before launching theme import:

1. The Advanced settings tab must require `SETTINGS_ADVANCED`.
2. Server writes to the `advanced` settings group must require `SETTINGS_ADVANCED`.
3. Theme packages must never write to the `advanced` group in v1.

This is a prerequisite, not an optional future cleanup.

## 13. Frontend Files

### New Files

```text
client/src/pages/admin/
└── ThemeGalleryPage.jsx

client/src/components/admin/themes/
├── ThemeCard.jsx
├── ThemePreviewModal.jsx
├── ThemeApplyDialog.jsx
├── ThemeImportDialog.jsx
├── ThemeHistoryPanel.jsx
└── StorefrontPreview.jsx

client/src/services/
└── themeService.js
```

### Modified Files

```text
client/src/context/ThemeContext.jsx
client/src/layouts/AdminLayout.jsx
client/src/routes/AppRoutes.jsx
client/src/components/admin/settings/buildSettingsPanels.jsx
client/src/pages/admin/SettingsPage.jsx
```

## 14. Frontend Work Details

### 14.1 `ThemeContext.jsx`

Extract the MUI configuration creation logic into a reusable pure function:

```js
export const buildStorefrontTheme = (themeSettings, customerDarkMode = null) => {
  // return MUI createTheme options object
};
```

The current live storefront continues using it:

```js
const themeConfig = createTheme(buildStorefrontTheme(t, customerDarkMode));
```

The preview component uses the same function, so preview colors and component styles match the real storefront.

### 14.2 `themeService.js`

Provide:

```js
getBuiltinThemes()
getLibraryThemes()
getActivations()
validateTheme(packageData)
previewTheme(packageData, scopes)
importTheme(packageData)
exportTheme()
applyTheme(packageData, scopes, replaceDemoContent)
rollbackTheme(activationId)
removeLibraryTheme(id)
```

### 14.3 `ThemeGalleryPage.jsx`

Page structure:

```text
Theme Gallery
  [Import Theme] [Export Current Theme]

Tabs:
  Built-in Themes | My Library | History

Filters:
  Search | Category

Theme Cards:
  Preview | Apply
```

### 14.4 Preview and Apply

Flow:

```text
Click Preview
  -> POST /api/themes/preview
  -> render StorefrontPreview in modal
  -> show changed settings list
  -> open Apply dialog
  -> choose safe scopes
  -> apply
  -> refresh SettingsContext
```

The modal must not alter live `SettingsContext` while previewing.

### 14.5 Navigation

Add `Theme Gallery` to the Settings group in:

```text
client/src/layouts/AdminLayout.jsx
```

Add protected admin route in:

```text
client/src/routes/AppRoutes.jsx
```

Route:

```text
/admin/themes
```

Permission:

```text
SETTINGS_READ
```

### 14.6 Existing Branding Tab

Keep manual design controls in the Branding tab. Replace inline theme import behavior with:

- `Browse Theme Gallery` button.
- `Export Current Theme` button.

Theme import and install should happen in `/admin/themes`, where preview and scope confirmation are available.

## 15. Built-In Themes for V1

Do not seed twelve themes in the first release. Ship three complete and tested theme JSON files:

| Slug | Name | Category | Design |
| --- | --- | --- | --- |
| `premium-retail` | Premium Retail | general | Light, teal and coral |
| `clean-minimal` | Clean Minimal | general | Light, monochrome and blue |
| `luxury-dark` | Luxury Dark | luxury | Dark, gold and purple |

After install/preview/rollback works reliably, add:

```text
fresh-organic
tech-store
fashion-forward
kids-toys
artisan-craft
sports-pro
bookstore
minimal-dark
vibrant-pop
```

## 16. Build Order

Implement in this order:

1. Secure `advanced.*` setting writes with `SETTINGS_ADVANCED`.
2. Create migration for `theme_packages` and `theme_activations`.
3. Create `ThemePackage` and `ThemeActivation` models.
4. Create strict validation schemas.
5. Make `SettingsService.bulkUpdate()` transaction-aware.
6. Create theme service with preview/apply/rollback.
7. Create controller and routes; mount routes in `server/src/app.js`.
8. Add three built-in JSON theme packages.
9. Write backend tests and verify all endpoints.
10. Extract reusable MUI theme builder from `ThemeContext.jsx`.
11. Create client API service and gallery components.
12. Wire admin route/sidebar.
13. Replace Branding tab import with link to the gallery workflow.
14. Test preview, apply, export, import, and rollback in the browser.

## 17. Verification Plan

### Backend Automated Tests

- Invalid package is rejected.
- Package containing `customCSS`, `headScripts`, or `bodyScripts` is rejected.
- Unsupported theme enum is rejected.
- Preview returns changes and performs no database write.
- Default apply modifies design and layout style only.
- Demo content is unchanged unless explicitly selected.
- Apply creates one activation with before/after snapshots.
- Failed activation creation rolls back setting changes.
- Rollback restores prior settings.
- Built-in/package list requires `SETTINGS_READ`.
- Apply/import/rollback/delete require `SETTINGS_MANAGE`.
- `advanced.*` settings require `SETTINGS_ADVANCED`.

### Browser Verification

- `/admin/themes` displays three built-in themes.
- Preview displays design without changing the surrounding admin UI/storefront.
- Apply dialog leaves content replacement unchecked by default.
- Installing Luxury Dark updates storefront colors and typography.
- Existing homepage banners remain unchanged after default installation.
- Export downloads a `.theme.json` file.
- Import opens preview before applying.
- History tab shows activation.
- Rollback restores the previous appearance.

## 18. Acceptance Criteria

V1 is complete only when:

- Built-in themes can be viewed, previewed, and applied.
- Imported themes are strictly validated.
- Settings remain the live storefront source of truth.
- Install and history write are atomic.
- Every install can be rolled back.
- No theme import can install CSS or JavaScript.
- Marketing content is never replaced unless the admin explicitly chooses it.
- Theme activity is permission-protected and audit logged.

## 19. Final Decision

Build the theme marketplace as a safe design installation system:

```text
Theme package      = reusable design/layout proposal
Settings           = currently active store appearance
Activation history = safety net and rollback
```

This gives admins fast theme switching without risking current promotions, storefront scripts, or unrecoverable configuration changes.
