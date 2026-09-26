# Product Audit — 2026-09-26

## Executive summary

**Overall production readiness: 4/10.** The codebase has broad commerce coverage and passing client/server test suites. The deployed site is live and the admin areas are usable. Core customer trust and discovery still have release-significant defects: tested category pages show no products, two promoted demo products show a zero price on their detail pages, a direct success URL confirms an order without verifying one, and the admin dashboard reports inventory as healthy while its low-stock list contains many zero-available products.

The product is a custom React/Node commerce platform branded Swaragh, currently configured for an Indian rupee storefront selling agricultural and produce-related catalog items. Its architecture includes storefront, admin, CMS, payment/shipping, inventory, analytics, roles, and API tooling. The feature surface is much broader than the quality of the live catalog and operational signals currently support.

## Scope and evidence

- Reviewed repository architecture, route map, feature modules, selected security and payment code, existing tests, and the current production build.
- Browsed the deployed storefront at https://ecom.gururajhr.in at 390 px, 768 px, and desktop width. Signed in to admin with the supplied account to inspect read-only dashboard, catalog, orders, customers, analytics, reviews, settings, payment gateways, shipping, audit log, access control, features, and coupons pages. Logged out after the review.
- Inspected public home, product list, product detail, search, categories, brands, login/register, cart/checkout, payment result routes, and 404. No order, payment, product, or settings mutation was performed.
- Browser evidence is from the deployed site on 2026-09-26. Code and tests are from the repository’s then-current working tree. The repository already had 49 modified/untracked working-tree entries; this report is not a clean-branch comparison.
- The local API was not running, so local storefront pages that require it could not provide a useful end-to-end check. The deployed site supplied the live behavioral evidence. A complete sandbox payment, email delivery, shipping-label, refund, and multi-user authorization test was not performed.

## Product and feature inventory

| Area | Implemented or present in source | Observed on the deployed site |
|---|---|---|
| Storefront | Home sections, catalog, categories, search, brands, blogs, static pages, product variants, product recommendations, sale labels | Home, product list, product detail, search, brands and 404 rendered. Category destinations returned empty results. |
| Shopper account | Registration, login, password reset, email verification, OAuth callback, profile, order history and invoices | Login/register forms rendered. Admin sign-in worked. Customer credential, reset, verification, OAuth and order-history flows were not submitted. |
| Cart and checkout | Cart, coupon entry, address selection, tax and shipping summary, payment selection | Cart and checkout rendered. Payment was not submitted. Checkout’s pay button was disabled until the preceding steps were complete. |
| Catalog administration | Products, brands, categories, attributes, media, inventory signals, bulk-oriented catalog tools | Product list showed 233 total products; storefront showed published products. Read-only catalog inspection only. |
| Sales operations | Orders, order detail/invoices, customers, coupons, enquiries, reviews, shipping and payment gateway configuration | Orders, customers, reviews, coupons, gateway and shipping pages loaded. No operational records were changed. |
| Store management | Settings, feature switches, themes, visual store designer, SEO overrides, email templates, menus, pages, blogs, newsletter | Read-only settings, features and content areas were present in routes; settings, features and other selected admin pages loaded. |
| Analytics and governance | Analytics, audit log, access control, role/permission management, API builder | Analytics, audit log and access control loaded. Dashboard reported 100 orders, 165 published products, 8 customers, 174 low-stock items and 80% store health. |
| Backend services | Auth, products, search, cart, wishlist, orders, payments, shipping, tax, coupons, reviews, inventory, notifications, SEO, CMS and scheduled jobs | Source modules and passing server tests confirm code coverage. Production behavior was not independently verified for every module. |

### Main user journeys

