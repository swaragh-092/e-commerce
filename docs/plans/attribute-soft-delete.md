# Attribute template soft deletion

Deleting a template is blocked while a non-deleted product uses it, either through a
product attribute or a non-deleted variant. Draft, hidden and inactive products/variants
still count. Product status `archived` does not mean that the product was deleted.
Deletion is allowed after all current links are removed or their products are soft-deleted.

An allowed deletion sets `attribute_templates.deleted_at`. Values, product assignments,
variant options, and category links remain in the database. Existing product, cart,
wishlist, enquiry, variant, and API Builder views retain their attribute names and values.
The template list, category suggestions, and new assignments exclude deleted templates.
Stale requests cannot edit a deleted template or its values.

Active names and slugs remain unique. Deleting a template allows a new template to use
the same name and slug, with a new ID and its own values. Existing products continue to
refer to the original ID. Deleting individual values still follows the existing in-use
protection; this change applies to whole templates.

## Applying the change

Apply the migration before starting the updated server:

```sh
npm --prefix server run migrate
```

The migration adds `deleted_at` and replaces the old name/slug uniqueness constraints
with unique indexes for active rows. It preserves all existing rows. Rollback stops
without removing data if archived and active templates now share a name or slug.
There is no restore UI in this change.

The following repair migration restores templates previously soft-deleted while used by
non-deleted products. Original IDs, values and product links are preserved, allowing
the existing product's attribute editor to work again. If a reused name or slug would
conflict with another active/attached template, the repair stops without changing
records and asks for the duplicate to be resolved. It never renames or merges templates.
Its rollback does not re-delete attached templates.

## Verification

```sh
npm --prefix server test -- run tests/unit/attribute.brand.fixes.test.js tests/unit/attribute.service.test.js tests/unit/attribute.units.test.js tests/unit/productAttributeAssignment.test.js tests/unit/variantGenerationPlan.test.js tests/unit/productAttributeOrder.test.js tests/unit/enquiry.variants.test.js tests/unit/wishlist.variants.test.js tests/unit/apiBuilder.public.test.js
npm --prefix server test -- run tests/unit/productVisibility.public.test.js tests/unit/product.storefrontState.test.js tests/unit/productVariantClone.test.js tests/unit/product.catalogValidation.test.js
npm --prefix client test -- src/test/pages/admin/AttributesPage.test.jsx
npm --prefix client run build
```

The PostgreSQL integration test is opt-in. It overrides the application's database
settings and creates a fresh test database in a disposable localhost instance. It must
never be pointed at a shared or production PostgreSQL instance.

```sh
docker run --rm --detach --name attribute-soft-delete-test --publish 127.0.0.1:55439:5432 --env POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
ATTRIBUTE_TEST_POSTGRES_PORT=55439 npm --prefix server test -- run tests/integration/attribute.softDelete.integration.test.js
docker stop attribute-soft-delete-test
```

Wait for PostgreSQL to finish starting before running the integration test. It checks
migration upgrade/rollback, preservation of existing data and variant previews,
same-name/slug reuse, active duplicate rejection, archived-template editing and
assignment rejection, live/deleted product and variant usage, mixed product references,
repair of earlier attached-template deletions, and safe refusal to roll back reused names.

## Files changed for this feature

- `server/migrations/20261030170000-soft-delete-attribute-templates.js`
- `server/migrations/20261030180000-restore-attached-attribute-templates.js`
- `server/src/modules/attribute/attributeTemplate.model.js`
- `server/src/modules/attribute/attribute.service.js`
- `server/src/modules/attribute/productAttribute.service.js`
- `server/src/modules/attribute/productAttributeAssignment.service.js`
- `server/src/utils/slugify.js`
- `server/src/modules/product/product.service.js`
- `server/src/modules/cart/cart.service.js`
- `server/src/modules/wishlist/wishlist.service.js`
- `server/src/modules/enquiry/enquiry.service.js`
- `server/src/modules/apiBuilder/apiBuilder.service.js`
- `client/src/pages/admin/AttributesPage.jsx`
- `server/tests/unit/attribute.brand.fixes.test.js`
- `server/tests/unit/product.catalogValidation.test.js` (corrects the existing route test's middleware position after tag checks were added)
- `server/tests/integration/attribute.softDelete.integration.test.js`
- `client/src/test/pages/admin/AttributesPage.test.jsx`
- `docs/plans/attribute-soft-delete.md`
