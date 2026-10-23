# Product type and inventory

| Type | Editor | Stock entry |
| --- | --- | --- |
| Simple | Product price, SKU, and stock | Enter a standalone stock quantity |
| Variable | Attributes and Variants, after saving the type | Enter stock and MRP on each combination |
| Combo | Bundle builder, after saving the type | Manage stock on component products/variants |

## Variable product workflow

1. Select Variable Product and Save Product.
2. Assign attribute values in Attributes and Variants and enable Use for variants.
3. Review combinations, choose the ones to create, and set individual MRP/stock.
4. Total variant stock in Inventory is read-only and sums active variants. Inactive
   variants do not add sellable stock; reservations still remain protected by the
   inventory service. An empty Variable product shows zero stock.
5. Expand Edit on a saved variant to change its price or stock, then Save variant
   changes. Saving the parent product does not submit manual aggregate stock.

The API allows the initial Variable product to be saved without inline variants.
It rejects variant generation/creation for Simple and Combo products, and rejects
manual product-total stock adjustments for Variable/Combo products. Attribute
specifications can still exist as display-only data; marking an attribute for
variants requires the Variable type. The admin variant panel is shown only for
saved Variable products.

Cart and checkout require a variant for Variable products even if none are active.
They cannot fall back to stale parent stock. The product page calculates available
Variable stock from active variants, deducting reservations.

## Changing types

- A Simple product with standalone stock requires explicit confirmation before
  converting to Variable or Combo. Its standalone stock is cleared through the
  inventory adjustment ledger. Existing units are not assigned to combinations
  automatically; review and enter the desired stock per variant/component.
- A Simple product already containing legacy variants can be corrected using
  Use Variable Product and Save Product. Its variants and their stock stay intact.
  No database migration or automatic conversion is performed by this code change.
- Remove all variants, including inactive ones, before changing Variable to Simple
  or Combo. Clear bundle items before changing away from Combo. Active product
  reservations block type changes.
- Product updates cannot replace existing variant records wholesale; use the
  variant editor. This preserves existing identifiers and historical references.
- Bundle components that are Variable products must specify an active variant.

Type changes serialize with variant generation and bundle editing. No records in
the running store were changed while implementing these rules.

## Changed files for this task

- `client/src/pages/admin/ProductEditPage.jsx`
- `client/src/components/admin/ProductVariantsPanel.jsx`
- `client/src/pages/storefront/ProductDetailPage.jsx`
- `client/src/test/pages/admin/ProductEditPage.test.jsx` (new)
- `server/src/modules/product/productType.js` (new)
- `server/src/modules/product/product.service.js`
- `server/src/modules/product/product.validation.js`
- `server/src/modules/product/productCombo.service.js`
- `server/src/modules/attribute/attribute.service.js`
- `server/src/modules/attribute/productAttribute.service.js`
- `server/src/modules/attribute/productAttributeAssignment.service.js`
- `server/src/modules/inventory/inventory.service.js`
- `server/src/modules/cart/cart.service.js`
- `server/src/modules/order/order.service.js`
- `server/tests/unit/productType.test.js` (new)
- `server/tests/unit/productAttributeAssignment.test.js`
- `server/tests/unit/variantGenerationPlan.test.js`
- `docs/VARIANT-CREATION.md`
- `docs/PRODUCT-TYPES.md` (this guide)

## Repeatable checks

From the repository root:

```bash
cd client
npm test -- src/test/pages/admin/ProductEditPage.test.jsx src/test/components/ProductVariantsPanel.test.jsx src/test/components/VariantSetup.test.jsx src/test/components/VariantSelector.test.jsx src/test/components/ProductAttributeDialog.test.jsx
npm run build
cd ../server
npm test -- --run tests/unit/productType.test.js tests/unit/variantGenerationPlan.test.js tests/unit/productAttributeAssignment.test.js tests/unit/admin.inventory.test.js tests/unit/order.service.test.js tests/unit/order.guestFulfillment.test.js
```

The production build and focused client/backend tests passed. The broader backend
unit run passed 695 of 696 tests, with an unrelated existing failure in
`user.auth.fixes.test.js`: it searches source for `emailVerified: true`, while the
committed staff-invitation implementation uses `emailVerified: !sendInvitation`.
That file and the staff implementation were left unchanged.

Verification uses automated UI tests and database mocks. It does not include a
live browser session, actual database writes, or concurrent database load tests.