| Journey | Result |
|---|---|
| Home → product list | Works and displays a paginated catalog. The hero still contains generic “Campaign headline” and supporting-copy placeholder text. |
| Home/header category → category results | Fails for the four visible category links tested: Flowers, Fruits, Other Crops and Vegetables all show 0 products. /category/marigold also shows 0 although search offers Marigold as a category. |
| Search for “marigold” | Returns three products whose visible names and categories do not contain “Marigold”; the suggestion panel separately offers a Marigold category. Check search indexing and ranking. |
| Product list → product detail | Detail routes load. The two prominent demo/test products show a zero current price and 100% off despite nonzero prices on the product cards. |
| Cart → checkout | Checkout renders with an existing cart/account state. No cart changes or payment actions were made, so a fresh guest checkout and payment completion remain unverified. |
| Payment success deep link | /payment/success renders “Payment successful” and “Order Placed!” with no order ID or verified order. |
| Admin sign-in → operations | Sign-in worked. Dashboard, product/order/customer lists, analytics, reviews, settings, features, gateway/shipping, audit and access-control screens loaded. Session was logged out at the end. |
| Unknown URL | A branded 404 renders with links back to the home page and catalog. |

## Findings and priorities

### P1 — Fix before relying on the storefront

1. **Category destinations are empty despite a populated catalog.** The homepage and category navigation advertise four categories, but each tested route (/category/flowers, /category/fruits, /category/other-crops, /category/vegetables) reports 0 products. /category/marigold also reports 0 even though the search suggestion exposes that category. This breaks a primary discovery path. Check category slug/ID resolution and the query used by the category page. Acceptance: each visible category route returns its expected published products, correct count, breadcrumb and empty state only when the category truly has none.

2. **Product card and detail pricing disagree, including a zero customer-facing price.** On /products, Test1 is listed at ₹5 with ₹10 crossed out, and demo is listed at ₹50 with ₹101 crossed out. Their detail pages show ₹0 and 100% off (with a different crossed-out price). Both are promoted on the home page. This could lead customers to distrust prices or proceed with an unintended amount. Reconcile base price, variant price, sale rules and displayed savings through one server-calculated price model. Acceptance: list, detail, cart and checkout show the same selected-variant amount and discount; zero is shown only for intentionally free items.

3. **Payment success is asserted without order verification.** A direct visit to /payment/success with no order ID displays “Payment successful”, “Order Placed!” and post-order instructions. In client/src/pages/storefront/PaymentSuccessPage.jsx, fetching an order is conditional on an ID, while the success content is rendered unconditionally. Require a verified order/payment result before showing confirmation; handle absent IDs, failed fetches and pending webhooks as a clear pending/error state. Acceptance: a success page cannot claim success unless the server confirms the exact order state.

4. **Inventory health contradicts the dashboard’s own stock warnings.** The admin dashboard reports “Inventory healthy” while its operations summary reports 174 low-stock items and its “Low Stock Alerts (50)” table includes rows with total, reserved and available quantity all at zero. This can conceal stockouts and mislead replenishment decisions. Reconcile health calculation, thresholds, variant inventory and available quantity; distinguish healthy, low, and out-of-stock states. Acceptance: the health summary agrees with the detailed alert counts and identifies stockouts.

### P2 — Improve trust, usability and maintainability

5. **Shipping promotion uses dollars on a rupee storefront.** The global banner says “Free shipping on orders over $50!” while catalog prices and store settings are in INR. Configure the promotion from the store currency and shipping rules; confirm the threshold matches checkout.

6. **Public merchandising still contains test and placeholder content.** The home hero says “Campaign headline” and “Add supporting copy for this slide.” The first catalog items include “Test1”, “demo”, and other test-like names. Remove or replace demo content before customer acquisition. The brand directory also uses awkward placeholder copy (“check the brand what you want”).

7. **Search result relevance needs a live-data review.** Searching for “marigold” returns MARS, MARBLE, and GEM GOLD, while their visible categories are Cabbage, Pumpkin, and Sweet Pepper; Marigold appears as a separate category suggestion. Confirm which product fields are indexed and tune exact/category matches ahead of loose matches.

