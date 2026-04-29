# Database Schema Documentation (v2)

> **ORM**: Sequelize 6+  
> **Database**: PostgreSQL 15+  
> **Conventions**: UUID primary keys, timestamps on all tables, soft delete where noted  
> **Key Updates in v2**: CHECK constraints, coupon tables, notification tables, webhook_events, address snapshot in orders, weight + taxRate on products, DB-backed RBAC tables

## Table of Contents
1. [Settings](#settings)
2. [Users & Auth](#users--auth)
3. [Products & Categories](#products--categories)
4. [Advanced Products (Variations, Attributes, Custom Fields)](#advanced-products-variations-attributes-custom-fields)
5. [Carts & Orders](#carts--orders)
6. [Promotions & Wishlists](#promotions--wishlists)
7. [Reviews & Feedback](#reviews--feedback)
8. [Notifications & Logging](#notifications--logging)
9. [Media](#media)
10. [Indexes Overview](#indexes-overview)

---

## Settings

```sql
CREATE TABLE settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           VARCHAR(255) UNIQUE NOT NULL,
  value         JSONB NOT NULL,
  "group"       VARCHAR(50) NOT NULL,                 -- 'theme' | 'features' | 'seo' | 'general' | 'shipping' | 'tax'
  updated_by    UUID REFERENCES users(id),
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);
```

---

## Users & Auth

```sql
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(255) UNIQUE NOT NULL,
  password        VARCHAR(255) NOT NULL,              -- bcrypt hash (cost 12)
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  role            VARCHAR(20) DEFAULT 'customer',     -- 'super_admin' | 'admin' | 'customer'
  status          VARCHAR(20) DEFAULT 'active',       -- 'active' | 'inactive' | 'banned'
  email_verified  BOOLEAN DEFAULT FALSE,
  last_login_at   TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  deleted_at      TIMESTAMP                           -- soft delete (paranoid)
);

CREATE TABLE user_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  phone           VARCHAR(20),
  avatar          VARCHAR(500),
  date_of_birth   DATE,
  gender          VARCHAR(20),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE refresh_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  token           VARCHAR(500) UNIQUE NOT NULL,
  expires_at      TIMESTAMP NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE password_reset_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  token           VARCHAR(500) UNIQUE NOT NULL,
  expires_at      TIMESTAMP NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE email_verification_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  token           VARCHAR(500) UNIQUE NOT NULL,
  expires_at      TIMESTAMP NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  slug            VARCHAR(100) UNIQUE NOT NULL,
  description     VARCHAR(255),
  base_role       VARCHAR(20) NOT NULL DEFAULT 'admin', -- 'customer' | 'admin' | 'super_admin' for seeded system roles
  is_system       BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key             VARCHAR(120) UNIQUE NOT NULL,         -- e.g. 'products.read'
  name            VARCHAR(120) NOT NULL,
  permission_group VARCHAR(60) NOT NULL,               -- e.g. 'products', 'orders', 'roles'
  description     VARCHAR(255),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE role_permissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id   UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (role_id, permission_id)
);

CREATE TABLE user_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id         UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, role_id)
);
```

### RBAC Notes

- `users.role` still exists for backward compatibility and base-role checks during the transition to DB-backed RBAC.
- Seeded system roles are `customer`, `admin`, and `super_admin`.
- Custom roles are stored in `roles` with `is_system = false` and currently use `base_role` of `customer` or `admin`.
- Access-control permissions like `roles.manage` and `users.assign_roles` are reserved for super admins.

---

## Products & Categories

```sql
CREATE TABLE categories (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) UNIQUE NOT NULL,
  description     TEXT,
  parent_id       UUID REFERENCES categories(id) ON DELETE SET NULL,
  image           VARCHAR(500),
  sort_order      INTEGER DEFAULT 0,
  meta_title      VARCHAR(255),
  meta_description TEXT,
  meta_keywords   VARCHAR(500),
  og_image        VARCHAR(500),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(255) UNIQUE NOT NULL,
  description       TEXT,                               -- sanitized HTML
  short_description VARCHAR(500),
  sku               VARCHAR(100) UNIQUE,
  price             DECIMAL(10,2) NOT NULL,
  sale_price        DECIMAL(10,2),
  quantity          INTEGER DEFAULT 0,
  reserved_qty      INTEGER DEFAULT 0,
  weight            DECIMAL(8,2),                       -- grams (for shipping calc)
  tax_rate          DECIMAL(5,4),                       -- per-product tax override (nullable)
  status            VARCHAR(20) DEFAULT 'draft',
  is_featured       BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),
  deleted_at        TIMESTAMP,                          -- soft delete
  meta_title        VARCHAR(255),                       -- SEO title
  meta_description  TEXT,                               -- SEO description
  meta_keywords     VARCHAR(500),                       -- SEO keywords (internal)
  og_image          VARCHAR(500),                       -- Social share image

  -- CHECK constraints
  CONSTRAINT chk_price_positive CHECK (price > 0),
  CONSTRAINT chk_sale_price CHECK (sale_price IS NULL OR sale_price < price),
  CONSTRAINT chk_quantity CHECK (quantity >= 0),
  CONSTRAINT chk_reserved CHECK (reserved_qty >= 0 AND reserved_qty <= quantity)
);

CREATE TABLE product_images (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  url             VARCHAR(500) NOT NULL,              -- fallback/legacy
  media_id        UUID REFERENCES media(id) ON DELETE SET NULL,
  alt             VARCHAR(255),
  sort_order      INTEGER DEFAULT 0,
  is_primary      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  name            VARCHAR(100) NOT NULL,
  value           VARCHAR(100) NOT NULL,
  price_modifier  DECIMAL(10,2) DEFAULT 0,
  quantity        INTEGER DEFAULT 0,
  sku             VARCHAR(100),
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_variant_qty CHECK (quantity >= 0),
  deleted_at      TIMESTAMP                           -- soft delete (paranoid)
);

CREATE TABLE tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) UNIQUE NOT NULL,
  slug            VARCHAR(100) UNIQUE NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_tags (
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  tag_id          UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

CREATE TABLE product_categories (
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, category_id)
);
```

---

## Cart

```sql
CREATE TABLE carts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id      VARCHAR(255),
  status          VARCHAR(20) DEFAULT 'active',       -- 'active' | 'merged' | 'converted' | 'expired'
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_cart_owner CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
);

CREATE TABLE cart_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id         UUID REFERENCES carts(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id      UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_cart_qty CHECK (quantity > 0)
);
```

---

## Coupons *(NEW)*

```sql
CREATE TABLE coupons (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              VARCHAR(50) UNIQUE NOT NULL,        -- uppercase, e.g. 'SAVE20'
  type              VARCHAR(20) NOT NULL,               -- 'percentage' | 'fixed_amount'
  value             DECIMAL(10,2) NOT NULL,             -- e.g. 20 for 20% or $20
  min_order_amount  DECIMAL(10,2) DEFAULT 0,            -- minimum cart subtotal
  max_discount      DECIMAL(10,2),                      -- cap for percentage coupons
  usage_limit       INTEGER,                            -- total max uses (NULL = unlimited)
  used_count        INTEGER DEFAULT 0,
  per_user_limit    INTEGER DEFAULT 1,                  -- max uses per customer
  start_date        TIMESTAMP NOT NULL,
  end_date          TIMESTAMP NOT NULL,
  is_active         BOOLEAN DEFAULT TRUE,
  applicable_to     VARCHAR(20) DEFAULT 'all',          -- 'all' | 'category' | 'product'
  applicable_ids    JSONB,                              -- UUIDs of applicable categories/products
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_coupon_value CHECK (value > 0),
  CONSTRAINT chk_coupon_dates CHECK (end_date > start_date),
  CONSTRAINT chk_coupon_percentage_limit CHECK (type != 'percentage' OR value <= 100)
);

CREATE TABLE coupon_usages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id       UUID REFERENCES coupons(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_coupon_code ON coupons(code);
CREATE INDEX idx_coupon_usage_user ON coupon_usages(coupon_id, user_id);
```

---

## Orders & Payments

```sql
CREATE TABLE addresses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  label           VARCHAR(50),
  full_name       VARCHAR(255) NOT NULL,
  phone           VARCHAR(20),
  address_line1   VARCHAR(255) NOT NULL,
  address_line2   VARCHAR(255),
  city            VARCHAR(100) NOT NULL,
  state           VARCHAR(100),
  postal_code     VARCHAR(20) NOT NULL,
  country         VARCHAR(100) NOT NULL,
  is_default      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number              VARCHAR(50) UNIQUE NOT NULL,
  user_id                   UUID REFERENCES users(id),
  status                    VARCHAR(30) DEFAULT 'pending_payment',
  -- Lifecycle: pending_payment → paid → processing → shipped → delivered
  --                                                  ↘ cancelled
  --            paid → refunded
  subtotal                  DECIMAL(10,2) NOT NULL,
  tax                       DECIMAL(10,2) DEFAULT 0,
  shipping_cost             DECIMAL(10,2) DEFAULT 0,
  discount_amount           DECIMAL(10,2) DEFAULT 0,       -- coupon discount
  total                     DECIMAL(10,2) NOT NULL,         -- subtotal + tax + shipping - discount
  coupon_id                 UUID REFERENCES coupons(id),
  shipping_address_snapshot JSONB,                          -- full address at time of order (immutable)
  notes                     TEXT,
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_order_total CHECK (total >= 0)
);

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id),
  snapshot_name   VARCHAR(255) NOT NULL,
  snapshot_price  DECIMAL(10,2) NOT NULL,
  snapshot_image  VARCHAR(500),
  snapshot_sku    VARCHAR(100),
  variant_info    JSONB,                                    -- variant details at time of order
  quantity        INTEGER NOT NULL,
  total           DECIMAL(10,2) NOT NULL,
  created_at      TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_oi_qty CHECK (quantity > 0),
  CONSTRAINT chk_oi_total CHECK (total > 0)
);

CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID UNIQUE REFERENCES orders(id),
  provider        VARCHAR(50) NOT NULL,
  transaction_id  VARCHAR(255),
  amount          DECIMAL(10,2) NOT NULL,
  currency        VARCHAR(10) DEFAULT 'usd',
  status          VARCHAR(20) DEFAULT 'pending',
  metadata        JSONB,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_payment_amount CHECK (amount > 0)
);

-- Webhook idempotency table
CREATE TABLE webhook_events (
  id              VARCHAR(255) PRIMARY KEY,               -- Provider event ID (e.g. evt_xxx, razorpay_id)
  event_type      VARCHAR(100) NOT NULL,
  processed_at    TIMESTAMP DEFAULT NOW()
);

---

## Shipping *(NEW)*

```sql
CREATE TABLE shipping_providers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(50) UNIQUE NOT NULL,
  name            VARCHAR(100) NOT NULL,
  type            VARCHAR(50) DEFAULT 'manual',
  enabled         BOOLEAN DEFAULT TRUE,
  is_default      BOOLEAN DEFAULT FALSE,
  credentials_encrypted TEXT,                         -- AES-256-GCM encrypted
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shipping_zones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) NOT NULL,
  country         VARCHAR(100),
  state           VARCHAR(100),
  pincodes        JSONB DEFAULT '[]',
  enabled         BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shipping_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(150) NOT NULL,
  priority        INTEGER DEFAULT 100,
  enabled         BOOLEAN DEFAULT TRUE,
  zone_id         UUID REFERENCES shipping_zones(id),
  provider_id     UUID REFERENCES shipping_providers(id),
  condition_type  VARCHAR(50) DEFAULT 'all',
  conditions      JSONB DEFAULT '{}',                 -- min_weight, max_weight, min_order, etc.
  rate_type       VARCHAR(50) DEFAULT 'flat',         -- 'flat' | 'percentage' | 'weight_based'
  rate_config     JSONB DEFAULT '{}',
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE shipments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID REFERENCES orders(id) ON DELETE CASCADE,
  provider_id       UUID REFERENCES shipping_providers(id),
  tracking_number   VARCHAR(255),
  tracking_url      VARCHAR(500),
  status            VARCHAR(50) DEFAULT 'pending',
  status_history    JSONB DEFAULT '[]',
  created_at        TIMESTAMP DEFAULT NOW()
);
```

---

## SEO *(NEW)*

```sql
CREATE TABLE seo_overrides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path              VARCHAR(255) UNIQUE NOT NULL,       -- e.g. '/about-us'
  meta_title        VARCHAR(255),
  meta_description  TEXT,
  meta_keywords     VARCHAR(500),
  og_image          VARCHAR(500),
  canonical_url     VARCHAR(500),
  no_index          BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_seo_overrides_path ON seo_overrides(path);
```
```

---

## Wishlist

```sql
CREATE TABLE wishlists (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wishlist_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id     UUID REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE,
  created_at      TIMESTAMP DEFAULT NOW(),
  UNIQUE (wishlist_id, product_id)
);
```

---

## Reviews

```sql
CREATE TABLE reviews (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id           UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  rating               INTEGER NOT NULL,
  title                VARCHAR(255),
  body                 TEXT,                                -- sanitized plain text
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  status               VARCHAR(20) DEFAULT 'pending',
  order_id             UUID REFERENCES orders(id) ON DELETE SET NULL,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW(),

  CONSTRAINT chk_rating CHECK (rating >= 1 AND rating <= 5),
  CONSTRAINT uniq_user_product UNIQUE (user_id, product_id)
);
```

---

## Notification *(NEW)*

```sql
CREATE TABLE notification_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(100) UNIQUE NOT NULL,           -- e.g. 'order_confirmation'
  subject         VARCHAR(500) NOT NULL,                  -- supports {{variables}}
  body_html       TEXT NOT NULL,
  body_text       TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE notification_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name     VARCHAR(100),
  recipient_email   VARCHAR(255) NOT NULL,
  subject           VARCHAR(500),
  status            VARCHAR(20) DEFAULT 'sent',           -- 'sent' | 'failed' | 'bounced'
  user_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  error             TEXT,
  created_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_created ON notification_logs(created_at DESC);
```

---

## Audit Log

```sql
CREATE TABLE audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  action          VARCHAR(50) NOT NULL,
  entity          VARCHAR(100) NOT NULL,
  entity_id       VARCHAR(255),
  changes         JSONB,
  ip_address      VARCHAR(50),
  user_agent      TEXT,
  created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

---

## Media

```sql
CREATE TABLE media (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url             VARCHAR(500) NOT NULL,
  filename        VARCHAR(255) NOT NULL,
  mime_type       VARCHAR(100) NOT NULL,
  size            INTEGER NOT NULL,
  provider        VARCHAR(50) DEFAULT 'local',        -- 'local' | 's3' | 'cloudinary'
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_media_filename ON media(filename);
```
```

---

## Indexes Summary

```sql
-- Products & Categories
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- Orders & Payments
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_coupon_usage_order_id ON coupon_usages(order_id);

-- Cart
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_carts_user ON carts(user_id);
CREATE INDEX idx_carts_status ON carts(status);

-- Reviews
CREATE INDEX idx_reviews_product ON reviews(product_id);
CREATE INDEX idx_reviews_status ON reviews(status);

-- Addresses
CREATE INDEX idx_addresses_user ON addresses(user_id);

-- Full-text search (optional, for large catalogs)
-- CREATE INDEX idx_products_fts ON products USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

---

*All UUIDs use `gen_random_uuid()`. Sequelize handles timestamps via `timestamps: true`. Soft deletes use `paranoid: true`. All CHECK constraints enforce data integrity at the database level.*
