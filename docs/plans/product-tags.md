# Product tags

## Merchant workflow

Reuse the existing tags and product_tags tables. Tags are flat labels shared across
categories; attributes continue to describe specifications and variants.

- Add/remove tags in the product editor, with searchable existing suggestions and inline creation.
- Manage tags under Catalog > Tags, with search, pagination, live product counts,
  renaming, and a confirmation explaining that deletion only unlinks products.
- Filter admin products by tag and open the same group from storefront product chips.
- Use tag slugs in URLs; keep legacy exact-name API filters working.

## Decisions

- Use existing products.read/create/update/delete permissions. Reading suggestions
  requires any product read/create/update permission; global rename requires update,
  deletion requires delete. Public users cannot enumerate unused/internal tags.
- Normalize Unicode and whitespace, reject blank/control/comma names, limit names to
  100 characters and products to 50 tags, and deduplicate case-insensitively.
- Serialize tag dictionary mutations with a PostgreSQL transaction advisory lock,
  including product saves, to prevent concurrent case/slug duplicates without
  rewriting or deleting legacy tag data. Existing duplicate records are not merged.
- Renames preserve the slug so existing links remain valid. New slugs use the
  existing slug generator with a UUID fallback for names without Latin characters.
- An omitted tags field preserves associations; [] explicitly clears them.
- Filters use a product-id subquery, so products retain all their tags and aggregate
  price ranges/counts use the identical predicate. Multiple tags match ANY.
- Landing pages use a lightweight TagPage wrapper around the existing catalog page,
  preserving its layout, sorting, pagination and filters.

## Validation

Cover normalization and API limits; service reuse/concurrent-write protection;
assignment clearing/preservation; permissions; tag editor selection and failures;
management create/rename/delete; public URL propagation. Run focused existing
product/search/permission checks and the frontend production build.

## Later extensions

Automatic collections can build on this workflow when merchants need them.

## Commands to verify

From the repository root:

```bash
(cd server && npm test -- --run tests/unit/product.tags.test.js tests/unit/product.tags.bulk.test.js tests/unit/product.tags.public.test.js tests/unit/seo.tags.test.js tests/unit/seo.prerender.test.js tests/unit/product.search.validation.test.js tests/unit/product.catalogValidation.test.js tests/unit/search.repository.test.js tests/unit/permissions.config.test.js tests/unit/productType.test.js)
(cd client && npm test -- src/test/components/ProductTagsInput.test.jsx src/test/components/BulkProductTagsDialog.test.jsx src/test/components/ProductTagFilter.test.jsx src/test/pages/admin/TagsPage.test.jsx src/test/pages/storefront/ProductListPage.tags.test.jsx src/test/pages/storefront/TagPage.test.jsx src/test/pages/admin/ProductEditPage.test.jsx src/test/pages/admin/ProductEditPage.validation.test.jsx src/test/pages/admin/ProductsManagePage.test.jsx src/test/utils/permissions.test.js)
(cd client && npm run build)
```

An optional PostgreSQL integration test uses an isolated temporary cluster and an
empty `ecommerce_tags_test` database. It is skipped in normal test runs. It never
uses the application's configured database. To reproduce on Linux with PostgreSQL
16 installed (creates a fresh cluster and leaves the test data under /tmp):

```bash
tag_pg_dir=$(mktemp -d /tmp/ecommerce-tags-pg.XXXXXX)
/usr/lib/postgresql/16/bin/initdb -D "$tag_pg_dir/data" -U tag_test_admin --auth=trust --no-locale
/usr/lib/postgresql/16/bin/pg_ctl -D "$tag_pg_dir/data" -l "$tag_pg_dir/server.log" -o "-F -k $tag_pg_dir -h '' -p 55438" start
psql -h "$tag_pg_dir" -p 55438 -U tag_test_admin -d postgres -c 'CREATE DATABASE ecommerce_tags_test'
(cd server && TAG_TEST_POSTGRES_SOCKET="$tag_pg_dir" npm test -- --run tests/integration/product.tags.integration.test.js)
/usr/lib/postgresql/16/bin/pg_ctl -D "$tag_pg_dir/data" stop
```

