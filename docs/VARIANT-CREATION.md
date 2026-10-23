# Customize product combinations

Select Variable Product and save it first. Open its Attributes and Variants section, assign the desired attribute
values, and enable Use for variants. Click Create variants to open the review.

Each new combination has a checkbox, MRP, and Stock field:

- Keep the checkbox selected to create the combination.
- Enter a separate MRP and stock quantity for each combination.
- Uncheck combinations you do not sell. Their inputs are disabled and they are
  not created. Rechecking restores your draft inputs.
- Bulk defaults fill fields you have not edited individually. Changing a default
  preserves individual overrides. Apply defaults to selected resets overrides
  for selected combinations only.
- Select all new and Deselect all new affect all new combinations, including
  combinations hidden by search.
- Search appears when there are more than six combinations. Filtering does not
  change which combinations will be created.
- The footer count shows how many new variants will be created. Check the new
  stock total before submitting.

For example, create Red / Small at MRP 200 with stock 5, Red / Large at MRP 250
with stock 3, and skip Blue / Small if you do not sell it.

Existing matching variants are marked Already exists and keep their saved price,
stock, SKU, images, and availability. To edit them, return to the Variant SKUs
list, expand Edit on the desired combination, and click Save variant changes
after editing. Skipped combinations can be added later using Add missing variants.

The review supports the existing maximum of 500 possible combinations. Prices
must be nonnegative, with up to two decimals; stock must be a nonnegative whole
number. The server also validates aggregate stock, the review token, duplicate
combinations, and membership in the product's current options. Stale reviews must
be reopened. Existing reserved units still prevent removal of their variants.
Failed requests preserve the review's input values for retry. No migration is
required; restart the backend if it does not reload source changes automatically.

## Implementation and verification

Files changed for this feature:

- `client/src/components/admin/VariantSetup.jsx`
- `client/src/test/components/VariantSetup.test.jsx`
- `server/src/modules/attribute/variantGenerationPlan.js`
- `server/src/modules/attribute/productAttribute.validation.js`
- `server/src/modules/attribute/attribute.service.js`
- `server/tests/unit/variantGenerationPlan.test.js`
- `docs/VARIANT-CREATION.md`

The generation API accepts an optional `newVariants` array containing `valueIds`,
`price`, and `stockQty`, with a required plan token. Only selected, missing
combinations are inserted, in one transaction with stock synchronization. Legacy
requests using default values continue to work. The preview now returns every
combination and its value identifiers, rather than truncating at twelve.

Repeat the focused checks from the repository root:

```bash
cd client
npm test -- src/test/components/VariantSetup.test.jsx src/test/components/ProductVariantsPanel.test.jsx
npm run build
cd ../server
npm test -- --run tests/unit/variantGenerationPlan.test.js tests/unit/productAttributeAssignment.test.js tests/unit/inventory.variant.stock.test.js
```

The focused automated tests passed: 32 client tests and 48 backend tests.
Verification covers component interactions and service logic with database mocks;
it does not include a live browser or a write to the store's database.
