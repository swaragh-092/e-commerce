# Smart Install Defaults — Making Templates Feel Like Real Transformations

> Status: Design decision ready for implementation  
> Date: 2026-05-28  
> Problem: Default install only applies colors. Templates feel like presets, not transformations.  
> Solution: Include homepage structure and data sources in default install. Separate safe structure from destructive content.

---

## 1. The Core Problem

Current default install scopes for existing stores:

```
design:           ✅ on
layoutStyle:      ✅ on
homepageSections: ❌ off
dataSources:      ❌ off
demoContent:      ❌ off
```

Result: Installing "Grocery Fresh" on a fashion store just turns it green. The category shortcuts, weekly deals section, delivery value props — none of it appears. The admin sees new colors but the same homepage.

The template's merchandising strategy never lands unless the admin manually checks extra boxes.

---

## 2. Root Cause Analysis

The conservative default was designed to protect existing marketing content. But it over-protects by also blocking **structural** changes that make a template feel like a transformation.

Key insight: **homepage section order is structure, not content**.

Changing from `[hero, categories, featured, promo]` to `[hero, deals, categories, new-arrivals, promo, newsletter]` doesn't destroy anyone's campaign — it reorganizes the page. The hero slides, promo banner copy, and announcement text remain untouched.

Similarly, creating API Builder data sources is **additive** — it doesn't overwrite anything. It creates new endpoints that sections can optionally use.

---

## 3. The Fix: Risk-Based Default Scopes

### 3.1 Risk Classification

| Scope | What it does | Risk | Destructive? |
|-------|-------------|------|-------------|
| `design` | Colors, fonts, radius, button/card styles | Zero | No — visual tokens only |
| `layoutStyle` | Nav sticky, footer/announcement colors | Low | No — styling only |
| `homepageSections` | Section order, types, titles, counts | **Low** | No — doesn't touch content inside sections |
| `dataSources` | Creates API Builder endpoints | **Low** | No — purely additive, creates new endpoints |
| `demoContent` | Replaces hero slides, banners, announcement text | **High** | Yes — overwrites current campaigns |

### 3.2 New Default Scopes

| Store Type | Default Scopes | Rationale |
|-----------|---------------|-----------|
| Empty store (0 orders, <5 products) | design, layoutStyle, homepageSections, dataSources, demoContent | Launch-ready in one click |
| Existing store | design, layoutStyle, homepageSections, dataSources | Full transformation without destroying content |
| Existing store with explicit full install | All scopes | Admin chose "Start Fresh" |

### 3.3 What Changes vs Current Behavior

| Scope | Old Default (existing store) | New Default (existing store) | Why safe |
|-------|------------------------------|------------------------------|----------|
| `homepageSections` | Off | **On** | Only changes section order/types. Hero slides, promo text, announcement copy all stay. |
| `dataSources` | Off (even when available) | **On** | Purely additive. Creates new API endpoints. Doesn't modify or delete existing ones. |
| `demoContent` | Off | Off (unchanged) | Still requires explicit opt-in. This is the only destructive scope. |

---

## 4. Edge Cases and Safety Guarantees

### 4.1 What if the admin has custom homepage sections?

**Scenario**: Admin manually configured 5 sections. Template has 7 different sections.

**Behavior**: Template sections **replace** the section array entirely. The old section order is captured in `beforeSnapshot` and can be rolled back.

**Why this is acceptable**:
- The section array is structural metadata (types, order, titles, counts).
- It does NOT contain the actual content (hero slides, promo banner copy, value prop text).
- Content lives in separate settings keys (`homepage.heroSlides`, `homepage.promoBanners`, etc.).
- Rollback restores the previous section array instantly.

**Mitigation**: The install dialog shows exactly what sections will change:
```
Homepage: 5 sections → 7 sections
Added: Newsletter Signup, Countdown Sale
Reordered: Categories moved before Products
Kept: Your hero slides, promo banners, and announcement text
```

### 4.2 What if a section references a dataSourceKey that doesn't exist?

**Scenario**: Template has `"dataSourceKey": "weekly-deals"` but the dataSources scope was unchecked.

**Behavior**: The live storefront's `HomeExperience.jsx` already handles this:
- If `section.dataSourceSlug` is missing/empty, it falls back to the standard `getProducts()` call using `section.source` (e.g., `featured`, `sale`, `newest`).
- The section still renders with default product data.

**No breakage**: Missing data source = graceful fallback to built-in product fetching.

### 4.3 What if the admin unchecks homepageSections but keeps dataSources?

**Scenario**: Admin only wants colors + data sources, not the section restructure.

**Behavior**: Data sources are created but no section references them yet. They sit idle in API Builder until the admin either:
- Manually adds a section with that `dataSourceKey`, or
- Later installs the same template with `homepageSections` checked.

