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

Existing SEO settings supply the storefront defaults. Product, category, and
article fields supply detail metadata. The storefront URL override takes
precedence when present. For example, use `/products.html?slug=tomato` to
override that storefront page or `/products/tomato` as the shared backend path.
Use the published file and identifying query parameter for other storefront
overrides. The XML sitemap omits noindex pages and URLs that canonicalize to a
different page. Product links with a saved variant or category canonicalize to
the product's slug URL. Clean listing pagination keeps its page parameter.

Product and variant image rows use their saved alt text first and Media
Library alt text second. Blog photos and album covers use Media Library alt
text. Category records currently store image URLs, and the storefront uses
the category name as the image alternative.

Check these URLs on the published host after deployment.

- `/robots.txt` and `/sitemap.xml`
- `/products.html?slug=<published-slug>&variant=<variant-id>`
- `/resource.html?slug=<published-slug>`
- `/gallery-detail.html?album=<public-slug>`
- `/wishlist.html` and `/products.html?slug=<missing-slug>`
