# Copying variants from another product

The old error about "SKU-defining attributes" referred to attributes such as
Color and Size, not to the product's SKU code. The old copy operation required
those attributes to be assigned manually on the target, did not check exact value
assignments, and inserted the same combinations again when retried. New variants
also had blank SKUs. The dialog did not explain these requirements.

## Current behavior

Save the target as Variable Product, open Copy from product, then search by product
name or product SKU or browse by category. Only other products with variants are
offered. The server filters these before pagination. Search requests require two
characters and stale responses cannot replace the latest search results.

Click Clone Variants to copy:

| Data | Behavior |
| --- | --- |
| Required attributes and values | Automatically assigned to the target using existing reusable templates/values |
| Attribute/value order | New assignments follow source display order; existing target assignments keep their order |
| Option combinations | Only missing combinations are created |
| MRP | Copied for new combinations; existing target prices stay unchanged |
| Variant shipping measurements | Copied; null measurements inherit from the target product |
| Active/inactive state | Copied for new combinations |
| Stock and reserved stock | Start at zero for new combinations; existing target inventory is preserved |
| Variant SKU | A fresh unique code is generated for each new combination |
| Variant photos | Not copied; add target-specific photos afterward |

Attribute swatches remain available because the copied assignments reference the
same reusable attribute values. Display-only source specifications that are not
part of a variant combination are not copied.

After copying, both attribute assignments and variants refresh. The notification
reports how many variants were created and how many were skipped. Repeating the
copy, including after a lost response, does not create duplicate combinations or
overwrite existing prices, SKUs, stock, or reservations. A later copy can add new
source combinations without synchronizing previously copied combinations.

## SKU rules

A product SKU identifies the product family; a variant SKU identifies one
combination. Having a product SKU does not mean its Color/Size values have already
been assigned. A missing product SKU does not prevent copying.

New copied SKUs use the target product SKU (or its name as a fallback), followed by
a UUID suffix. They fit the 100-character limit and remain editable. Source SKUs
are never reused because variant SKUs have a database uniqueness constraint.
Existing target SKUs remain unchanged. Manually entered duplicate SKUs within the
target product are highlighted before saving; conflicts with other products'
variants are also enforced by the database and reported through the API.

The clone operation generates its own unique SKUs; the optional auto-generate
button in the variant editor continues to use the store's configurable SKU format.

## Validation and transaction safety

- The target must be a saved Variable Product; self-copy and bundle sources are
  rejected. Legacy Simple products containing variants can still act as sources.
- Source combinations must have complete, consistent attribute dimensions, and
  every value must belong to the referenced attribute.
- Existing target variants must use the same dimensions. Other target attributes
  enabled for variants must be turned off first if they conflict. Display-only
  specifications can remain.
- The resulting target cannot exceed 500 variants.
- Attribute assignments, new variants/options, and stock synchronization happen
  in one transaction. Locks serialize copy requests and protect current source and
  target variant state. No existing variants or source products are deleted.
- The dialog prevents cancellation or changing sources while copying. Errors
  preserve the selected source for retry.

The clone endpoint keeps the existing variants array in `data` and adds summary
counts in `meta`: `createdCount`, `skippedCount`, and `addedAssignments`.
No migration is required. Restart the backend if it does not reload source changes.

## Changed files

- `client/src/components/admin/ProductVariantsPanel.jsx`
- `client/src/test/components/ProductVariantsPanel.test.jsx`
- `server/src/modules/attribute/productVariantClone.service.js` (new)
- `server/src/modules/attribute/attribute.service.js`
- `server/src/modules/attribute/attribute.controller.js`
- `server/src/modules/product/product.controller.js`
- `server/src/modules/product/product.service.js`
- `server/src/modules/product/product.validation.js`
- `server/tests/unit/productVariantClone.test.js` (new)
- `docs/VARIANT-COPY.md` (this guide)

## Verification

From the repository root:

```bash
cd client
npm test -- src/test/components/ProductVariantsPanel.test.jsx src/test/components/VariantSetup.test.jsx src/test/pages/admin/ProductEditPage.test.jsx
npm run build
cd ../server
npm test -- --run tests/unit/productVariantClone.test.js tests/unit/productType.test.js tests/unit/variantGenerationPlan.test.js tests/unit/product.search.validation.test.js
```

The focused client tests, backend tests, and production build passed. Tests cover
empty targets, exact assignments and ordering, retries, existing stock/SKU
preservation, new unique SKUs, invalid dimensions, variant limits, both source
picker paths, stale search responses, and duplicate SKU feedback. Verification
uses mocked database operations and automated UI tests, not a live browser or
database concurrency run. No running-store products were changed during the fix.
