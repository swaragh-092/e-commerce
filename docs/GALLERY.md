# Orbi gallery albums and cover photos

Showcase albums are managed under **Admin → Catalog → Gallery**. Only active
showcase albums are public; blog galleries remain separate.

## Visitor flow

- `/demo-orbis-seeds-v1-html/gallery.html` lists available albums as image cards.
- Each card uses the selected cover photo. Without one, the backend returns the
  first image in the album's saved order (priority, creation time, then id).
- Clicking a card opens `gallery-detail.html?album=flower`. This separate page
  displays only that album's images, with a back link and pagination when needed.
- Empty albums remain clickable and have a clear cover/empty-state placeholder.
- Hidden or deleted album links display an unavailable message.

The existing Fancybox lightbox handles image viewing on detail pages. Ordinary
image links still work if the external lightbox library cannot load. Previously
shared `gallery.html?album=...` links remain supported as album views.

## Admin cover selection

Select an album and choose **Choose cover photo** to pick an image from the Media
Library. The cover can be separate from the album images. **Use first image**
clears the selected cover and restores automatic first-image selection. Reordering
album images changes the automatic cover; an explicitly chosen cover stays fixed.
Existing media-update permissions govern cover changes.

The optional `coverMediaId` field accepts an existing image UUID or `null`.
The `cover_media_id` foreign key uses `ON DELETE SET NULL`, so deleting a cover
reference restores automatic cover selection. Public album summaries expose a
computed `coverImage` (id, URL, alt, caption, MIME type) without returning the full
image collection. The first-image lookup is limited to one ordered image per album.

## API and deployment

The index reads `GET /api/galleries/public`. Detail pages read
`GET /api/galleries/public/:slug?page=1&limit=20`. While an older backend is still
deployed without cover metadata, the index requests only its first album image
with `limit=1` as a compatibility fallback.

Both pages honor `API_URL` and `APP_URL` from `js/constant.js`, including localhost
previews. To use a local backend, configure those values explicitly for that
backend. A separately hosted API must allow the page origin through CORS. Absolute
HTTP/HTTPS image URLs remain supported; other URL protocols are ignored.

`client/public/demo-orbis-seeds-v1-html` links to the static source directory.
Vite serves it during development and copies regular files into production output.
Checkout requires symbolic-link support.

Run the additive migration before deploying the new backend:

```bash
npm --prefix server run migrate -- --name 20261023140000-add-gallery-cover-media.js
```

This migration was applied to the local database during implementation. It adds
one nullable column and index; no album content or media was removed or selected.
The hosted database was not changed.

## Verification

```bash
npm --prefix client test -- src/test/static/gallery.test.js src/test/pages/admin/GalleryPage.test.jsx
npm --prefix server test -- run tests/unit/gallery.service.test.js
npm --prefix client run build
```

Check that both gallery HTML pages, their scripts, styles and images exist in
`client/dist/demo-orbis-seeds-v1-html/` after building.

## Files changed for this implementation

- `client/src/pages/admin/GalleryPage.jsx`
- `client/src/test/pages/admin/GalleryPage.test.jsx`
- `client/src/test/static/gallery.test.js`
- `demo-orbis-seeds-v1-html/gallery.html`
- `demo-orbis-seeds-v1-html/gallery-detail.html` (new)
- `demo-orbis-seeds-v1-html/js/gallery.js`
- `demo-orbis-seeds-v1-html/css/orbi-seeds.css`
- `server/src/modules/gallery/gallery.model.js`
- `server/src/modules/gallery/gallery.service.js`
- `server/src/modules/gallery/gallery.validation.js`
- `server/tests/unit/gallery.service.test.js`
- `server/migrations/20261023140000-add-gallery-cover-media.js` (new)
- `docs/GALLERY.md`
