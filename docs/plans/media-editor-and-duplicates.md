# Media editing and duplicate uploads

## Evidence and scope

Inspected MediaPage, MediaUploader, MediaPicker, media service/model/routes, local storage, and storefront hero rendering. The existing library edits metadata only; uploads start immediately or run in parallel from a manual queue. Filenames are UUIDs and there is no content fingerprint. The hero uses configurable layouts, so preset dimensions below are starting points rather than enforced storefront requirements.

Competitor references checked 2026-11-04:
- Shopify media editor: https://help.shopify.com/en/manual/shopify-admin/productivity-tools/media-editor — crop frames, original/freeform aspect ratios, rotation, proportional resize, revert.
- Wix media manager: https://support.wix.com/en/article/wix-media-about-the-media-manager — Crop & Edit entry point.
- Wix mobile media: https://support.wix.com/en/article/wix-app-uploading-and-managing-your-media — crop/rotate transforms.

No verified competitor claim is made for automatic duplicate warnings. Our duplicate behavior is designed around the existing upload flow.

## Implementation

1. Shared accessible crop editor, available before upload and from library cards. Preview, draggable/touch/keyboard crop, product square 1200×1200, desktop banner 1920×640, mobile banner 900×1200, original ratio, freeform, 90° rotation, proportional output sizing, reset, and save as new image. Presets never upscale small images. Keep transparency using WebP. Do not flatten GIF animation; disable editing GIFs with explanation.
2. Server SHA-256 fingerprint of original bytes, indexed by hash and media type. Compare legacy same-size local files lazily. Equal filenames alone do not imply duplicates. Use transaction advisory locks for simultaneous uploads. Return 409 with existing media; explicit override permits another copy.
3. Upload queue with thumbnails, edit/remove, validation, sequential processing, duplicate warning with existing preview and Use existing / Upload another copy / Skip. Preserve failed rows for retry and keep dialogs open until the batch ends. No global replacement of images.
4. Tests for crop geometry, output size, duplicate matching/override/races at service boundary, uploader decisions/failures, and editor UI. Production build and desktop/mobile browser checks.

## Deployment

Run the content_hash migration before deploying the new server. No existing media is deleted or rewritten. Duplicate matching is exact bytes, not visual similarity. Existing legacy files from a future non-local provider need provider read support/backfill.

## Files changed for this work

Existing unrelated workspace edits were preserved. Changes for this feature are limited to:

- `client/package.json`
- `client/package-lock.json`
- `client/src/components/common/MediaImageEditor.jsx` (new)
- `client/src/components/common/DuplicateMediaDialog.jsx` (new)
- `client/src/components/common/MediaUploader.jsx`
- `client/src/components/common/MediaPicker.jsx`
- `client/src/pages/admin/MediaPage.jsx`
- `client/src/services/mediaService.js`
- `client/src/utils/imageEditing.js` (new)
- `client/src/test/components/MediaImageEditor.test.jsx` (new)
- `client/src/test/components/MediaUploader.test.jsx` (new)
- `client/src/test/components/MediaPicker.uploads.test.jsx` (new)
- `client/src/test/components/storefront/CanvasImagePicker.test.jsx`
- `client/src/test/utils/imageEditing.test.js` (new)
- `server/src/modules/media/media.controller.js`
- `server/src/modules/media/media.service.js`
- `server/src/modules/media/media.model.js`
- `server/src/utils/storage/LocalStorage.js`
- `server/migrations/20261104100000-add-media-content-hash.js` (new)
- `server/tests/unit/media.duplicates.test.js` (new)
- `docs/plans/media-editor-and-duplicates.md` (new)

## Commands

From `client/`:

```sh
npx vitest run src/test/components/MediaUploader.test.jsx src/test/components/MediaImageEditor.test.jsx src/test/components/MediaPicker.uploads.test.jsx src/test/components/storefront/CanvasImagePicker.test.jsx src/test/pages/admin/MediaPage.test.jsx src/test/utils/imageEditing.test.js
npm run build
```

From `server/`:

```sh
npx vitest run tests/unit/media.duplicates.test.js tests/unit/media.type.test.js tests/unit/upload.middleware.test.js
```