The integration check covers concurrent product saves, usage counts excluding
soft-deleted products, stable slugs after renaming, actual filter SQL, clearing and
preserving assignments, and deletion cascades that leave all products intact.

## Files changed

Architecture: [ADR-0009](../adr/0009-product-tag-management-and-public-archives.md).

- `docs/adr/0009-product-tag-management-and-public-archives.md`

Frontend:
- `client/src/components/admin/ProductTagsInput.jsx`
- `client/src/components/admin/BulkProductTagsDialog.jsx`
- `client/src/components/admin/ProductTagFilter.jsx`
- `client/src/pages/admin/TagsPage.jsx`
- `client/src/pages/storefront/TagPage.jsx`
- `client/src/services/tagService.js`
- `client/src/layouts/AdminLayout.jsx`
- `client/src/pages/admin/ProductEditPage.jsx`
- `client/src/pages/admin/ProductsManagePage.jsx`
- `client/src/pages/storefront/ProductDetailPage.jsx`
- `client/src/pages/storefront/ProductListPage.jsx`
- `client/src/routes/AppRoutes.jsx`
- `client/src/utils/permissions.js`

Backend:
- `server/src/app.js`
- `server/src/middleware/crawlerPrerender.middleware.js`
- `server/src/modules/seo/seo.service.js`
- `server/src/modules/brand/brand.service.js`
- `server/src/modules/apiBuilder/apiBuilder.service.js`
- `server/src/modules/product/tag.model.js`
- `server/migrations/20261028100000-add-tag-description.js`
- `server/src/modules/product/tag.utils.js`
- `server/src/modules/product/tag.validation.js`
- `server/src/modules/product/tag.service.js`
- `server/src/modules/product/tag.routes.js`
- `server/src/modules/product/product.service.js`
- `server/src/modules/product/product.validation.js`

Checks:
- `server/tests/unit/product.tags.test.js`
- `server/tests/unit/product.tags.bulk.test.js`
- `server/tests/unit/product.tags.public.test.js`
- `server/tests/unit/seo.tags.test.js`
- `server/tests/integration/product.tags.integration.test.js`
- `client/src/test/components/ProductTagsInput.test.jsx`
- `client/src/test/components/BulkProductTagsDialog.test.jsx`
- `client/src/test/components/ProductTagFilter.test.jsx`
- `client/src/test/pages/admin/TagsPage.test.jsx`
- `client/src/test/pages/storefront/ProductListPage.tags.test.jsx`
- `client/src/test/pages/storefront/TagPage.test.jsx`
- `client/src/test/pages/admin/ProductEditPage.test.jsx`
- `client/src/test/pages/admin/ProductEditPage.validation.test.jsx`
- `client/src/test/pages/admin/ProductsManagePage.test.jsx`

Documentation:
- `docs/API.md`
- `docs/FEATURES.md`
- `docs/SEO.md`
- `docs/plans/product-tags.md`

## Verification results

- 67 backend tests passed across the six focused product, search, and permission suites.
- 76 frontend tests passed across eight focused component, page, and permission suites.
- The PostgreSQL integration test passed using a fresh temporary PostgreSQL 16 cluster.
  The temporary server was stopped after the check.
- The client production build passed.
- `git diff --check` passed.
- Core and bulk tags use the existing schema. The landing-page extension below
  adds a description column and requires migration before deployment.
- Existing legacy duplicate tags are retained.


## Bulk tagging extension

In Catalog > Products, select rows and choose **Edit tags**. Choose **Add tags** or
**Remove tags** and select labels. Addition allows new labels; removal only offers
existing labels. The dialog snapshots the selected IDs when opened. Canceling
leaves the products unchanged, errors retain the selection and inputs for retry,
and controls are disabled while applying. Success shows how many selected
products actually changed, clears the selection and refreshes the product list.

