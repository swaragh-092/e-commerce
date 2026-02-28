---
description: How to build Phase 2 — Product, Category, and Media modules
---

# Phase 2 — Product Catalog + Category + Media

// turbo-all

## Prerequisites
Phase 1 must be complete (Settings, Auth, Notification modules working).

## Step 1: Build Category module

Follow `/new-module` workflow for `category`:
- Model: self-referencing `parentId` (FK → Category)
- Slug: auto-generated, unique
- Endpoints: GET /api/categories (tree), POST/PUT/DELETE (admin)
- Handle: ON DELETE SET NULL for products when category deleted

## Step 2: Build Product module

Follow `/new-module` workflow for `product`:
- Models: `products`, `product_images`, `product_variants`, `tags`, `product_tags`
- Fields: slug (unique, collision-handled), status (draft/published), reservedQty, weight, taxRate
- CHECK constraints: price > 0, sale_price < price, quantity >= 0, reserved_qty <= quantity
- Soft delete: `paranoid: true`
- Search: ILIKE on name + description with pagination
- Filters: category, price range, tags, status, featured
- Sort: price_asc, price_desc, newest, name_asc
- Admin: bulk upload support (future)

## Step 3: Build Media module

Follow `/new-module` workflow for `media`:
- Upload: Multer with MIME validation (jpeg, png, webp, gif only)
- Resize: Sharp → thumbnail (150px), medium (600px), large (1200px)
- Naming: `{uuid}.{ext}` — NEVER use original filename
- Reject: SVG files
- Storage: local `/uploads/` directory (S3 future)
- Endpoints: POST /api/media/upload, GET /api/media, DELETE /api/media/:id

## Step 4: Seed demo data

Create seeders for:
- 5+ categories (with subcategories)
- 20+ products (with images and variants)
- Tags

```bash
cd /home/sr-user91/Videos/e-commerce/server
npx sequelize-cli seed:generate --name demo-categories
npx sequelize-cli seed:generate --name demo-products
```

## Step 5: Test Phase 2

```bash
cd /home/sr-user91/Videos/e-commerce/server && npm run dev
```

Test:
1. POST /api/categories (admin) — create with parent
2. GET /api/categories — returns tree structure
3. POST /api/products (admin) — create with variants, images, tags
4. GET /api/products — list with filters (category, price, search, sort)
5. GET /api/products/:slug — detail with images + variants
6. DELETE /api/products/:id — soft delete
7. POST /api/media/upload — upload image, check resize
8. Slug collision: create 2 products named "Blue Shirt" → slugs blue-shirt and blue-shirt-1
