# Orbi showcase gallery

The static Orbi site displays the same showcase albums managed under
**Admin → Catalog → Gallery**. Only active showcase albums are public;
blog galleries remain separate. This integration reuses the existing gallery
API and does not change album records or the database schema.

## Visitor page

Open `/demo-orbis-seeds-v1-html/gallery.html` on the client server.
`client/public/demo-orbis-seeds-v1-html` links to the existing static source
folder, allowing Vite to serve it during development and copy the static files
into production output. The source is maintained in one place.

The page loads albums through `GET /api/galleries/public` and loads their images
through `GET /api/galleries/public/:slug?page=1&limit=20`. Album buttons preserve
backend ordering; `?album=india&page=2` links directly to an album page. Images
open using the existing Fancybox integration, with ordinary image links as a
fallback if the external library is unavailable.

On localhost, the API and uploaded images use the same origin as the client,
through Vite's existing `/api` and `/uploads` proxies. When the static site is
hosted separately, `js/constant.js` supplies `API_URL` and `APP_URL`. Configure
those values for the deployment. Absolute HTTP/HTTPS media URLs are preserved.
Other URL protocols are ignored.

Loading, empty, and failed requests have separate states. Failed requests offer
Try again. Switching albums ignores late responses from the previous album;
out-of-range pages reload the last available page. Total album visibility and
image ordering remain controlled by the existing backend.

## Verification

From the repository root:

```bash
npm --prefix client test -- src/test/static/gallery.test.js src/test/pages/admin/GalleryPage.test.jsx
npm --prefix server test -- run tests/unit/gallery.service.test.js
npm --prefix client run build
```

Confirm `client/dist/demo-orbis-seeds-v1-html/gallery.html` and its JavaScript,
styles, and images exist after building. The symlink requires checkout support
for symbolic links; the production output contains regular copied files.