Before deploying the new server, apply migrations in the intended environment:

```sh
npm run migrate
```

This runs **all pending migrations**, not just this feature's migration. Review the pending migration list for the intended deployment environment first; this workspace contains other unshipped migration work. The initial media migrations were subsequently applied to local development at the user’s request. Later additions and their migration status are recorded below. Production migrations remain part of deployment.

## Verification and limits

- Client checks: 38 targeted tests across 6 files.
- Server checks: 19 targeted tests across 3 files. HTTP upload fixtures require permission to bind a local port.
- Production Vite build.
- Isolated Chromium component preview at 1440×1000 and 390×844: crop frame keyboard movement and dragging, rotation, preset sizing, exported image dimensions, actual exported pixel orientation for 0/90/180/270°, duplicate reuse, and no page overflow or JavaScript page errors. Preview API responses were mocked; this was not a live-account or live-database test.
- Mechanical UI scan and whitespace check.
- The media hash migration was subsequently applied locally. Simultaneous uploads were not exercised against a running PostgreSQL instance. Service tests verify lock acquisition before lookup and the transaction boundary.
- Exact matching is scoped to media type. Renaming a file still matches; re-encoding or changing metadata/bytes produces a distinct file. No visual similarity claims.
- Existing local assets are compared lazily when same-size uploads arrive; missing originals are skipped. Hash metadata updates commit even when the upload returns a duplicate warning.
- GIFs remain uploadable, but editing is disabled to preserve animation. PNG/WebP transparency is retained. Exports cap either dimension at 4096 px and file size at 5 MB.
- Editing a third-party image requires that host to permit cross-origin image access. A failed load/export shows a recoverable error.
- Cancel aborts the request and keeps unresolved queue items available. An upload already accepted by the server may still finish; cancellation is not a rollback of saved files.

## Bulk crop follow-up

Added a library **Crop selected** action for up to 50 selected images. Users with upload permission can select and crop without delete permission. The dialog applies presets using each source's own dimensions, shows each output preview and dimensions, allows excluding items and adjusting one crop independently, and saves new files sequentially. It preserves originals and existing placements. Save failures remain retryable without resaving successful items; duplicates use the existing reuse/copy/skip dialog. Stop finishes the current image before leaving the rest pending. Preparing previews can be cancelled by closing the dialog.

Additional/updated files:
- `client/src/components/common/BulkMediaCropDialog.jsx` (new)
- `client/src/components/common/MediaImageEditor.jsx` (initial crop settings and apply-to-preview mode)
- `client/src/pages/admin/MediaPage.jsx` (bulk entry point and selection permissions)
- `client/src/utils/imageEditing.js` (source-specific presets and bounded previews)
- `client/src/test/components/BulkMediaCropDialog.test.jsx` (new)
- `client/src/test/pages/admin/MediaPage.test.jsx` (bulk entry point and permission checks)
- `client/src/test/utils/imageEditing.test.js` (mixed orientation and small sources)
- `client/.env.development.local` (local-only API override to `/api`; uses Vite proxy to avoid localhost/127.0.0.1 CORS mismatch)

Run all media client tests including bulk:

```sh
npx vitest run src/test/components/BulkMediaCropDialog.test.jsx src/test/components/MediaUploader.test.jsx src/test/components/MediaImageEditor.test.jsx src/test/components/MediaPicker.uploads.test.jsx src/test/components/storefront/CanvasImagePicker.test.jsx src/test/pages/admin/MediaPage.test.jsx src/test/utils/imageEditing.test.js
```

Browser QA for the bulk dialog uses an isolated component preview with simulated upload responses. The signed-in Chrome tab was found, but its browser connector failed to read content or capture screenshots. Authenticated live UI verification could not be completed through that connection; the user's signed-in tab was left untouched. The earlier credentials were rejected by the real API; no account or password was changed.

Final bulk verification: 51 client media checks and 19 server media checks passed (70 total), production build passed, UI mechanical scan returned no findings, and `git diff --check` passed. Read-only database inspection confirmed both `media.content_hash` and `idx_media_content_hash_type`; frontend and backend health returned HTTP 200. Browser preview checks covered batch presets, a 600×800 individual override while other mobile crops stayed 900×1200, responsive desktop/mobile layout, and saving two included images while the third remained unsaved. Preview upload responses were simulated. Screenshots are stored in the session visualization `media/` directory. The temporary QA preview was stopped after testing; normal app servers remain running.

