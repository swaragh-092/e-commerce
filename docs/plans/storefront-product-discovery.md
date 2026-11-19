# Storefront product discovery

Start with **New Arrivals**, **Best Sellers**, and **Recently Viewed**. Add **Most Viewed** after storefront view tracking has enough data to produce a credible ranking. Use Best Sellers as the customer-facing name for Most Bought. If the business wants to rank by units as well, show that metric in admin as Units Sold. Reserve **Frequently Bought Together** for product-page recommendations based on items that appear in the same eligible order.

## What other stores do

- Shopify offers Newest, Best Selling, and manual collection sorting. Newest uses product creation date. Best Selling uses the all-time number of orders containing each product. [Shopify collection sorting](https://help.shopify.com/en/manual/products/collections/collection-layout)
- BigCommerce offers homepage panels for new products, featured products, and top sellers. Its top sellers use units sold and exclude cancelled, refunded, and test-payment orders. [BigCommerce product panels](https://support.bigcommerce.com/s/article/Product-Panels?language=en_US)
- IKEA's shopping app shows popular and recently viewed products on the home screen. Its Norway storefront documents a session cookie that stores recently viewed product IDs. [IKEA shopping app](https://www.ikea.com/ph/en/customer-service/mobile-apps/how-to-shop-pub9a35f980/), [IKEA storefront storage](https://www.ikea.com/no/en/customer-service/cookie-policy/)
- Amazon shows Best Sellers and New Releases as separate collections. Amazon Personalize documents Most Viewed and Frequently Bought Together as distinct use cases. [Amazon storefront collections](https://sell.amazon.com/blog/amazon-seo), [Amazon Personalize ecommerce use cases](https://docs.aws.amazon.com/personalize/latest/dg/ECOMMERCE-use-cases.html)

## What this store already has

| Section | Existing code | Work needed |
| --- | --- | --- |
| New Arrivals | `HomeExperience.jsx` has a New Arrivals row and the public catalog supports `sort=newest`, based on creation date. | Check the published theme for the row. Use first-publication date for merchandising so drafts and late launches sort correctly. |
| Recently Viewed | `ProductDetailPage.jsx` records views and `RecentlyViewedSection.jsx` renders them. It stores up to 12 product snapshots in browser storage. | Enable the row where useful and resolve stored IDs to current public cards so prices, visibility, and availability stay current. |
| Best Sellers | The homepage supports a Best Sellers source and `product.service.js` supports `sort=best-selling`. The query sums all matching order-line quantities. | Rank by eligible distinct orders. Add the sort to the catalog menu so the homepage and View All use the same rule. |
| Most Viewed | The admin catalog analytics aggregates `page_visits`. The server middleware tracks page requests and skips API requests. | Capture views after successful product-page navigation. Verify browser navigation and direct entry both count before showing a public ranking. |

The published homepage configuration takes precedence over legacy sections. Inspect it during rollout and add or enable rows through the existing editor. The review covered the workspace code. Published settings, production traffic, and historical order coverage still need verification.

## Ranking and display rules

| Section | Proposed rule | Placement and fallback |
| --- | --- | --- |
| New Arrivals | Sort by first-publication time, with a 30-day window for the homepage row. Preserve the first date through edits and republication. For legacy products, use verified publication history where available and creation date otherwise. | Place below Shop by Category. Hide the homepage row when it has no qualifying products. View All can list the full catalog by arrival date. |
| Best Sellers | Count distinct eligible orders containing each parent product in the past 30 days. Count a product once per order even when several variants or units were purchased. Use settled online payments and confirmed COD collection, with delivery as a proxy only if the workflow reliably records COD settlement through delivery. | Place below New Arrivals in ecommerce mode. Start with four products with at least two eligible orders each as the minimum for the homepage row. Hide it when data is sparse or ordering is disabled. |
| Recently Viewed | Keep the latest 12 distinct product IDs on this browser for up to 30 days. Resolve them in one public catalog request, preserve browsing order, and exclude the current product on its detail page. Offer Clear history. | Enable on product pages and optionally near the bottom of the homepage. Hide on a first visit, after clearing history, or when none of the saved products are public. |
| Most Viewed | Rank by deduplicated product-detail views in the past seven days. Start with one count per anonymous browser and product per day. Use an approved storefront tracking identifier and exclude preview, staff, known bot, and invalid traffic. | Start as an optional homepage or category row in both modes. Publish after a full seven-day window and enough qualifying products. Start with four products with at least five eligible views each, then tune from observed traffic. |

Use the current public catalog visibility and card data for every section. Respect store mode and pricing settings. Use the existing availability rules for variants and bundles. Skip unavailable products in ecommerce discovery rows. Recently Viewed can show a still-public unavailable product with its current status. Category rankings should apply the category filter before selecting the top products. Use deterministic tie-breakers so results remain stable across pages.

For Best Sellers, exclude test, unpaid, failed, cancelled, and fully refunded orders. If a completed return removes every unit of a product from an otherwise eligible order, remove that product's contribution. Keep the contribution when at least one unit remains. Use recorded return quantities where available. A partial order-level refund with no item attribution leaves the product's count intact. Verify COD, return, and refund rules against the order lifecycle before switching the public sort.

## Implementation order

1. **Enable the existing sections.** Check the published homepage and product-page settings. Reuse the existing product rows, cards, and preview/publish workflow. Give merchants controls for enablement, title, placement, layout, and item count. Start with 8 cards per row. Use Featured Products for manual selection when a ranked row has too little data.
2. **Make the existing sources dependable.** Introduce first-publication ordering and fresh product lookup for Recently Viewed. Read IDs from the existing browser history so returning shoppers keep their recent products during the change. Replace the Best Sellers query with one shared ranking for the homepage, catalog sort, and View All. Verify sample rankings against existing eligible orders before launch.
3. **Collect and verify product views.** Start capture alongside the first release. Record a view after a public product detail page loads, including direct visits and in-app navigation. Route it through first-party analytics, deduplicate on the server, and keep browser history separate from aggregate reporting. Expose eligible views and the last successful refresh in admin before enabling the public row. Avoid combining older request counts with the new deduplicated ranking.
4. **Roll out the public rankings.** Cache the shared rankings and start with an hourly refresh. Serve current catalog cards when rendering a row. Record row impressions and product clicks, then compare click-through and add-to-cart rates by section. In catalog mode, use product clicks and enquiries to assess performance. Keep Frequently Bought Together for a later release once there are enough eligible orders per product pair.

## Release checks

- A draft published today appears as a new arrival. Updating, restocking, or republishing an older product preserves its first-publication date.
- Guest history survives navigation and refresh, revisits move an item to the front, and clearing history removes the row. Hidden products disappear and changed prices show on the next fetch.
- Multiple units, variants, repeated payment notifications, and repeated order lines contribute one Best Sellers count per eligible order and product. Cancelled orders, full refunds, full product returns, partial returns, and COD follow the ranking rules.
- Direct entry, client navigation, refreshes, variant changes, and multiple tabs behave consistently in the view count. Preview traffic stays out. Insufficient traffic leaves the public row hidden.
- Homepage and View All agree on ranking and visibility. Saved theme configurations still preview, publish, and render. The home page works in ecommerce and catalog modes with each section enabled or disabled.
