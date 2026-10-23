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
through `GET /api/galleries/public/:slug?page=1&limit=20`. Every public album
appears as a separate section with its admin title, description, and image grid.
Sections preserve backend ordering and each album's image order. All sections
remain visible; there is no album switcher. Each section has independent
pagination, loading, empty, and retry states. Images open using the existing
Fancybox integration, grouped separately per album, with ordinary image links
as a fallback if the external library is unavailable.

`?album=india&page=2` opens page two of that section and scrolls to it after the
initial section layouts load. Other albums remain visible on their first pages.
Changing a section's page changes only that section and updates the deep link.

On localhost, the API and uploaded images use the same origin as the client,
through Vite's existing `/api` and `/uploads` proxies. When the static site is
hosted separately, `js/constant.js` supplies `API_URL` and `APP_URL`. Configure
those values for the deployment. Absolute HTTP/HTTPS media URLs are preserved.
Other URL protocols are ignored.

Loading, empty, and failed requests have separate states. Failed requests offer
Try again. Section requests ignore outdated pagination responses; out-of-range
pages reload the last available page. A failed or empty album does not hide
other sections. Album visibility and image ordering remain controlled by the
existing backend.

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