- Endpoint: `PATCH /api/tags/products`, guarded by `products.update`.
- Limit: 100 distinct product UUIDs and 50 labels per operation.
- Add preserves unrelated tags and skips existing associations; remove touches only
  chosen associations and never creates/deletes dictionary entries.
- Every operation is atomic. Any stale/deleted selection or resulting count above
  50 labels rolls back all product links and any newly created dictionary entries.
- Product rows are locked in UUID order before the existing dictionary lock. This
  follows the lock ordering of product saves and serializes overlapping requests.
- Audit changes include product IDs, action, labels and actual change counts.
- Replace-all and clear-all actions are deliberately outside this workflow.

### Files changed for bulk tagging

- `client/src/components/admin/BulkProductTagsDialog.jsx`
- `client/src/components/admin/ProductTagsInput.jsx`
- `client/src/pages/admin/ProductsManagePage.jsx`
- `client/src/services/tagService.js`
- `client/src/test/components/BulkProductTagsDialog.test.jsx`
- `client/src/test/pages/admin/ProductsManagePage.test.jsx`
- `server/src/modules/product/tag.service.js`
- `server/src/modules/product/tag.validation.js`
- `server/src/modules/product/tag.routes.js`
- `server/tests/unit/product.tags.bulk.test.js`
- `server/tests/integration/product.tags.integration.test.js`
- `docs/API.md`
- `docs/FEATURES.md`
- `docs/plans/product-tags.md`

### Bulk verification results

- 25 backend tests passed in `product.tags.test.js` and `product.tags.bulk.test.js`.
- 27 frontend tests passed in `ProductTagsInput.test.jsx`,
  `BulkProductTagsDialog.test.jsx` and `ProductsManagePage.test.jsx`.
- Both PostgreSQL integration checks passed, including actual rollback of new
  dictionary entries after a limit failure and reversed overlapping selections.
- The production build and `git diff --check` passed.
- The temporary PostgreSQL server was stopped after validation.

Focused bulk check commands, from the repository root:

```bash
(cd server && npm test -- --run tests/unit/product.tags.test.js tests/unit/product.tags.bulk.test.js)
(cd client && npm test -- src/test/components/ProductTagsInput.test.jsx src/test/components/BulkProductTagsDialog.test.jsx src/test/pages/admin/ProductsManagePage.test.jsx)
(cd client && npm run build)
```


## Storefront landing-page extension

- Public URL: `/tags/:slug`; product chips point to the landing page. Existing
  product-list query links remain supported.
- Metadata endpoint: `GET /api/tags/public/:slug`; only tags linked to published,
  enabled, non-deleted products resolve. Other tag routes remain authenticated.
- Description: optional plain text, max 2,000 characters. Admin editing changes
  the name/introduction while keeping the slug stable; omission preserves the
  description and null/empty clears it.
- Apply `cd server && npm run migrate` before deployment. The migration adds
  `tags.description` with an empty-string default for all existing tags.
- Customer browsing reuses ProductListPage. The route tag cannot be replaced by a
  conflicting query parameter, and clearing other filters keeps the tag in place.
- Canonical slugs take precedence over legacy tag names that happen to match them,
  preventing groups such as `Gift Box` and `gift-box` from mixing on an archive.
- The sitemap includes public tag URLs. Crawler metadata uses tag names,
  descriptions and CollectionPage JSON-LD; hidden/unknown tags return HTTP 404
  with noindex instead of global default metadata. JSON-LD escapes script boundaries.
- Browser failures have a retry action; unavailable tags have a catalog link.
- Product associations exclude the new long description field; it is fetched only
  for tag management and landing metadata, preserving catalog payload sizes.

### Files changed for landing pages