Recommended follow-ups: user-saved crop presets and a per-image focal-point aid. These are recommendations, not implemented features. A full application-wide audit was not performed; checks were scoped to media and the local API connection.


## Store-wide saved custom crop presets — 2026-11-05

Implemented at the user's request, with explicit confirmation that presets are shared across admins/devices. Presets are persisted in PostgreSQL, not browser storage. The local development migration `20261105100000-create-media-crop-presets.js` was applied successfully; it was the only pending migration.

Users with media upload permission can manage presets from either crop editor: create a unique name (1–60 trimmed characters), set whole output dimensions (1–4096 px), edit, remove, and undo removal. Names are case-insensitively unique among active presets. The store has a cap of 50 active custom presets. Mutations serialize capacity checks with a transaction-scoped advisory lock; database constraints enforce dimensions and active-name uniqueness. Removal is soft deletion. Presets refresh on opening, window focus, local mutations, or the Refresh presets button.

A saved preset defines a ratio and maximum output dimensions. Every image gets a crop based on its own resolution; smaller originals are never upscaled. Single/bulk reviewed crops carry a definition snapshot so changing or removing a shared preset does not silently alter current previews or existing images. Built-in presets remain available if custom presets fail to load. No focal-point feature was added in this follow-up.

### Exact files changed for saved presets

- `server/migrations/20261105100000-create-media-crop-presets.js` (new)
- `server/src/modules/media/cropPreset.model.js` (new)
- `server/src/modules/media/cropPreset.service.js` (new)
- `server/src/modules/media/cropPreset.controller.js` (new)
- `server/src/modules/media/media.routes.js`
- `server/src/modules/media/media.validation.js`
- `server/tests/unit/media.cropPresets.test.js` (new)
- `server/tests/integration/cropPresets.postgres.check.js` (new)
- `client/src/hooks/useCropPresets.js` (new)
- `client/src/components/common/CropPresetManager.jsx` (new)
- `client/src/components/common/MediaImageEditor.jsx`
- `client/src/components/common/BulkMediaCropDialog.jsx`
- `client/src/services/mediaService.js`
- `client/src/utils/imageEditing.js`
- `client/src/test/components/CropPresetManager.test.jsx` (new)
- `client/src/test/components/CropPresets.integration.test.jsx` (new)
- `client/src/test/components/MediaImageEditor.test.jsx`
- `client/src/test/utils/imageEditing.test.js`
- `docs/plans/media-editor-and-duplicates.md`

### Verification

60 client media tests and 34 server media tests passed (94 total). Production build, mechanical UI checks, and whitespace checks passed. A separate real PostgreSQL probe passed create/list/update/soft-delete/restore/unique-name checks; all fixture rows rolled back. Desktop and mobile UI checks used an isolated preview with simulated preset API responses. Creation in the single editor and reuse in bulk produced an 800×1000 output preview. The browser preview did not write test presets to the real store.

From `client/`:

```sh
npx vitest run src/test/components/CropPresetManager.test.jsx src/test/components/CropPresets.integration.test.jsx src/test/components/BulkMediaCropDialog.test.jsx src/test/components/MediaUploader.test.jsx src/test/components/MediaImageEditor.test.jsx src/test/components/MediaPicker.uploads.test.jsx src/test/components/storefront/CanvasImagePicker.test.jsx src/test/pages/admin/MediaPage.test.jsx src/test/utils/imageEditing.test.js
npm run build
```

From `server/`:

```sh
npx vitest run tests/unit/media.cropPresets.test.js tests/unit/media.duplicates.test.js tests/unit/media.type.test.js tests/unit/upload.middleware.test.js
node tests/integration/cropPresets.postgres.check.js
```

The PostgreSQL probe refuses production or non-local database hosts. Other environments need their normal migration deployment before the preset API is used. Authenticated browser end-to-end verification was not performed; database behavior and UI behavior were verified separately.

