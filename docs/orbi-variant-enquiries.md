# Orbi product variants, wishlist and enquiries

## Summary

The static product page now uses the selected variant throughout the wishlist and enquiry flows. All work remains local; no commit, push or deployment was performed. No database migration is needed.

## What I found

The product list requested attribute metadata without full variant options. Buttons saved only the parent product ID, wishlist removal omitted variantId, and the enquiry list merged all options of a product. Enquiry submissions sent variant: null. The backend accepted some cart identifier shapes that its service ignored and did not verify that an enquiry variant belonged to its product.

## Fix / Changes

- Product options come from active variants, with attribute display order, labels and units. Descriptive attributes remain visible. Impossible combinations are disabled. Multiple options require a choice; a single active variant is selected automatically. Older variants without option metadata can be selected by SKU.
- The selected variant controls its image, SKU, availability and server-resolved price. Hidden pricing stays hidden. Product links preserve the variant, including links without a category and products beyond the first category page.
- Wishlist writes and removal use the product/variant pair. Hearts reflect the current selection. Moving items preserves variant details and quantities; retrying a failed wishlist removal does not add the same transferred item again.
- Enquiry list quantities and removal target the exact variant. Counters count distinct enquiry lines consistently. Form validation uses whole quantities and the backend phone/message rules. Product options are checked again before submission.
- Single and list enquiries retain variant IDs. Failed requests keep the form and saved list. Successful submission preserves quantities added while the request was pending.
- The backend rejects unavailable products, inactive or mismatched variants, missing required options and empty cart enquiries. Stored names/SKUs come from the catalog. Admin details and notification context include the selected options, including variants without an SKU.
- Notification setup failures after saving an enquiry are logged and do not misreport that saved enquiry as a failed submission.
- Shared catalog loading was added to every page using the shared enquiry/wishlist scripts. Existing API_URL and APP_URL settings were preserved. Resolved wishlist/enquiry feature settings are respected.
- Product text, list metadata and notification messages rendered by the browser are escaped; formatted descriptions retain supported safe markup.

## Files changed

- `client/package-lock.json`
- `client/package.json`
- `client/src/pages/admin/EnquiriesPage.jsx`
- `client/src/test/static/catalog.fixtures.js`
- `client/src/test/static/catalog.test.js`
- `client/src/test/static/catalogFlows.test.js`
- `demo-orbis-seeds-v1-html/about-orbis.html`
- `demo-orbis-seeds-v1-html/contact-us.html`
- `demo-orbis-seeds-v1-html/css/orbi-seeds.css`
- `demo-orbis-seeds-v1-html/enquiry-list.html`
- `demo-orbis-seeds-v1-html/error.html`
- `demo-orbis-seeds-v1-html/gallery-detail.html`
- `demo-orbis-seeds-v1-html/gallery.html`
- `demo-orbis-seeds-v1-html/index.html`
- `demo-orbis-seeds-v1-html/js/catalog.js`
- `demo-orbis-seeds-v1-html/js/enquiry.js`
- `demo-orbis-seeds-v1-html/js/products.js`
- `demo-orbis-seeds-v1-html/js/wishlist.js`
- `demo-orbis-seeds-v1-html/partners.html`
- `demo-orbis-seeds-v1-html/product.html`
- `demo-orbis-seeds-v1-html/products.html`
- `demo-orbis-seeds-v1-html/research-and-development.html`
- `demo-orbis-seeds-v1-html/resource.html`
- `demo-orbis-seeds-v1-html/resources.html`
- `demo-orbis-seeds-v1-html/sitemap.html`
- `demo-orbis-seeds-v1-html/wishlist.html`
- `server/src/modules/enquiry/enquiry.service.js`
- `server/src/modules/enquiry/enquiry.validation.js`
- `server/src/modules/wishlist/wishlist.service.js`
- `server/tests/unit/enquiry.variants.test.js`
- `server/tests/unit/wishlist.variants.test.js`
- `docs/orbi-variant-enquiries.md`

## Commands to run

Run these from the repository root:

```bash
npm --prefix client test -- src/test/static/catalog.test.js src/test/static/catalogFlows.test.js src/test/static/gallery.test.js src/test/utils/variantPricing.test.js
npm --prefix server test -- --run tests/unit/enquiry.variants.test.js tests/unit/wishlist.variants.test.js tests/unit/product.catalogValidation.test.js
npm --prefix client run build
```

For a manual check, open `/demo-orbis-seeds-v1-html/products.html?category=marigold`. Choose a package size, add it to both lists, then repeat with a different size. Confirm separate entries, correct selected options/images, exact-item removal, and variant-preserving product links. Submit enquiries only against a test backend when checking delivery; the automated tests mock all writes and notifications.

## Verification

Focused client and backend tests, a production build, JavaScript syntax checks and `git diff --check` passed. Headless Chrome checks at 1440×1000 and 390×844 used the public product response with mocked API writes: no JavaScript errors or horizontal overflow; selectors are at least 44 pixels high; two package sizes remain separate enquiry entries. No live enquiry, newsletter subscription or hosted wishlist write was made.

## Risks / Edge cases

- The existing configured API can point to the hosted backend even when viewing the HTML on localhost. Backend validation/admin changes take effect when that updated backend is running; this work does not deploy it.
- Legacy product-only wishlist or enquiry entries for variable products require choosing options again. A missing or deleted variant is never silently replaced by another variant. Entries without a usable product slug require reopening the product from the catalog.
- Out-of-stock products can still be enquired about; enquiries request availability/quotes and do not reserve inventory.
- The enquiry list keeps the existing quantity limit of 99,999 and supports up to 100 distinct lines per submission. It remains stored in this browser's local storage.
- Email delivery was mocked. Notification context and persistence were verified without sending real messages.
