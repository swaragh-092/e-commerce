# Product attribute display order

In Product attributes, use the handle next to an attribute name to move its whole
card. Use a value's handle to change its position within that attribute. Values
cannot be moved to another attribute. Numbered cards show the attribute order;
values use a vertical list so drop positions remain clear on small screens.

Order saves automatically after dropping. Keyboard users can focus a handle,
press Space to pick it up, use the arrow keys, and press Space to drop (Escape
cancels). Reordering is disabled while a request is pending and for users without
attribute management permission. A failed save restores the previous local order.

The order belongs to this product only. Reusable template/value ordering and other
products are unchanged. Reordering does not recreate variants, change their IDs,
or change prices, stock, or the chosen variant combinations. Newly assigned
attributes/values append after saved assignments instead of resetting order to 0.

## Reading order in another frontend

The other frontend is not available in this workspace. Its integration should use
the main product detail response or the product variants response as follows.

`product.attributes` contains product assignment rows in ascending `sortOrder`.
Each row includes its assignment `id`, `attributeId`, `valueId`, `attribute`, and
`value`. This `sortOrder` is product-specific; the nested
`attribute.sortOrder` / `value.sortOrder` belong to the reusable template and must
not override the product assignment order.

For example, a saved order can be:

```json
[
  { "id": "assignment-blue", "attributeId": "color", "valueId": "blue", "sortOrder": 0 },
  { "id": "assignment-red", "attributeId": "color", "valueId": "red", "sortOrder": 1 },
  { "id": "assignment-small", "attributeId": "volume", "valueId": "small", "sortOrder": 2 }
]
```

Group assignments by attribute, retaining their first-appearance order. Values
retain their assignment order within the group. An example implementation:

```js
const groups = new Map();
for (const row of [...(product.attributes || [])].sort((a, b) => a.sortOrder - b.sortOrder)) {
  const key = row.attributeId || `custom:${row.customName.trim().toLowerCase()}`;
  if (!groups.has(key)) groups.set(key, { attribute: row.attribute, name: row.attribute?.name || row.customName, values: [] });
  groups.get(key).values.push(row.value || { value: row.customValue });
}
const orderedGroups = [...groups.values()];
```

New values for an existing attribute can append after other assignment rows in
storage. Grouping by first appearance keeps the attribute in its saved position
and places its new values last within that group.

Product detail `variants[*].options[*]` and the authenticated product variants
endpoint also expose:

- `attributeOrder`: the product-specific position of the attribute group.
- `valueOrder`: the product-specific position of that value within the attribute.

Variant `options` are returned in attribute order. When building a selector across
many variants, sort the merged attribute groups by `attributeOrder`, and each
group's deduplicated values by `valueOrder`. Do not rely on which variant happens
to appear first. Only show values belonging to the product's available variants;
product attributes can also contain display-only specifications.

The storefront included in this repository now follows this order for variant
selectors and specifications. Historical order snapshots are not rewritten.

## Saving order through the admin API

```http
PUT /api/products/:id/attributes/reorder
Content-Type: application/json

{ "rowIds": ["<assignment UUID>", "<assignment UUID>"] }
```

The list must contain every current assignment ID exactly once, with each
attribute's values together. The endpoint requires attribute-management
permission. IDs must be UUIDs (the illustrative names above are not real IDs).
It saves zero-based `sortOrder` values in one transaction and returns the refreshed
assignment list in the standard API response envelope. Missing, duplicate, foreign,
or stale assignment sets are rejected; a changed set returns 409 so the admin can
refresh before reordering. No database migration is needed.

## Changed files and checks

- `client/src/components/admin/ProductAttributesSection.jsx`
- `client/src/services/attributeService.js`
- `client/src/utils/variantOptions.js`
- `client/src/test/components/ProductAttributesOrder.test.jsx` (new)
- `server/src/modules/attribute/productAttributeOrder.js` (new)
- `server/src/modules/attribute/productAttribute.service.js`
- `server/src/modules/attribute/productAttributeAssignment.service.js`
- `server/src/modules/attribute/productAttribute.validation.js`
- `server/src/modules/attribute/productAttribute.routes.js`
- `server/src/modules/attribute/productAttribute.controller.js`
- `server/src/modules/attribute/attribute.service.js`
- `server/src/modules/product/product.pricing.js`
- `server/tests/unit/productAttributeOrder.test.js` (new)
- `server/tests/unit/productAttributeAssignment.test.js`
- `docs/PRODUCT-ATTRIBUTE-ORDER.md` (this guide)

Run from the repository root:

```bash
cd client
npm test -- src/test/components/ProductAttributesOrder.test.jsx src/test/components/ProductVariantsPanel.test.jsx src/test/components/VariantSelector.test.jsx
npm run build
cd ../server
npm test -- --run tests/unit/productAttributeOrder.test.js tests/unit/productAttributeAssignment.test.js tests/unit/attribute.brand.fixes.test.js tests/unit/product.pricing.test.js tests/unit/variantGenerationPlan.test.js
```

Verification covers drag-result handlers, failed saves, disabled controls, API
validation, product-scoped writes, serialization, and storefront grouping. A
production build also passes. It does not include a live browser/touch session or
changes to the separate frontend that is absent from this workspace.
