# Deployment Guide (v2)

> Deploy each client instance as an independent stack using Docker.  
> **v2 updates**: Security hardening, CORS, cron jobs, email config, backup strategy

---

## Prerequisites

- Docker & Docker Compose installed
- Node.js 20+ (for local development)
- PostgreSQL 15+ (for local development without Docker)
- SMTP credentials (for transactional emails)

---

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# ── App ──
NODE_ENV=production
PORT=5000
CLIENT_URL=http://localhost:3000        # CORS origin (MUST match frontend domain)

# ── Database ──
DB_HOST=db
DB_PORT=5432
DB_NAME=ecommerce
DB_USER=postgres
DB_PASSWORD=your_secure_password

# ── JWT ──
JWT_ACCESS_SECRET=your_access_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# ── Stripe ──
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# ── Email (SMTP) ──
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your_smtp_password
EMAIL_FROM="My Store <noreply@yourdomain.com>"

# ── File Upload ──
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880                   # 5MB in bytes
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,image/gif

# ── Security ──
RATE_LIMIT_WINDOW_MS=60000              # 1 minute
RATE_LIMIT_MAX=100                      # 100 requests per window (global)
```

---

## Local Development

```bash
# 1. Install
cd server && npm install
cd ../client && npm install

# 2. Setup DB
cd ../server
cp ../.env.example ../.env              # Edit with your DB credentials
npx sequelize-cli db:create
npx sequelize-cli db:migrate
npx sequelize-cli db:seed:all           # Seeds demo data + email templates

# 3. Start (Terminal 1: Backend, Terminal 2: Frontend)
cd server && npm run dev                # → http://localhost:5000
cd client && npm run dev                # → http://localhost:3000
```

---

## Docker Deployment

### docker-compose.yml

```yaml
version: '3.8'

services:
  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    depends_on:
      - server
    environment:
      - VITE_API_URL=http://server:5000/api
    restart: unless-stopped

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    ports:
      - "5000:5000"
    depends_on:
      db:
        condition: service_healthy
    env_file:
      - .env
    volumes:
      - uploads:/app/uploads
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
  uploads:
```

### Dockerfile (Server)

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .

FROM node:20-alpine
WORKDIR /app
RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup
COPY --from=builder --chown=appuser:appgroup /app .
USER appuser
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD wget -qO- http://localhost:5000/api/health || exit 1
CMD ["node", "index.js"]
```

### Dockerfile (Client — Nginx)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Security Hardening

### Applied Automatically (in server `app.js`)

| Middleware          | Package              | Purpose                                                 |
| ------------------- | -------------------- | ------------------------------------------------------- |
| **Helmet**          | `helmet`             | Sets X-Frame-Options, CSP, HSTS, X-Content-Type-Options |
| **CORS**            | `cors`               | Restricts API access to `CLIENT_URL` only               |
| **Rate Limiter**    | `express-rate-limit` | Global + per-route limits (see Architecture doc)        |
| **Body Sanitizer**  | `sanitize-html`      | Strips XSS from all request bodies                      |
| **MIME Validation** | `file-type`          | Validates actual file type, not just extension          |
| **Password Policy** | Joi validation       | 8+ chars, mixed case + number                           |

### CORS Configuration

```javascript
const cors = require('cors');
app.use(cors({
  origin: process.env.CLIENT_URL,       // Only your frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
```

> ⚠️ In production, NEVER set `origin: '*'`. Always restrict to the exact frontend domain.

---

## Background Cron Jobs

These run automatically inside the server process using `node-cron`:

| Job                     | Schedule       | What it does                                                                                     |
| ----------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| **Reservation Timeout** | Every 5 min    | Releases `reserved_qty` for orders stuck in `pending_payment` for > 15 min, cancels those orders |
| **Cart Cleanup**        | Daily 2 AM     | Marks `active` carts as `expired` if untouched for 30 days                                       |
| **Coupon Expiry**       | Daily midnight | Sets `is_active = false` for coupons past `end_date`                                             |
| **Low Stock Alert**     | Daily 9 AM     | Emails admins about products with available stock < 5                                            |

---

## Database Backups

### Automated Daily Backup (cron on host)

```bash
# Add to host crontab: crontab -e
0 3 * * * docker exec ecommerce-db pg_dump -U postgres ecommerce | gzip > /backups/ecommerce_$(date +\%Y\%m\%d).sql.gz
```

### Manual Backup

```bash
docker exec ecommerce-db pg_dump -U postgres ecommerce > backup.sql
```

### Restore

```bash
docker exec -i ecommerce-db psql -U postgres ecommerce < backup.sql
```

### Retention Policy
- Keep daily backups for 7 days
- Keep weekly backups for 4 weeks
- Keep monthly backups for 12 months

---

## New Client Setup

```bash
./scripts/setup-client.sh \
  --name "ClientX Store" \
  --logo ./path/to/logo.png \
  --primary "#FF5722" \
  --secondary "#03A9F4" \
  --db-name "clientx_ecommerce" \
  --db-user "clientx_user" \
  --db-password "secure_password" \
  --smtp-host "smtp.gmail.com" \
  --smtp-user "client@example.com" \
  --smtp-pass "app_password"
```

**Steps performed**:
1. Copies logo/favicon to `client/public/assets/`
2. Writes `config/default.json` with custom theme
3. Generates `.env` with DB + SMTP + JWT credentials
4. Creates the PostgreSQL database
5. Runs migrations + seeds (demo data + email templates)
6. Outputs dev server URL

---

## Production Checklist

### Security
- [ ] `NODE_ENV=production`
- [ ] Strong, unique JWT secrets (32+ random chars)
- [ ] CORS restricted to client domain only
- [ ] Helmet enabled
- [ ] Rate limiting on all auth endpoints
- [ ] HTTPS enabled (reverse proxy: Nginx/Caddy)
- [ ] File upload MIME validation active
- [ ] SVG uploads rejected

### Payments
- [ ] Real Stripe keys (not `sk_test_`)
- [ ] Stripe webhook secret configured
- [ ] Webhook idempotency enabled (`webhook_events` table)
- [ ] Test full payment flow before go-live

### Email
- [ ] SMTP credentials configured and tested
- [ ] All email templates created and active
- [ ] Test password reset and order confirmation flows

### Database
- [ ] Automated daily backups running
- [ ] Tested restoration procedure
- [ ] All CHECK constraints active
- [ ] Indexes verified with `EXPLAIN ANALYZE` on key queries

### Monitoring
- [ ] Health check endpoint (`/api/health`) monitored
- [ ] Application logs persisted (not just stdout)
- [ ] Error tracking service configured (optional: Sentry)
- [ ] Disk space alerts for uploads directory

---

*Each client gets a fully independent stack. No shared resources between clients.*
