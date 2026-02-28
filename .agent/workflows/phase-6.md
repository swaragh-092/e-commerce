---
description: How to build Phase 6 — SEO, Background Jobs, Setup CLI, and Docker deployment
---

# Phase 6 — Polish & Deployment (SEO, Cron, CLI, Docker)

// turbo-all

## Prerequisites
Phase 5 must be complete (admin dashboard working).

## Step 1: Implement SEO

Frontend:
```bash
cd /home/sr-user91/Videos/e-commerce/client
npm install react-helmet-async
```
- Wrap App in `<HelmetProvider>`
- Add `<Helmet>` to every page (title, meta description, Open Graph)
- Add JSON-LD structured data: Product schema, BreadcrumbList, Organization

Backend:
- GET /api/sitemap.xml — auto-generate from published products + categories
- Serve robots.txt statically

## Step 2: Implement Background Jobs

Create `server/src/jobs/`:
- `reservationTimeout.job.js` — every 5 min, release expired reservations (15 min timeout)
- `cartCleanup.job.js` — daily 2 AM, expire abandoned carts (30 days)
- `couponExpiry.job.js` — daily midnight, deactivate expired coupons
- `lowStockAlert.job.js` — daily 9 AM, email admins about low stock

Register all jobs in `server/src/app.js` (or a separate `jobs/index.js`).

## Step 3: Create setup-client.sh script

Create `scripts/setup-client.sh`:
- Accept arguments: --name, --logo, --primary, --secondary, --db-name, --db-user, --db-password, --smtp-host, --smtp-user, --smtp-pass
- Copy logo/favicon
- Write config/default.json
- Generate .env
- Create PostgreSQL database
- Run migrations + seeds
- Print success with dev URL

## Step 4: Create Docker files

Create:
- `server/Dockerfile` — multi-stage build, non-root user, health check
- `client/Dockerfile` — build with Vite, serve with Nginx
- `client/nginx.conf` — SPA routing config
- `docker-compose.yml` — client + server + db services with health checks
- `.dockerignore` — node_modules, .git, docs

## Step 5: Create .env.example

Copy all env vars from docs/DEPLOYMENT.md into `.env.example` with placeholder values.

## Step 6: Final testing

```bash
cd /home/sr-user91/Videos/e-commerce
docker-compose up --build
```

Test:
1. Full flow: register → browse → add to cart → checkout → pay → order history
2. Admin: manage products, orders, settings, coupons
3. SEO: check page titles, meta tags, sitemap.xml, robots.txt
4. Cron: verify reservation timeout releases stock after 15 min
5. New client: run setup-client.sh with test values
