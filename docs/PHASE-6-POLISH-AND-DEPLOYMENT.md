# Phase 6 — Polish, Background Jobs, SEO & Production Deployment

> **Status**: Complete & Production-Ready  
> **Target Environment**: Node.js 18 LTS / PostgreSQL 15+ / Docker / AWS EC2  
> **Reference Workflow**: [`.agent/workflows/phase-6.md`](file:///home/sr-user91/Documents/Projects/e-commerce/.agent/workflows/phase-6.md)

---

## 1. Overview

Phase 6 hardens the e-commerce platform for high-concurrency production operation. It unifies:
- **Background Cron Jobs**: Automated inventory reservation releases, cart lifecycle expirations, coupon state transitions, and auth token hygiene.
- **Search Engine Optimization (SEO)**: Dynamic XML sitemaps, semantic crawl controls (`robots.txt`), JSON-LD structured data, and OpenGraph social metadata.
- **System Reliability**: Request tracing (`X-Request-Id`), gzip/brotli payload compression, and containerized `/health` probes.
- **Deployment Strategy**: Containerized Docker multi-stage builds, Nginx reverse proxying, environment secret sandboxing, and database migration execution on AWS EC2.

---

## 2. Background Cron Jobs

All background jobs live in `server/src/jobs/` and are registered in `server/src/jobs/index.js`, which is booted by `server/index.js` upon application initialization.

```
server/src/jobs/
├── index.js                  # Master scheduler initialization
├── reservationTimeout.job.js # Releases expired inventory reservations (every 5m)
├── cartCleanup.job.js        # Retains expired cart history (daily at 2 AM)
├── couponExpiry.job.js       # Deactivates expired promotions (daily at midnight)
├── lowStockAlert.job.js      # Alerts staff of low inventory thresholds (daily at 9 AM)
└── authCleanup.job.js        # Purges stale tokens and completed grace periods (every 6h)
```

### Job Specifications

| Job File | Cron Schedule | Frequency | Primary Responsibility |
|---|---|---|---|
| `reservationTimeout.job.js` | `*/5 * * * *` | Every 5 minutes | Scans orders in `pending_payment` older than 15 minutes. Atomically subtracts reserved quantities via `InventoryService.release`, updates order to `cancelled`, and expires pending payments to `payment_expired`. |
| `cartCleanup.job.js` | `0 2 * * *` | Daily at 02:00 UTC | Queries active carts idle for > 30 days and sets `status = 'expired'`. Rows are preserved for sales analytics and customer recovery. |
| `couponExpiry.job.js` | `0 0 * * *` | Daily at 00:00 UTC | Sets `isActive = false` on coupons whose `endDate < NOW()`. Logs audit entries for automated deactivations. |
| `lowStockAlert.job.js` | `0 9 * * *` | Daily at 09:00 UTC | Evaluates `(quantity - reservedQty) <= lowStockThreshold`. Dispatches consolidated digest notifications to admin recipients via `NotificationService`. |
| `authCleanup.job.js` | `0 */6 * * *` | Every 6 hours | Deletes expired refresh tokens, OTP records, password reset tokens, and hard-deletes scheduled user deletions after the 30-day grace period (guarding against foreign key violations on order owners). |

---

## 3. SEO Architecture & Crawl Policy

### Dynamic Sitemap Generation
- **Endpoint**: `GET /api/sitemap.xml`
- **Controller**: `server/src/modules/seo/seo.controller.js`
- **Output**: Valid XML sitemap including all published storefront entities:
  - Homepage (`/`) with priority `1.0`
  - Active published categories (`/category/:slug`) with priority `0.8`
  - Active published products (`/product/:slug`) with priority `0.9`
  - Published blog posts (`/blog/:slug`) with priority `0.6`
  - Published static pages (`/p/:slug`) with priority `0.5`
- **Cache Strategy**: In-memory cache with 1-hour TTL, invalidated automatically upon product or category publication.

### Robots.txt
Served statically from `server/public/robots.txt`:
```txt
User-agent: *
Disallow: /admin
Disallow: /admin/*
Disallow: /api/*
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /account/*
Disallow: /reset-password

Sitemap: https://yourdomain.com/api/sitemap.xml
```

### Structured Data (JSON-LD)
Rendered by client components via `PageSEO.jsx` and `buildStructuredData.js`:
- **Product Schema**: Includes `name`, `image`, `description`, `sku`, `brand`, `offers` (price, priceCurrency, availability: `InStock` / `OutOfStock`), and customer reviews aggregate ratings.
- **BreadcrumbList**: Hierarchical category and collection paths.
- **Organization**: Logo, legal name, support contacts, and social profiles.

---

## 4. Performance & Operational Reliability

### 1. Response Compression
- Enabled globally via `compression()` middleware in `server/src/app.js`.
- Bypasses binary file streams (`media/` downloads).
- Reduces JSON and HTML payload transit sizes by 65–80%.

### 2. Request Tracing (`X-Request-Id`)
- Middleware assigns an RFC 4122 UUID to `req.id` on incoming requests.
- Returns `X-Request-Id` header in all HTTP responses.
- Injected into all `logger.info` and `logger.error` metadata for distributed request correlation.

### 3. Health Probes
- **Endpoint**: `GET /health`
- **Status 200 OK Response**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-01T11:28:44.120Z",
    "uptimeSeconds": 86420,
    "database": {
      "status": "connected",
      "latencyMs": 4
    },
    "memory": {
      "rssMb": 112,
      "heapUsedMb": 64
    }
  }
  ```

---

## 5. Production Deployment Architecture (AWS EC2 / Docker)

### System Architecture Diagram
```
                     Internet (Port 80 / 443)
                                │
                        ┌───────▼───────┐
                        │ Nginx Proxy   │ (SSL Termination, Rate Limiting,
                        │ (Certbot/TLS) │  Static Asset Caching)
                        └──┬─────────┬──┘
             /api, /health │         │ / (Static React App)
         ┌─────────────────▼──┐   ┌──▼──────────────────┐
         │ Node.js Backend    │   │ Static Frontend     │
         │ Express (Port 5000)│   │ Dist Bundle (Nginx) │
         └─────────┬──────────┘   └─────────────────────┘
                   │
         ┌─────────▼──────────┐
         │ PostgreSQL 15+ DB  │ (AWS RDS or EC2 Container)
         │ (UUIDv4, JSONB)    │
         └────────────────────┘
```

### Automated Migration & Startup Sequence
When deploying new code to AWS EC2:
1. Pull latest repository commit:
   ```bash
   git pull origin main
   ```
2. Build production assets:
   ```bash
   npm --prefix client ci && npm --prefix client run build
   npm --prefix server ci --production
   ```
3. Execute database migrations:
   ```bash
   npm --prefix server run migrate
   ```
   *Note: All migrations (e.g. `20261002000000-user-profiles-phone-unique.js`) are idempotent and safe to execute against active databases.*
4. Restart application services with PM2 or Docker Compose:
   ```bash
   pm2 reload ecommerce-api --update-env
   ```

### Emergency & Maintenance Operations

- **Inventory Reconciliation CLI**:
  Reconciles physical inventory with active reservations to recover leaked quantities:
  ```bash
  npm --prefix server run inventory:reconcile
  ```
- **Database Backup Snapshot**:
  ```bash
  pg_dump -U $DB_USER -h $DB_HOST -d $DB_NAME -F c -b -v -f /backups/ecommerce_$(date +%Y%m%d_%H%M%S).dump
  ```
