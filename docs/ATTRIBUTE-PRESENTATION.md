# Attribute types and display styles

Value Type describes an option's meaning. Display Style controls the selector a
customer sees on the product page. These settings belong to a reusable attribute
template, so saving a change affects products using that template after reload.

For example, Color can have Red and Blue values. With Value Type set to Color,
Auto display uses color swatches. Change only Display Style to Dropdown and the
same Red and Blue choices become a menu. Prices, stock, and variant combinations
do not change when you change the style.

## Automatic choices

Auto Value Type checks keywords in the name and slug, not the value contents.
An explicit Value Type takes priority. Unknown names fall back to Text.

| Value Type | Auto display without images |
| --- | --- |
| Color, Pattern | Swatches |
| Size, Weight, Length / Dimension, Storage, Volume | Buttons |
| Material, Number, Text | Chips for up to eight choices; dropdown above eight |

If any value in the product's variant choices has an image URL, Auto display
chooses image swatches first. Explicit Display Style overrides all auto rules.
The count and image rules use the product's variant values, not every value in
the template's library.

| Display Style | Customer experience |
| --- | --- |
| Color swatches | Colored circles; labels when no color is available |
| Image swatches | Image thumbnails; color or label fallback for missing images |
| Buttons | Rectangular labeled buttons |
| Chips | Compact rounded labels |
| Radio buttons | Labeled radio choices |
| Dropdown | A select menu |
| Text labels | Clickable text, with the selection underlined |

Every style selects the same variants and respects available stock. These styles
apply to variant choices. The specifications table uses text, and cart/order
summaries use labels rather than recreating the product's selector.

Value Type does not enforce numeric input, convert units, assign prices, create
variants, or automatically choose a Unit category. Unit category controls the
available units; each value stores its own unit. Number and Text currently share
the same automatic display rules.

## Try it in the admin

1. Open Catalog > Attributes and create or edit an attribute.
2. Enter Color and leave both settings on Auto detect. The Storefront preview
   reports Color and Swatch. New attributes use unsaved sample values.
3. Change Display Style to Dropdown, Buttons, or Text labels and try a selection.
4. Editing an attribute with saved values previews those values instead.
5. To see it on a real product, assign its values, enable their use for variants,
   create the variants, and give them prices and available stock. Reload the
   product page after saving template changes.

Preview selections do not save anything or create variants. A product using only
some template values can resolve a different automatic style than the preview.

## Audit and fixes

Reviewed template validation/storage, product assignment, variant option API
includes, client grouping, selector rendering, admin value entry, specifications,
and cart/wishlist label data. The API includes the template settings and value
presentation fields. Fixed text labels rendering as outlined buttons, explicit
color swatches using images, blank swatches without visuals, dropdown labels,
chip disabled/selected semantics, false keyword matches such as Ceramic matching
RAM, inconsistent admin Color detection, and selected specifications losing
formatted units/display labels. Added helper text and the real storefront selector
as an interactive admin preview.

Implementation files changed in this audit:

- `client/src/utils/attributePresentation.js`
- `client/src/components/product/VariantSelector.jsx`
- `client/src/components/admin/ProductAttributeDialog.jsx`
- `client/src/components/admin/AttributePresentationPreview.jsx` (new)
- `client/src/pages/admin/AttributesPage.jsx`
- `client/src/pages/storefront/ProductDetailPage.jsx`
- `client/src/test/utils/attributePresentation.test.js` (new)
- `client/src/test/components/VariantSelector.test.jsx` (new)
- `client/src/test/pages/admin/AttributesPage.test.jsx`
- `docs/ATTRIBUTE-PRESENTATION.md` (this guide)

The earlier dialog layout/cancel changes and
`client/src/test/components/ProductAttributeDialog.test.jsx` remain in the working
tree.

Repeat the automated checks from the repository root:

```bash
cd client
npm test -- src/test/utils/attributePresentation.test.js src/test/components/VariantSelector.test.jsx src/test/components/ProductAttributeDialog.test.jsx src/test/pages/admin/AttributesPage.test.jsx
npm run build
cd ../server
npm test -- --run tests/unit/attribute.service.test.js tests/unit/attribute.brand.fixes.test.js tests/unit/productAttributeAssignment.test.js tests/unit/attribute.units.test.js tests/unit/variantGenerationPlan.test.js
```

Verification uses automated component/unit tests and a production build. It does
not include a browser session against the live store or remote image availability.