8. **Heading hierarchy is inconsistent.** The live /products page has no H1; “Our Products” is an H4. Several other page titles use H4/H5 and product-card prices use heading elements, creating a noisy document outline. Use one descriptive H1 per page and reserve heading levels for section structure. The mobile 390 px listing had no horizontal overflow and the inspected listing images had alt text.

9. **Initial JavaScript weight needs a measured budget.** The current production build passes but Vite warns about chunks above 500 KB. The largest listed JS chunk is 773.48 KB minified (245.93 KB gzip). The HTML also loads the Razorpay checkout script globally, although only payment flows need it. Measure storefront Web Vitals on production, split heavy admin/chart/editor/document dependencies, and load the payment SDK only when needed. No production LCP/CLS/INP or throttled network measurement was available for this audit.

10. **Access tokens are stored in localStorage.** client/src/services/authService.js stores access and refresh tokens there. A successful script injection could read them. Prefer secure HttpOnly/SameSite cookies where the API architecture allows; otherwise use short-lived access tokens, tightly scoped refresh handling, strong CSP and regression checks for stored/reflected content. This is a hardening concern, not evidence of an exploitable XSS found during this review.

11. **Checkout failure wording should follow a confirmed gateway result.** The failure page says the order “has not been charged.” Confirm that this route is only reached after a definitive failed/cancelled gateway status; a timeout or pending webhook should say that payment status is being checked instead.

12. **Development database defaults need deployment guardrails.** The local compose setup exposes PostgreSQL on a host port and includes a default credential. Keep that configuration development-only, bind it to loopback for local use, and require deployment-managed secrets in any shared environment.

## UX and accessibility review

### Strengths

- Storefront uses a consistent branded header, category navigation, product cards, cart count, breadcrumbs and footer.
- Product details expose variant groups, selected variant, quantity controls, stock state and clear add-to-cart/buy actions.
- Search supports products and category suggestions; sorting, filters and pagination are present.
- Login/register pages have labelled fields, password visibility controls and browser-level required validation.
- Product imagery inspected on catalog and detail pages loaded successfully and had useful alternative text.
- The 390 px and 768 px catalog layouts did not show horizontal overflow; the 390 px admin login layout also fit the viewport.
- Empty-cart and 404 states include useful next actions.

### Gaps

- Category navigation creates four empty dead ends. This is the most visible UX defect after pricing.
- Currency mismatch, zero-price sale states, generic hero content and test product names weaken buying confidence.
- Product list heading is an H4 with no H1; other pages use inconsistent heading levels. Admin page titles also commonly use low-level headings.
- The storefront’s global free-shipping promise is not tied visibly to the actual local-currency threshold.
- Search should explain no-result states and prioritize the category or product that exactly matches the query.
- Automated WCAG/axe scanning, keyboard-only completion, screen-reader testing, contrast measurement and reduced-motion checks were not run. Treat those as open verification items. Payment success animation should respect prefers-reduced-motion.

## Engineering, reliability and security

### Architecture and delivery

- Client: React 18, Vite and MUI; route structure separates storefront, account and protected admin areas.
- Server: Node/Express with Sequelize/PostgreSQL and distinct domain modules for catalog, cart, orders, payments, inventory, content and administration.
- Background jobs cover cleanup, inventory alerts, notifications, analytics and shipping operations.
- Existing automated suites passed on the latest working tree: client 14 files / 44 tests; server 20 files / 178 tests.
- Commands run: cd client && npm test; cd server && npm test -- --run; cd client && npm run build -- --outDir /tmp/ecommerce-audit-current --emptyOutDir; cd client && node --check src/utils/seo/buildStructuredData.js.
- The current frontend production build passed in 52 seconds after transforming 14,491 modules. It emitted a chunk-size warning; the largest listed JS chunk is 773.48 KB minified / 245.93 KB gzip.
- No end-to-end browser test configuration was found. Unit/server tests do not cover the live category, pricing, payment confirmation or inventory-health issues found here.
- The local database/API was not running during the initial local app review. The final build and test results describe the current working-tree snapshot, which contained substantial existing work in progress.