**No harm**: Unused API Builder endpoints don't affect anything.

### 4.4 What if two templates create conflicting data sources?

**Scenario**: Admin installs "Fashion Drop" (creates `tpl-fashion-drop-new-arrivals`), then installs "Grocery Fresh" (creates `tpl-grocery-fresh-weekly-deals`).

**Behavior**: Each template's data sources are namespaced with the template slug:
- `tpl-fashion-drop-new-arrivals`
- `tpl-grocery-fresh-weekly-deals`

No collision. The second install's homepage sections reference the new template's data sources. The old template's data sources become orphaned but harmless.

**Cleanup**: Rollback of the second install deactivates its data sources. The first template's data sources remain (they were already superseded by the section change).

### 4.5 What if the admin has a running sale campaign in hero slides?

**Scenario**: Admin has "Diwali Sale — 50% Off" as hero slide. Installs "Luxury Dark" template.

**With new defaults** (demoContent OFF):
- ✅ Colors change to dark/gold
- ✅ Homepage restructures to luxury layout
- ✅ Data sources created for luxury product rows
- ✅ **Diwali Sale hero slide stays untouched**
- ✅ **Promo banners stay untouched**
- ✅ **Announcement text stays untouched**

The store looks like a luxury store running a Diwali sale. This is the correct behavior.

### 4.6 What if the template has fewer sections than current?

**Scenario**: Current store has 8 sections. Template has 5 sections.

**Behavior**: The section array is replaced with the template's 5 sections. Sections that existed before but aren't in the template simply stop rendering.

**Important**: No data is deleted. The content (hero slides, promo banners, value props) still exists in their respective settings keys. Only the section array (which controls what renders and in what order) changes.

**Rollback**: Restores the previous 8-section array. Everything reappears.

### 4.7 What about sections with inline items?

**Scenario**: Template section has `"items": [{ "title": "Fast Delivery", ... }]` embedded in the section definition.

**Behavior**: These inline items are part of the section structure, not the `demoContent` scope. They are applied when `homepageSections` is checked.

**Distinction**:
- `homepageSections` scope: section array including inline `items` for value-props, trust-badges, etc.
- `demoContent` scope: top-level content arrays (`heroSlides`, `promoBanners`, `valueProps`, `announcementText`).

**Rule**: If a section type carries its own content inline (like trust-badges with items), that content travels with the section structure. This is intentional — the section wouldn't make sense without its items.

### 4.8 What if the store has custom API Builder definitions?

**Scenario**: Admin manually created API Builder endpoints for their own use.

**Behavior**: Template data sources use namespaced slugs (`tpl-{template-slug}-{key}`). They never collide with admin-created definitions.

**Conflict detection**: If a slug already exists and is NOT template-owned (no ownership marker in description), the install throws a 409 error:
```
API Builder slug 'tpl-fashion-drop-new-arrivals' already exists and is not owned by this template.
```

This only happens if someone manually created a definition with the exact template-namespaced slug, which is extremely unlikely.

### 4.9 What if the admin rolls back after editing the homepage?

**Scenario**: Admin installs template, then manually edits some sections, then rolls back.

**Behavior**: Rollback restores the `beforeSnapshot` — the state before the template was installed. Any manual edits made after install are lost.

**Mitigation**: The rollback confirmation should warn:
```
This will restore your store to the state before "Grocery Fresh" was installed.
Any changes made after installation will be lost.
```

### 4.10 What about the "Start Fresh" button?

**Scenario**: Admin clicks "Start Fresh" on an existing store with active campaigns.

**Behavior**: Applies ALL scopes including `demoContent` with `replaceDemoContent: true`. This is the nuclear option.

**Safety**:
- The button is clearly labeled and positioned as a secondary action.
- The full `beforeSnapshot` is saved in activation history.
- One-click rollback restores everything.
- The install dialog already shows a warning when demo content replacement is selected.

---

## 5. UI Presentation

### 5.1 Install Dialog Layout (Two-Tier)

```
┌─────────────────────────────────────────────────────────┐
│ Install Template: Grocery Fresh                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ━━━ Applied by default (safe, non-destructive) ━━━━━━━ │
│                                                         │
│ ✅ Design: colors, fonts, component styles              │
│ ✅ Layout styling: navigation, footer, announcement     │
│ ✅ Homepage structure: 7 sections                       │
│    (category shortcuts, weekly deals, fresh produce,    │
│     promo banners, value props, newsletter, brands)     │
│ ✅ Data sources: 2 dynamic product endpoints            │
│                                                         │
│ ━━━ Optional (replaces existing content) ━━━━━━━━━━━━━ │
│                                                         │
│ ☐ Replace demo content: hero slides, banners,          │
│   value props, announcement text                        │
│                                                         │
│ ⚠️ Your current campaigns will be overwritten.          │
│    Previous content is saved and can be restored.       │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ 🚀 Start Fresh          [Cancel]    [Install Template] │
└─────────────────────────────────────────────────────────┘
```

