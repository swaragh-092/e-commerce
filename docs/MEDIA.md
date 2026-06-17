# Media Module

## Overview

The media module provides a centralized file upload, storage, and management system for the e-commerce platform. It supports image uploads with automatic resizing, a media library UI, and reusable picker/uploader components.

---

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   Client (React)                  │
│  ┌──────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │MediaPage │  │MediaPicker  │  │MediaUploader │  │
│  └────┬─────┘  └──────┬──────┘  └──────┬──────┘  │
│       │               │                │          │
│       └───────────────┼────────────────┘          │
│                       │                           │
│               ┌───────┴───────┐                   │
│               │ mediaService  │                   │
│               └───────┬───────┘                   │
└───────────────────────┼───────────────────────────┘
                        │ HTTP /api/media/*
┌───────────────────────┼───────────────────────────┐
│                Express Router                     │
│  ┌──────────────┐  ┌──────────┐  ┌────────────┐  │
│  │media.routes  │  │  auth +  │  │   audit    │  │
│  │  (multer)    │  │  perms   │  │ middleware │  │
│  └──────┬───────┘  └──────────┘  └────────────┘  │
│         │                                          │
│  ┌──────┴───────┐                                │
│  │ media.controller  │                            │
│  └──────┬───────┘                                │
│         │                                          │
│  ┌──────┴───────┐      ┌───────────────────┐     │
│  │ media.service │──────│  sharp (resize)   │     │
│  └──────┬───────┘      └───────────────────┘     │
│         │                                          │
│  ┌──────┴───────┐      ┌───────────────────┐     │
│  │ Media (model) │──────│  PostgreSQL       │     │
│  └──────────────┘      └───────────────────┘     │
│         │                                          │
│  ┌──────┴───────┐      ┌───────────────────┐     │
│  │ filesystem   │──────│  ./uploads/        │     │
│  └──────────────┘      └───────────────────┘     │
└──────────────────────────────────────────────────┘
```

### Data Flow

1. **Upload**: Client sends multipart file → multer (memory storage) → service validates via `file-type` magic bytes → sharp creates resized variants → record saved to `media` table → files written to `./uploads/`
2. **Serve**: Express static middleware at `/uploads` with `Cross-Origin-Resource-Policy` header; Vite dev proxy forwards `/uploads` to backend
3. **Delete**: Service removes all 4 file variants from disk → destroys DB record (FKs set to NULL on product associations)

---

## Database Schema

### `media` table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` | Unique identifier |
| `url` | VARCHAR(500) | NOT NULL | Relative path (e.g. `/uploads/{uuid}.jpg`) |
| `filename` | VARCHAR(255) | NOT NULL | Stored filename (UUID-based) |
| `mime_type` | VARCHAR(100) | NOT NULL | MIME type (e.g. `image/jpeg`) |
| `size` | INTEGER | NOT NULL | File size in bytes |
| `provider` | VARCHAR(50) | DEFAULT 'local' | Storage provider (extensible for cloud) |
| `created_at` | TIMESTAMP | | Auto-generated |
| `updated_at` | TIMESTAMP | | Auto-generated |

### Indexes

- `idx_media_filename` on `filename`

### Foreign Key References

| Table | Column | On Delete |
|-------|--------|-----------|
| `product_images` | `media_id` | `SET NULL` |
| `product_variants` | `media_id` | `SET NULL` |

---

## File Storage Layout

```
./uploads/
├── {uuid}.{ext}          # Original
├── thumbnails/
│   └── {uuid}.{ext}      # 150px width
├── medium/
│   └── {uuid}.{ext}      # 600px width
└── large/
    └── {uuid}.{ext}      # 1200px width
```

All resized versions use `withoutEnlargement: true` (no upscaling).

---

## API Endpoints

All media endpoints require authentication. Mounted at `/api/media`.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/media` | `MEDIA_READ` | List media (paginated: `?page=&limit=`) |
| `POST` | `/api/media/upload` | `MEDIA_UPLOAD` | Upload single file (multipart, field: `file`) |
| `DELETE` | `/api/media/:id` | `MEDIA_DELETE` | Delete media record + files |

### Query Parameters (GET /api/media)

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `limit` | integer | 20 | Items per page (max 1000) |

### Upload Constraints

| Constraint | Value |
|------------|-------|
| File size | 5 MB max |
| Allowed types | JPEG, PNG, WebP, GIF |
| Validation | Server-side via `file-type` (magic bytes) |

### Response Format

```json
{
  "success": true,
  "data": { "media": { ... } },
  "message": "File uploaded successfully"
}
```

List response pagination meta is returned via the `success()` utility with `meta.total`, `meta.page`, `meta.totalPages`, `meta.limit`.

---

## Permissions

| Permission Key | String | Granted To |
|----------------|--------|------------|
| `MEDIA_READ` | `media.read` | admin, super_admin |
| `MEDIA_UPLOAD` | `media.upload` | admin, super_admin |
| `MEDIA_DELETE` | `media.delete` | admin, super_admin |

Defined in `shared/authorization.json`. Checked via `authorizePermissions()` middleware.

---

## Frontend Components

### MediaPage (`/admin/media`)

Full media library management page with:
- Grid display of all uploaded media
- Sort by date/size (ascending/descending)
- Group by date/size/file type
- Copy URL to clipboard
- Delete with confirmation dialog
- Upload button → opens MediaUploader in dialog

### MediaPicker (reusable)

WordPress-style dialog for selecting media from other admin pages:
- Two tabs: Upload Files / Media Library
- Search/filter library
- Single or multi-select mode
- Auto-select on upload (single mode)

Used by: ProductEditPage, CategoriesPage, BrandsPage, SettingsPage, PageEditPage

### MediaUploader (reusable)

Drag-and-drop file upload component:
- Validation: file type + size (client + server)
- Auto-upload mode (files uploaded immediately)
- Manual mode (queue files, then upload)
- Multi-file support

### AvatarUploader

User profile avatar upload component:
- Two-step flow: upload to `/media/upload` → get `mediaId` → update avatar via user service

---

## Image Processing Pipeline

```
Client file → multer (memory) → file-type (magic bytes validation)
  → sharp.resize(150) → thumbnails/{uuid}.ext
  → sharp.resize(600) → medium/{uuid}.ext
  → sharp.resize(1200) → large/{uuid}.ext
  → fs.writeFile(original) → uploads/{uuid}.ext
  → Media.create({ url, filename, mimeType, size })
```

---

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `UPLOAD_DIR` | `./uploads` | Upload directory path |
| `MAX_FILE_SIZE` | 5242880 (5MB) | Max file size in bytes |

Docker volume mount: `./server/uploads:/app/uploads`

---

## Key Dependencies

| Package | Usage |
|---------|-------|
| `multer` | Multipart file upload handling |
| `sharp` | Image resizing/processing |
| `file-type` | Magic byte MIME validation |
| `uuid` | Unique filename generation |
| `@mui/x-data-grid` | Not used for media |

---

## Related Files

### Backend

| File | Purpose |
|------|---------|
| `server/src/modules/media/media.model.js` | Sequelize model |
| `server/src/modules/media/media.controller.js` | Request handler |
| `server/src/modules/media/media.service.js` | Business logic + image processing |
| `server/src/modules/media/media.routes.js` | Express router + multer config |
| `server/src/middleware/upload.middleware.js` | Separate multer config for avatars |
| `server/migrations/*-create-media.js` | Database migration |
| `server/migrations/*-link-product-images-to-media.js` | Product image FK migration |
| `server/migrations/*-add_media_id_to_product_variants.js` | Variant FK migration |
| `server/src/app.js` (lines 61-73) | Static serving setup |

### Frontend

| File | Purpose |
|------|---------|
| `client/src/pages/admin/MediaPage.jsx` | Media library admin page |
| `client/src/components/common/MediaPicker.jsx` | Reusable media selection dialog |
| `client/src/components/common/MediaUploader.jsx` | Drag-drop file upload component |
| `client/src/components/common/AvatarUploader.jsx` | User avatar upload |
| `client/src/services/mediaService.js` | API service layer |
| `client/src/utils/media.js` | `getMediaUrl()` URL resolution utility |
| `client/src/utils/permissions.js` | Route/permission mapping |

---

## Audit Logging

Media mutations are logged via `auditLog('Media')` middleware on:
- `POST /api/media/upload` → CREATE action
- `DELETE /api/media/:id` → DELETE action

---

## Extending to Cloud Storage

The `provider` column in the `media` table is designed to support future cloud storage backends. To add e.g. S3:

1. Create a storage adapter (e.g. `storage/s3.adapter.js`) implementing `upload()`, `delete()`
2. Update `media.service.js` to switch on `provider` value
3. Update `getMediaUrl()` to return the CDN URL for cloud-stored files