## Update existing images and restore originals — 2026-11-05

This follow-up supersedes the earlier copy-only behavior for **existing library images**. Crop → Save image now updates the same Media ID, URL, filename, originalName, and original encoding. Existing database references and URL-backed placements continue to point at the edited image. Bulk cropping launched from the library uses the same update operation. Editing a newly selected upload still prepares a new upload normally.

Existing-image editing requires MEDIA_UPDATE, including bulk crop selection; MEDIA_UPLOAD alone cannot replace a saved image. Both permissions can read crop presets; managing shared presets still requires MEDIA_UPLOAD. The single editor explains that saving affects every placement. Once edited, it offers Revert to original with confirmation. Reversion restores the exact original source bytes and regenerated renditions. Multiple edits never replace the first original backup.

The private original lives in the persistent uploads volume under `.originals/`, with restricted permissions and static dotfile access denied. Backup publication is atomic and happens before public replacement. Public files use atomic rename per rendition; a database or write failure triggers restoration of prior bytes. PostgreSQL row locks serialize simultaneous edits of one Media record. Individual file renames are atomic, but the filesystem and database cannot form a crash-atomic distributed transaction; the durable original remains available after a process interruption. Keep `.originals/` when backing up or migrating the upload volume. Deleting a media record also removes its original backup.

Upload responses now revalidate rather than using a one-year immutable cache. The media URL helper uses a migration marker to bypass former immutable browser caches for local upload URLs, and the library/editor also includes the media revision. Already-open storefront pages need a reload to request the changed image; this does not push live updates into existing browser tabs. Rendering that directly uses a legacy raw URL without the shared URL helper may require a hard refresh for a previously cached immutable response.

Only local static JPEG, PNG, and WebP images can be replaced. GIF and animated images are rejected. Output preserves the saved format, caps decoded pixels at 40 million, and rejects an encoded replacement above 5 MB. The local migration `20261105120000-add-media-edit-state.js` was applied; production needs it before deployment. No production changes were made.

### Files changed in this follow-up

- server/migrations/20261105120000-add-media-edit-state.js
- server/src/modules/media/mediaEditing.service.js
- server/src/modules/media/media.model.js
- server/src/modules/media/media.controller.js
- server/src/modules/media/media.routes.js
- server/src/modules/media/media.service.js
- server/src/utils/storage/LocalStorage.js
- server/src/app.js (only the uploads cache/dotfile configuration)
- server/tests/unit/mediaEditing.test.js
- server/tests/integration/mediaEditing.postgres.check.js
- client/src/services/mediaService.js
- client/src/utils/media.js
- client/src/components/common/MediaImageEditor.jsx
- client/src/components/common/BulkMediaCropDialog.jsx
- client/src/pages/admin/MediaPage.jsx
- client/src/test/components/MediaImageEditor.test.jsx
- client/src/test/components/BulkMediaCropDialog.test.jsx
- client/src/test/pages/admin/MediaPage.test.jsx
- client/src/test/utils/media.test.js
- docs/plans/media-editor-and-duplicates.md

### Verification

65 client media/URL tests, 26 server edit/duplicate/preset tests, production build, and whitespace checks passed. The real PostgreSQL probe verified concurrent saves, stable image identity/name/URL/format, the first original surviving repeated edits, and exact restoration. Its temporary media record and temporary files were removed. Authenticated browser end-to-end testing was not performed. PR #167 was already merged; this follow-up is prepared independently against the current main branch.

Commands from client/: `npx vitest run src/test/components/BulkMediaCropDialog.test.jsx src/test/components/MediaImageEditor.test.jsx src/test/utils/media.test.js src/test/pages/admin/MediaPage.test.jsx src/test/components/MediaUploader.test.jsx src/test/components/MediaPicker.uploads.test.jsx src/test/components/CropPresets.integration.test.jsx src/test/components/CropPresetManager.test.jsx src/test/utils/imageEditing.test.js` and `npm run build`.

Commands from server/: `npx vitest run tests/unit/mediaEditing.test.js tests/unit/media.duplicates.test.js tests/unit/media.cropPresets.test.js` and `node tests/integration/mediaEditing.postgres.check.js`.