- `client/src/pages/storefront/TagPage.jsx`
- `client/src/pages/storefront/ProductListPage.jsx`
- `client/src/pages/storefront/ProductDetailPage.jsx`
- `client/src/pages/admin/TagsPage.jsx`
- `client/src/routes/AppRoutes.jsx`
- `client/src/services/tagService.js`
- `client/src/test/pages/storefront/TagPage.test.jsx`
- `client/src/test/pages/admin/TagsPage.test.jsx`
- `server/migrations/20261028100000-add-tag-description.js`
- `server/src/modules/product/tag.model.js`
- `server/src/modules/product/product.service.js`
- `server/src/modules/brand/brand.service.js`
- `server/src/modules/apiBuilder/apiBuilder.service.js`
- `server/src/modules/product/tag.service.js`
- `server/src/modules/product/tag.validation.js`
- `server/src/modules/product/tag.routes.js`
- `server/src/modules/seo/seo.service.js`
- `server/src/middleware/crawlerPrerender.middleware.js`
- `server/tests/unit/product.tags.test.js`
- `server/tests/unit/product.tags.public.test.js`
- `server/tests/unit/seo.tags.test.js`
- `server/tests/integration/product.tags.integration.test.js`
- `docs/API.md`
- `docs/FEATURES.md`
- `docs/SEO.md`
- `docs/plans/product-tags.md`

Focused validation commands, from the repository root:

```bash
(cd server && npm test -- --run tests/unit/product.tags.test.js tests/unit/product.tags.bulk.test.js tests/unit/product.tags.public.test.js tests/unit/seo.tags.test.js tests/unit/seo.prerender.test.js tests/unit/search.repository.test.js tests/unit/apiBuilder.public.test.js tests/unit/attribute.brand.fixes.test.js)
(cd client && npm test -- src/test/pages/admin/TagsPage.test.jsx src/test/pages/storefront/TagPage.test.jsx src/test/pages/storefront/ProductListPage.tags.test.jsx)
(cd client && npm run build)
```

The optional PostgreSQL suite above also checks the real description migration
against an existing legacy row, public visibility for draft/disabled/deleted
products, saved introductions and canonical-slug collisions.


### Landing-page verification results

- 80 backend tests passed across the tag, bulk tag, public tag, SEO, search,
  API-builder and brand/attribute suites.
- 17 frontend tests passed across tag management, tag landing pages and legacy
  product-list tag browsing.
- Five PostgreSQL integration checks passed, including the real migration against
  an existing tag, public visibility and canonical-slug precedence.
- The client production build and `git diff --check` passed.
- The temporary PostgreSQL instance was stopped after validation. The application's
  configured database was not migrated; run `cd server && npm run migrate` before
  deploying this version.

## Pull request preparation

- Updated the feature branch to `origin/main` at `6e59408`, retaining the latest
  notification navigation and route changes. The upstream test-theme wrapper is
  reused without duplicate imports.
- Added ADR-0009 as proposed architecture context for review.
- Automated Codex review reported no actionable findings.
- Latest-base validation: 106 backend tests, 51 focused UI/routing tests, and the
  production client build passed. The earlier complete focused client run passed
  90 tests; the isolated PostgreSQL suite passed all five checks.
- Preflight additionally rejects commas introduced by Unicode normalization, with
  a regression case. Its three focused backend suites passed 31 tests.
- Credential-pattern scanning of staged files and `git diff --check` passed.
- Deployment still requires `cd server && npm run migrate` before the new backend.

## Platform feature control

Product Tags is an optional Platform Features capability (`tags`), enabled by default in ecommerce and catalog modes. Turning it off hides admin navigation, editing and bulk controls, storefront links and tag pages, and custom navigation links. Dedicated tag APIs are gated; public metadata returns 404 and sitemap generation skips tags. Product writes omit tag synchronization while disabled, preserving all saved labels and associations. Legacy tag query filters and tag-name search matching are ignored while disabled. No additional database migration is needed.
