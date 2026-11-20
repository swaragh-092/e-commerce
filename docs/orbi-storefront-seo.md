# Orbi Seeds storefront SEO

The storefront lives in `demo-orbis-seeds-v1-html`. Its Express entry point is
`/demo-orbis-seeds-v1-html/`. Set `ORBI_STOREFRONT_URL` on the backend to the
published storefront URL, including any path prefix. For a local backend on
port 5000, use `http://localhost:5000/demo-orbis-seeds-v1-html/`.

Serve the public HTML through that entry point so the initial response includes
entity metadata, absolute canonical and social URLs, and structured data.
For a storefront hosted at the root of its own domain, an Nginx virtual host
can forward the storefront to Express as follows.

```nginx
location / {
    proxy_pass http://127.0.0.1:5000/demo-orbis-seeds-v1-html/;
    proxy_set_header Host $host;
}
location /api/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
}
location /uploads/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
}
```

Set `ORBI_API_ORIGIN` and allow the storefront origin in `CORS_URL` if the
browser uses a separate API host. If the storefront is published under a path
on a shared domain, expose its sitemap in that domain's root `robots.txt`.
Plain static hosting can display the default page metadata and update it in
the browser. Dynamic link previews and the XML sitemap require the Express
entry point.

Existing SEO settings supply the storefront defaults. The Express entry point
uses saved SEO fields and public content from these backend modules.

| Content | Orbi detail route | Shared backend override path |
| --- | --- | --- |
| Product | `/products.html?slug=tomato` | `/products/tomato` |
| Category | `/product.html?cat=vegetables` for a parent, or `/products.html?category=tomato` for a leaf | `/category/<slug>` |
| Article | `/resource.html?slug=growing-tips` | `/blogs/growing-tips` |
| Gallery album | `/gallery-detail.html?album=field-trials` | `/gallery/field-trials` |
| CMS Page | `/page.html?slug=shipping-policy` | `/p/shipping-policy` |

Use the published URL path and identifying query parameter in **SEO URL
Overrides**, including the public prefix when the site is hosted below a path.
For example, `/store/products.html?slug=tomato` takes precedence over
`/products.html?slug=tomato`, then `/products/tomato`. Static pages also accept
their published path, such as `/store/about-orbis.html`. The XML sitemap uses
the same precedence and omits noindex pages and URLs that canonicalize
elsewhere. Product links with a saved variant or category canonicalize to the
product's slug URL. Clean listing pagination keeps its page parameter.

Published CMS Pages render their saved title, content and banner at the Orbi
detail route when the backend Pages feature is enabled. The HTML site map links
to published pages and the XML sitemap includes their indexable URLs. CMS
Pages require the Express entry point. The Orbi storefront has no dedicated
brand or tag collection routes.

Selected storefront URLs use the SEO team's approved titles and descriptions
from `demo-orbis-seeds-v1-html/js/seo-routes.js`. On category and gallery album
URLs, each field uses a matching SEO URL Override first, then the saved entity
value, then the approved copy, then the storefront fallback. The approved copy
on other selected URLs can still be replaced by an explicit SEO URL Override.

With SEO enabled, open an album in **Catalog → Gallery** and use **SEO
Configuration** to save its meta title, description, keywords and social sharing
image. Clear a field to restore its fallback; select **Use default image** to
restore the album cover. Apply migration
`20261120100000-add-brand-gallery-seo.js` before deploying the updated server.
The Express entry point remains responsible for album metadata and Media Library
image alternatives.

Product and variant images use Media Library alt text first, then descriptive
alt text saved on the product image. Legacy filenames and the generic Product
Image placeholder fall back to the product or variant name. Blog photos and album covers use Media Library alt
text. Category records currently store image URLs, and the storefront uses
the category name as the image alternative.

Check these URLs on the published host after deployment.

- `/robots.txt` and `/sitemap.xml`
- `/products.html?slug=<published-slug>&variant=<variant-id>`
- `/resource.html?slug=<published-slug>`
- `/page.html?slug=<published-cms-slug>`
- `/gallery-detail.html?album=<public-slug>`
- `/wishlist.html` and `/products.html?slug=<missing-slug>`