### 5.2 Empty Store Dialog

```
┌─────────────────────────────────────────────────────────┐
│ Install Template: Grocery Fresh                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🚀 Your store is empty — we recommend a full install    │
│    for a launch-ready homepage.                         │
│                                                         │
│ ✅ Design: colors, fonts, component styles              │
│ ✅ Layout styling: navigation, footer, announcement     │
│ ✅ Homepage structure: 7 sections                       │
│ ✅ Data sources: 2 dynamic product endpoints            │
│ ✅ Demo content: hero slides, banners, value props      │
│                                                         │
│ All scopes selected for a complete launch experience.   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                         [Cancel]    [Install Template]   │
└─────────────────────────────────────────────────────────┘
```

### 5.3 What Will Change Summary

Show a brief impact summary above the checkboxes:

```
What will change:
• Homepage: 4 sections → 7 sections
• New sections: Category Shortcuts, Weekly Deals, Newsletter
• Data: 2 new product endpoints created
• Kept: Your hero slides, promo banners, announcement text
```

---

## 6. Implementation Changes Required

### 6.1 ThemeApplyDialog.jsx

Change the default scope initialization for existing stores:

```javascript
// OLD: existing store defaults
const nextScopes = ['design', 'layoutStyle'];

// NEW: existing store defaults (structure is safe)
const nextScopes = ['design', 'layoutStyle', 'homepageSections'];
if (dataSourceCount) nextScopes.push('dataSources');
```

For empty stores (already implemented):
```javascript
// Empty store: everything on
const all = ['design', 'layoutStyle', 'homepageSections'];
if (dataSourceCount) all.push('dataSources');
setScopes(all);
setReplaceDemoContent(true);
```

### 6.2 Backend: No Changes Needed

The backend already supports all scopes. The change is purely in the frontend default selection. The server doesn't enforce default scopes — it applies whatever scopes the client sends.

### 6.3 Documentation Update (Section 18)

Update the install semantics table:

| Scope | Writes To | Default Existing Store | Default Empty Store |
|-------|-----------|----------------------|-------------------|
| design | theme.* | On | On |
| layoutStyle | nav.*, footer, announcement visual keys | On | On |
| homepageSections | homepage.sections | **On** | On |
| dataSources | API Builder definitions | **On (when available)** | On |
| demoContent | hero/value/promo content, announcement text | Off | On with confirmation |
| pageTemplates | future product/collection/page layouts | Off | On |

---

## 7. Rollback Guarantees

Every install creates a complete `beforeSnapshot` containing:
- All affected settings groups (theme, nav, footer, announcement, homepage)
- The exact section array before the change
- All content keys (heroSlides, promoBanners, valueProps, announcementText)

Rollback atomically:
1. Restores all settings from `beforeSnapshot`
2. Deactivates template-created API Builder definitions
3. Marks the activation as rolled back
4. Writes audit log

**Time to rollback**: One click, instant effect.

**What rollback restores**:
- Previous section order and types
- Previous colors and styles
- Previous layout settings
- Previous content (if it was overwritten)

**What rollback does NOT restore**:
- Manual edits made after the template install (those are lost)
- Products, orders, or other business data (never touched by templates)

---

## 8. Competitor Comparison After This Change

| Behavior | Shopify | Wix | Us (after fix) |
|----------|---------|-----|----------------|
| Template changes page structure | ✅ | ✅ | ✅ |
| Template changes data sources | ✅ (metaobjects) | ✅ (datasets) | ✅ (API Builder) |
| Existing content protected | ❌ (full replace) | ❌ (full replace) | ✅ (content opt-in only) |
| One-click rollback | ❌ | ❌ | ✅ |
| Preview before install | ✅ | ✅ | ✅ |
| Scoped install | ❌ | ❌ | ✅ |

Our advantage: **safer than competitors** while still delivering full transformation. Shopify and Wix replace everything. We replace structure but preserve content by default.

---

## 9. Success Criteria

After implementing this change:

- [ ] Installing any template on an existing store changes the homepage section layout
- [ ] Existing hero slides, promo banners, and announcement text survive a default install
- [ ] Data sources are created automatically when available
- [ ] The admin sees a clear two-tier dialog (safe defaults vs destructive content)
- [ ] Empty stores get full install by default
- [ ] Rollback restores the previous state completely
- [ ] No edge case breaks the live storefront (missing data sources fall back gracefully)

---

## 10. Migration Path

This is a **frontend-only change** to default checkbox state. No migration needed.

- Existing activations are unaffected.
- The backend API contract doesn't change.
- Templates that were previously installed with only design+layoutStyle can be reinstalled with the new defaults to get the full effect.
- No database changes required.
