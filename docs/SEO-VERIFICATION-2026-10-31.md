# SEO verification — 31 October 2026

## Summary

Completed a focused regression check of the SEO changes and corrected defects found in metadata formatting, crawl visibility, social cards, structured data, and browser navigation. The selected suites pass: 64 server tests and 30 client tests. The client production build passes.

## What I found

- Trimming the title suffix removed its separating space. The client fallback suffix could also introduce two spaces.
- Product social cards were being changed to `og:type=website` by the shared page component.
- Relative canonical links used the browser origin even when a canonical domain was configured; non-HTTP URL schemes were not rejected.
- Crawler graph identities could use the localhost fallback when only a page canonical URL was available.
- Some breadcrumbs linked to nonexistent `/tags`, `/category`, or `/p` listing routes.
- Appending all indexable SEO overrides to the sitemap could reintroduce draft, private, or nonexistent URLs.
- Applying an override before checking the entity could expose draft metadata and discard the product or article type.
- The prerender API used by Nginx forwarded missing-page errors as API errors instead of returning an HTML 404 with `noindex`.
- Browser page fallbacks could supersede resolved URL overrides, and old metadata remained visible while navigating to a new route.
- Product schema used regular prices and total stock instead of the storefront's sale-price rules and stock remaining after reservations.
- Existing tests needed fixtures for the expanded sitemap queries, the JSON-LD graph, and the settings provider used by CMS pages.

## Fix / Changes

- Normalized title spacing and preserved product Open Graph types.
- Validated canonical URL schemes and resolved relative URLs on the configured domain.
- Corrected graph origins and breadcrumb destinations; escaped script boundaries in client JSON-LD.
- Built sitemap entries from known public content and applied override `noindex` flags to those entries.
- Resolved published entities before merging allowed override fields, preserving entity type and rich data.
- Returned HTML 404 responses with `X-Robots-Tag: noindex` from the prerender endpoint.
- Applied resolved metadata after page fallbacks and associated each response with its route to prevent stale head tags.
- Preserved utility-page titles while applying their crawl restrictions.
- Reused the existing product pricing helpers for active sales, variants, and inactive sale labels, and subtracted reserved stock.
- Corrected SEO API error code/message ordering.

## Files changed in this follow-up

- `client/src/components/common/PageSEO.jsx`
- `client/src/components/common/SEO.jsx`
- `client/src/layouts/StoreLayout.jsx`
- `client/src/utils/seo/formatSeoTitle.js`
- `client/src/test/components/PageSEO.test.jsx` — added
- `client/src/test/components/SEO.integration.test.jsx` — added
- `client/src/test/pages/storefront/StaticPageView.test.jsx`
- `server/src/modules/seo/seo.service.js`
- `server/src/modules/seo/seo.controller.js`
- `server/tests/unit/seo.tags.test.js`
- `server/tests/unit/seo.regression.test.js` — added
- `docs/SEO-VERIFICATION-2026-10-31.md` — added

## Commands to run

Run from the project root:

```sh
npm --prefix server test -- --run tests/unit/seo.prerender.test.js tests/unit/seo.tags.test.js tests/unit/seo.regression.test.js tests/unit/product.pricing.test.js
npm --prefix client test -- src/test/components/SEO.integration.test.jsx src/test/components/PageSEO.test.jsx src/test/components/StorefrontAnalytics.test.jsx src/test/pages/storefront/StaticPageView.test.jsx src/test/utils/structuredData.test.js src/test/utils/organizationStructuredData.test.js src/test/pages/storefront/TagPage.test.jsx
npm --prefix client run build
node --check server/src/modules/seo/seo.service.js
node --check server/src/modules/seo/seo.controller.js
bash -n scripts/aws-deploy.sh
git diff --check
```

## Verification

- Server: 4 test files, 64 tests passed.
- Client: 7 test files, 30 tests passed.
- Client production build passed.
- Server syntax checks, deployment-script syntax check, and whitespace check passed.

## Risks / Edge cases

- Tests use mocked database records and local rendering; production database queries and external crawler fetches were not exercised.
- Existing AWS Nginx installations need the sitemap/robots proxy configuration applied during deployment.
- Analytics account receipt and GA4 Enhanced Measurement settings still require account-side verification.
- This check did not deploy or commit the workspace changes.