### Security posture

**Controls present in source:** protected routes and permission checks, role/permission management, admin audit logging, Helmet, configured CORS handling, login/registration/password-reset/OTP rate limits, two-factor flows and token refresh logic.

**Follow-up:** review the localStorage token design, verify production seed/admin identities are rotated, keep database secrets out of deployable defaults, and add tests for role boundaries and cross-account order access. No penetration test, dependency supply-chain review, production header scan, backup-restore exercise or authorization-bypass testing was conducted.

## Competitor comparison

| Capability | Swaragh (audited product) | Shopify | WooCommerce | Medusa | Saleor |
|---|---|---|---|---|---|
| Storefront and checkout | Custom storefront and checkout; price/category defects found in live audit | Hosted store, checkout, shipping, POS and broad app/theme ecosystem ([Shopify products](https://www.shopify.com/products), [checkout](https://help.shopify.com/en/manual/checkout-settings)) | WordPress-based open-source commerce with blocks, REST API, extensions and broad payment options ([features](https://woocommerce.com/woocommerce-features/)) | Headless commerce modules and APIs for catalog, cart, order, customer, payment, inventory, regions and promotions ([commerce modules](https://docs.medusajs.com/resources/commerce-modules)) | API-first, multi-channel commerce with dashboard, webhooks and app extensions ([Saleor](https://saleor.io/index), [documentation](https://docs.saleor.io/)) |
| Merchant operations | Custom product/order/customer/review/coupon/shipping/payment/settings admin | Mature hosted merchant workflows and integrated ecosystem | Large WordPress plugin/theme ecosystem; merchant capabilities depend on extensions | Customizable admin and modular backend ([admin development](https://docs.medusajs.com/learn/fundamentals/admin)) | Extensible dashboard and app integrations ([Saleor Apps](https://apps.saleor.io/)) |
| Extensibility | API builder, feature flags, themes, CMS, roles and custom code paths | App Store, theme store and platform integrations | Open source and large extension ecosystem | Developer-first modules and APIs | GraphQL/API-first apps, webhooks and dashboard extensions |
| Channels, fulfillment and customer service | Shipping providers, zones/rules, payment gateways, orders and invoices in source; live completion not verified | Strongest turnkey breadth, including POS, shipping and customer-account workflows | Broad extension options; operations vary by plugin stack | Modular regions, sales channels and payment providers | Strong headless multi-channel and integration model |
| Relative strength | Broad self-hosted feature surface and direct control over source/configuration | Lowest operational burden and strongest turnkey ecosystem | WordPress familiarity and plugin choice | Flexible developer architecture | Headless flexibility and app extensibility |
| Gap to close | Stabilize core catalog, pricing, stock and payment truth before adding more modules | Merchant ecosystem, reliable hosted checkout and fulfillment breadth | Extension ecosystem and mature operational plugins | Clean modular APIs and developer ergonomics | Multi-channel ecosystem and integration breadth |

The competitors set a high bar through integrated ecosystems and dependable order/payment semantics. Shopify’s customer-account offering also includes self-service account capabilities ([customer accounts](https://apps.shopify.com/built-in-features/customer-accounts)). Swaragh’s admin breadth is a solid foundation, but it should first make its existing catalog and order promises trustworthy.

## Roadmap

### Phase 0 — Restore customer and operator trust

1. Fix category slug-to-product resolution; verify every homepage/header category.
2. Correct product/variant sale calculations and confirm card, detail, cart, checkout and server totals match.
3. Gate payment success on verified order/payment status; add pending and retry-safe states.
4. Correct the dashboard inventory health calculation and reconcile zero-available stock.
5. Remove test/demo products and replace generic hero and brand copy.
6. Align the free-shipping threshold with INR and configured shipping rules.

### Phase 1 — Add regression protection

1. Add browser-level journeys for category discovery, product pricing, cart totals, gateway success/failure/pending, and empty/stockout states.
2. Add contract tests for discount stacking, variant pricing, tax, shipping and payment callbacks.
3. Add admin health invariants: stock health counts must equal detailed low-stock/out-of-stock counts.
4. Add production monitoring for checkout failures, price mismatches, payment webhook lag and catalog-empty categories.
5. Define catalog publishing checks for nonzero price, real copy/images, category assignment and stock policy.

### Phase 2 — Make operations dependable

1. Complete sandbox verification for all enabled gateways, COD, cancellations, refunds and webhook retries.
2. Provide clear order status, shipment tracking, return/refund requests and delivery notifications to customers.
3. Add inventory reconciliation, stock reservation visibility and safe bulk maintenance workflows.
4. Improve search relevance and analytics attribution; instrument conversion funnel and abandoned checkout recovery.

### Phase 3 — Expand growth and ecosystem

1. Add loyalty, bundles/subscriptions and richer promotions where supported by the product model.
2. Expand regional language, currency, tax and shipping coverage with explicit market configuration.
3. Consider POS/sales channels, integration marketplace and partner extension points after operations stabilize.

## Impact/effort map

| Impact | Lower effort | Higher effort |
|---|---|---|
| High | Replace hero/banner copy; remove demo products; fix page H1s; hide out-of-stock items where appropriate; defer global payment SDK | Correct category association/query; unify price and discount calculation; verify payment callbacks; fix stock-health aggregation |
| Medium | Improve search ranking and no-result copy; add reduced-motion support; tighten labels and admin table headers | Returns/refunds workflow; customer self-service; robust analytics funnel; multi-region and channel support |
| Lower | Polish brand-directory copy and secondary empty states | POS and extension ecosystem breadth |

## Scorecard

| Dimension | Score / 10 | Reason |
|---|---:|---|
| Feature coverage | 8 | Broad storefront, admin, content, payment, shipping, roles and analytics modules are present. |
| Core journey reliability | 3 | Category paths, pricing display and payment-success semantics have serious gaps. |
| Product discovery | 3 | Catalog and search work, but tested category destinations fail and search relevance is questionable. |
| UX/content quality | 4 | Responsive structure and clear actions exist; currency, prices and placeholder content harm trust. |
| Accessibility | 5 | Labels and alt text are present in inspected flows; heading structure and untested keyboard/contrast coverage remain. |
| Performance | 5 | Build succeeds and assets are split, but the main chunk triggers a size warning; production vitals were not measured. |
| Security posture | 6 | RBAC, rate limiting, Helmet and audit trails exist; token storage and deployment-secret guardrails need review. |
| Operations and observability | 4 | Rich admin tools exist, but the stock-health contradiction undermines operational confidence. |
| Test confidence | 6 | 222 client/server tests pass; no E2E suite was found for the critical browser journeys. |
| Competitive readiness | 4 | Custom feature breadth is strong; core reliability and ecosystem breadth trail mature platforms. |

## Recommended acceptance checklist

- All visible category links return correct products and counts on desktop and mobile.
- Product card, detail, cart, checkout and payment request agree on a selected variant’s price, sale, tax and shipping.
- Direct or stale success URLs never claim an order exists without server confirmation.
- Inventory summary and detailed stock lists agree for available, low and out-of-stock counts.
- Storewide currency and shipping threshold match on the banner, settings, cart and checkout.
- No test/demo copy or test products are publicly published.
- Customer and admin critical flows work in browser tests, including payment success, failure, timeout and webhook retry.
- Page headings, keyboard operation, contrast, focus states, live errors and reduced motion pass automated and manual accessibility checks.
- Production build has an explicit storefront JavaScript budget and passes measured Web Vitals on mobile.
