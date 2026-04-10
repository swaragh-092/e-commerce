# E-Commerce Platform — Architecture Documentation (v2)

> **Version**: 2.0  
> **Last Updated**: 2026-04-07  
> **Purpose**: Reusable, fully customizable e-commerce platform — one codebase, one instance per client.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Architecture Diagram](#architecture-diagram)
4. [Project Structure](#project-structure)
5. [Security & Middleware](#security--middleware)
6. [Module Reference](#module-reference)
7. [Configuration System](#configuration-system)
8. [Feature Flags](#feature-flags)
9. [Background Jobs / Cron](#background-jobs--cron)
10. [API Conventions](#api-conventions)
11. [Client Onboarding](#client-onboarding)
12. [Build Order](#build-order)

---

## Overview

This platform is designed as a **single, production-ready codebase** that is cloned and configured independently per client. There is no multi-tenancy — each customer gets:

- Their own codebase copy
- Their own PostgreSQL database
- Their own deployment/hosting
- Full customization: logo, colors, fonts, layout, features, and even database schema

### Key Principles

| Principle               | Description                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------- |
| **Config-driven**       | Theme, logo, features, SEO — all controlled via DB `Settings` table + JSON fallback |
| **Module-based**        | Server code organized by domain (auth, product, order, etc.)                        |
| **Feature-toggleable**  | Modules like wishlist, reviews, coupons can be enabled/disabled per client          |
| **Soft-deletable**      | Critical entities support soft delete (`deletedAt` timestamps)                      |
| **Audit-tracked**       | Admin actions logged to `AuditLog` table with full change diffs                     |
| **Snapshot-safe**       | Orders store product data + address at time of purchase (immutable)                 |
| **Race-condition-safe** | Inventory uses atomic DB operations; payments use idempotency keys                  |
| **Security-hardened**   | Rate limiting, CORS, Helmet, input sanitization, password policy                    |

---

## Tech Stack

| Layer            | Technology                                      | Version  | Purpose                                             |
| ---------------- | ----------------------------------------------- | -------- | --------------------------------------------------- |
| Frontend         | React                                           | 18+      | UI framework                                        |
| Build Tool       | Vite                                            | 5+       | Fast dev server & bundler                           |
| UI Library       | MUI (Material UI)                               | 5+       | Component library & theming                         |
| Backend          | Node.js + Express                               | 20+ / 4+ | REST API server                                     |
| Database         | PostgreSQL                                      | 15+      | Relational database                                 |
| ORM              | Sequelize                                       | 6+       | DB models, migrations, seeders                      |
| Auth             | JWT + bcrypt                                    | —        | Access/refresh tokens, password hashing             |
| Payments         | Stripe                                          | —        | Payment processing (extensible)                     |
| File Upload      | Multer + Sharp                                  | —        | Image upload & optimization                         |
| Email            | Nodemailer                                      | —        | Transactional email (SMTP / SendGrid / SES)         |
| Cron             | node-cron                                       | —        | Background jobs (cart cleanup, reservation timeout) |
| Security         | helmet, cors, express-rate-limit, sanitize-html | —        | HTTP hardening                                      |
| Containerization | Docker + Docker Compose                         | —        | Deployment                                          |
| **Associations** | **Automatic Wiring**                            | —        | See [ASSOCIATIONS.md](../server/src/modules/ASSOCIATIONS.md) |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENT (Browser)                     │
│  ┌───────────────────────────────────────────────────┐   │
│  │        React (Vite) + MUI Theme Engine            │   │
│  │  ┌──────────────┐    ┌──────────────────────┐     │   │
│  │  │  Storefront   │    │  Admin Dashboard     │     │   │
│  │  │  (Customer)   │    │  (Permission-gated)  │     │   │
│  │  └──────────────┘    └──────────────────────┘     │   │
│  │           │                      │                │   │
│  │           └─────────┬────────────┘                │   │
│  │                     │ REST API (Axios)             │   │
│  └─────────────────────┼────────────────────────────┘   │
└────────────────────────┼────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   SERVER (Express)                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │            Security Middleware Layer             │    │
│  │  ┌────────┐ ┌──────┐ ┌──────┐ ┌─────────────┐  │    │
│  │  │ Helmet │ │ CORS │ │ Rate │ │ Sanitize    │  │    │
│  │  │        │ │      │ │ Limit│ │             │  │    │
│  │  └────────┘ └──────┘ └──────┘ └─────────────┘  │    │
│  ├─────────────────────────────────────────────────┤    │
│  │            Auth Middleware Layer                 │    │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────────┐    │    │
│  │  │ JWT Auth│ │ RBAC Gate│ │ Feature Gate  │    │    │
│  │  └─────────┘ └──────────┘ └───────────────┘    │    │
│  ├─────────────────────────────────────────────────┤    │
│  │               Module Layer                      │    │
│  │  ┌──────┐ ┌─────────┐ ┌───────┐ ┌───────────┐  │    │
│  │  │ Auth │ │ Product │ │ Cart  │ │ Order     │  │    │
│  │  └──────┘ └─────────┘ └───────┘ └───────────┘  │    │
│  │  ┌─────────┐ ┌────────┐ ┌──────────┐ ┌──────┐  │    │
│  │  │ Payment │ │ Coupon │ │ Wishlist │ │Review│  │    │
│  │  └─────────┘ └────────┘ └──────────┘ └──────┘  │    │
│  │  ┌──────────┐ ┌───────┐ ┌───────┐ ┌──────────┐ │    │
│  │  │ Settings │ │ Audit │ │ Media │ │ Notify   │ │    │
│  │  └──────────┘ └───────┘ └───────┘ └──────────┘ │    │
│  ├─────────────────────────────────────────────────┤    │
│  │           Sequelize ORM + Transactions          │    │
│  └──────────────────┬──────────────────────────────┘    │
│                     │                                    │
│  ┌──────────────────┼──────────────────────────────┐    │
│  │           Background Jobs (node-cron)           │    │
│  │  • Cart cleanup  • Reservation timeout          │    │
│  │  • Expired coupon deactivation                  │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────┼──────────────────────────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │   PostgreSQL     │
            │   (Per Client)   │
            └──────────────────┘
```

---

## Project Structure

```
e-commerce/
│
├── client/                              # ── FRONTEND ──
│   ├── public/
│   │   └── assets/                      # Logo, favicon (swap per client)
│   ├── src/
│   │   ├── components/                  # Shared/reusable UI components
│   │   │   ├── common/                  # Button, Input, Modal, Loader...
│   │   │   ├── product/                 # ProductCard, ProductGrid...
│   │   │   ├── cart/                    # CartDrawer, CartItem...
│   │   │   └── layout/                 # Header, Footer, Sidebar...
│   │   ├── pages/
│   │   │   ├── storefront/             # Public customer pages
│   │   │   │   ├── HomePage.jsx
│   │   │   │   ├── ProductListPage.jsx
│   │   │   │   ├── ProductDetailPage.jsx
│   │   │   │   ├── CartPage.jsx
│   │   │   │   ├── CheckoutPage.jsx
│   │   │   │   ├── OrderHistoryPage.jsx
│   │   │   │   ├── AccountPage.jsx
│   │   │   │   ├── LoginPage.jsx
│   │   │   │   └── RegisterPage.jsx
│   │   │   └── admin/                  # Admin pages (permission-gated)
│   │   │       ├── DashboardPage.jsx
│   │   │       ├── ProductsManagePage.jsx
│   │   │       ├── OrdersManagePage.jsx
│   │   │       ├── CustomersPage.jsx
│   │   │       ├── SettingsPage.jsx
│   │   │       ├── AuditLogPage.jsx
│   │   │       └── AccessControlPage.jsx
│   │   ├── layouts/
│   │   │   ├── StoreLayout.jsx         # Header + Footer wrapper
│   │   │   └── AdminLayout.jsx         # Sidebar + TopBar wrapper
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   ├── CartContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   ├── services/                   # API call functions (axios)
│   │   │   ├── api.js                  # Axios instance + interceptors
│   │   │   ├── authService.js
│   │   │   ├── productService.js
│   │   │   ├── cartService.js
│   │   │   ├── orderService.js
│   │   │   └── settingsService.js
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useCart.js
│   │   │   └── useSettings.js
│   │   ├── routes/
│   │   │   ├── AppRoutes.jsx           # Route definitions
│   │   │   └── ProtectedRoute.jsx      # Permission-aware route guard
│   │   ├── theme/
│   │   │   └── muiTheme.js             # createTheme() from config
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── server/                              # ── BACKEND ──
│   ├── src/
│   │   ├── modules/                    # Domain-driven modules
│   │   │   │
│   │   │   ├── auth/
│   │   │   │   ├── auth.model.js       # User, RefreshToken models
│   │   │   │   ├── auth.controller.js  # register, login, logout, refresh
│   │   │   │   ├── auth.service.js     # JWT, bcrypt, token logic
│   │   │   │   ├── auth.routes.js      # POST /register, /login, /refresh
│   │   │   │   └── auth.validation.js  # Joi/Yup schemas
│   │   │   │
│   │   │   ├── user/
│   │   │   │   ├── user.model.js       # User, UserProfile models
│   │   │   │   ├── user.controller.js
│   │   │   │   ├── user.service.js
│   │   │   │   ├── user.routes.js
│   │   │   │   └── user.validation.js
│   │   │   │
│   │   │   ├── product/
│   │   │   │   ├── product.model.js         # Product (slug, status, softDelete, reservedQty)
│   │   │   │   ├── productImage.model.js
│   │   │   │   ├── productVariant.model.js
│   │   │   │   ├── product.controller.js
│   │   │   │   ├── product.service.js
│   │   │   │   ├── product.routes.js
│   │   │   │   └── product.validation.js
│   │   │   │
│   │   │   ├── category/
│   │   │   │   ├── category.model.js        # Self-referencing (parentId)
│   │   │   │   ├── category.controller.js
│   │   │   │   ├── category.service.js
│   │   │   │   ├── category.routes.js
│   │   │   │   └── category.validation.js
│   │   │   │
│   │   │   ├── cart/
│   │   │   │   ├── cart.model.js
│   │   │   │   ├── cartItem.model.js
│   │   │   │   ├── cart.controller.js
│   │   │   │   ├── cart.service.js
│   │   │   │   ├── cart.routes.js
│   │   │   │   └── cart.validation.js
│   │   │   │
│   │   │   ├── order/
│   │   │   │   ├── order.model.js           # Lifecycle enum, snapshot fields
│   │   │   │   ├── orderItem.model.js       # snapshotName, snapshotPrice, snapshotImage
│   │   │   │   ├── order.controller.js
│   │   │   │   ├── order.service.js
│   │   │   │   ├── order.routes.js
│   │   │   │   └── order.validation.js
│   │   │   │
│   │   │   ├── payment/
│   │   │   │   ├── payment.model.js
│   │   │   │   ├── payment.controller.js    # Stripe intent + webhook
│   │   │   │   ├── payment.service.js       # Abstract PaymentProvider interface
│   │   │   │   ├── payment.routes.js
│   │   │   │   └── providers/
│   │   │   │       └── stripe.provider.js
│   │   │   │
│   │   │   ├── coupon/
│   │   │   │   ├── coupon.model.js           # code, type, value, limits, dates
│   │   │   │   ├── couponUsage.model.js     # userId, orderId tracking
│   │   │   │   ├── coupon.controller.js
│   │   │   │   ├── coupon.service.js         # Validation + discount calc
│   │   │   │   ├── coupon.routes.js
│   │   │   │   └── coupon.validation.js
│   │   │   │
│   │   │   ├── wishlist/
│   │   │   │   ├── wishlist.model.js
│   │   │   │   ├── wishlist.controller.js
│   │   │   │   ├── wishlist.service.js
│   │   │   │   └── wishlist.routes.js
│   │   │   │
│   │   │   ├── review/
│   │   │   │   ├── review.model.js
│   │   │   │   ├── review.controller.js
│   │   │   │   ├── review.service.js
│   │   │   │   ├── review.routes.js
│   │   │   │   └── review.validation.js
│   │   │   │
│   │   │   ├── media/
│   │   │   │   ├── media.controller.js
│   │   │   │   ├── media.service.js         # Multer + Sharp
│   │   │   │   └── media.routes.js
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   ├── settings.model.js        # key, value (JSONB), group
│   │   │   │   ├── settings.controller.js
│   │   │   │   ├── settings.service.js      # DB → JSON fallback logic
│   │   │   │   └── settings.routes.js
│   │   │   │
│   │   │   ├── notification/
│   │   │   │   ├── notificationTemplate.model.js  # Email templates
│   │   │   │   ├── notificationLog.model.js       # Sent email logs
│   │   │   │   ├── notification.service.js         # Nodemailer + template rendering
│   │   │   │   └── notification.routes.js
│   │   │   │
│   │   │   └── audit/
│   │   │       ├── audit.model.js           # userId, action, entity, changes (JSONB)
│   │   │       ├── audit.service.js
│   │   │       └── audit.middleware.js       # Auto-log on mutations
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.middleware.js       # JWT verification
│   │   │   ├── role.middleware.js       # Role checking
│   │   │   ├── rateLimiter.middleware.js # Per-route rate limits
│   │   │   ├── sanitize.middleware.js   # XSS/HTML sanitization
│   │   │   ├── validate.middleware.js   # Request body validation (Joi)
│   │   │   ├── upload.middleware.js     # Multer config + MIME validation
│   │   │   └── errorHandler.middleware.js
│   │   │
│   │   ├── jobs/                       # Background cron jobs
│   │   │   ├── cartCleanup.job.js      # Remove abandoned carts (30 days)
│   │   │   ├── reservationTimeout.job.js # Release expired reservations (15 min)
│   │   │   └── couponExpiry.job.js     # Deactivate expired coupons
│   │   │
│   │   ├── config/
│   │   │   ├── database.js             # Sequelize connection
│   │   │   ├── app.js                  # Config loader
│   │   │   └── constants.js            # Enums, status codes
│   │   │
│   │   ├── utils/
│   │   │   ├── response.js             # Standardized API response
│   │   │   ├── pagination.js           # Pagination helper
│   │   │   ├── slugify.js              # Slug generator with collision handling
│   │   │   └── logger.js               # Winston/Pino logger
│   │   │
│   │   └── app.js                      # Express app + middleware + routes
│   │
│   ├── migrations/
│   ├── seeders/
│   ├── index.js
│   └── package.json
│
├── config/
│   └── default.json                    # Fallback theme/features/SEO config
├── scripts/
│   └── setup-client.sh                 # New client provisioning CLI
├── docs/                               # Documentation
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Security & Middleware

All security measures are applied **globally** in `app.js` before any routes:

```javascript
// server/src/app.js
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { sanitizeBody } = require('./middleware/sanitize.middleware');

app.use(helmet());                    // Security headers (X-Frame, CSP, HSTS)
app.use(cors({
  origin: process.env.CLIENT_URL,     // Only allow your frontend domain
  credentials: true
}));
app.use(sanitizeBody());             // Strip XSS from all request bodies
```

### Rate Limiting

Different limits per route group:

| Route Group                  | Limit        | Window | Purpose                       |
| ---------------------------- | ------------ | ------ | ----------------------------- |
| `POST /auth/login`           | 5 requests   | 15 min | Brute force prevention        |
| `POST /auth/register`        | 3 requests   | 1 hour | Spam account prevention       |
| `POST /auth/forgot-password` | 3 requests   | 1 hour | Email bombing prevention      |
| `POST /reviews`              | 5 requests   | 1 day  | Review spam prevention        |
| `POST /coupons/validate`     | 10 requests  | 1 min  | Coupon enumeration prevention |
| Global (all routes)          | 100 requests | 1 min  | General DDoS protection       |

Implementation:
```javascript
// middleware/rateLimiter.middleware.js
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many attempts. Try again in 15 minutes.' } }
});

router.post('/login', loginLimiter, authController.login);
```

### Input Sanitization

**Problem**: Product `description` field supports HTML. Malicious `<script>` tags could be stored and rendered (XSS).

**Solution**:
```javascript
// middleware/sanitize.middleware.js
const sanitizeHtml = require('sanitize-html');

// For rich-text fields (product description, review body)
const sanitizeRichText = (html) => sanitizeHtml(html, {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'img'],
  allowedAttributes: { 'a': ['href'], 'img': ['src', 'alt'] }
});

// For plain text fields — strip ALL html
const sanitizePlainText = (text) => sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
```

### Password Policy

Enforced on both frontend (validation) and backend (Joi schema):

| Rule              | Requirement                            |
| ----------------- | -------------------------------------- |
| Minimum length    | 8 characters                           |
| Uppercase         | At least 1                             |
| Lowercase         | At least 1                             |
| Number            | At least 1                             |
| Special character | At least 1 (recommended, not required) |

```javascript
// auth.validation.js
password: Joi.string()
  .min(8)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .message('Password must be at least 8 chars with uppercase, lowercase, and number')
```

### File Upload Security

| Check                 | Implementation                                                        |
| --------------------- | --------------------------------------------------------------------- |
| MIME type validation  | Verify actual file type using `file-type` package, not just extension |
| File size limit       | `MAX_FILE_SIZE` from `.env` (default 5MB), enforced in Multer         |
| Filename sanitization | Rename all uploads to `{uuid}.{ext}` — prevents path traversal        |
| SVG rejection         | Reject SVG uploads (can contain embedded JavaScript)                  |
| Allowed types         | `image/jpeg`, `image/png`, `image/webp`, `image/gif` only             |

---

## Module Reference

### Module 1 — Settings & Config Engine

**Purpose**: Centralized configuration system that powers theming, feature toggles, and SEO settings.

**Config Priority Chain**:
```
DB Settings table (runtime, admin-editable)
        ↓ fallback if key not found
config/default.json (file-based defaults)
        ↓ fallback if key not found
.env (environment variables)
```

**Settings Model**:
| Column      | Type             | Description                                              |
| ----------- | ---------------- | -------------------------------------------------------- |
| `id`        | UUID             | Primary key                                              |
| `key`       | STRING (unique)  | Setting identifier, e.g. `theme.primaryColor`            |
| `value`     | JSONB            | The setting value (supports any type)                    |
| `group`     | ENUM             | `theme`, `features`, `seo`, `general`, `shipping`, `tax` |
| `updatedBy` | UUID (FK → User) | Last admin who changed it                                |
| `createdAt` | TIMESTAMP        | —                                                        |
| `updatedAt` | TIMESTAMP        | —                                                        |

**Shipping & Tax in Settings**:
| Key                      | Default     | Description                           |
| ------------------------ | ----------- | ------------------------------------- |
| `shipping.method`        | `flat_rate` | `flat_rate` or `free_above_threshold` |
| `shipping.flatRate`      | `5.00`      | Flat shipping cost                    |
| `shipping.freeThreshold` | `50.00`     | Free shipping above this amount       |
| `tax.rate`               | `0.00`      | Default tax rate (e.g., 0.18 for 18%) |
| `tax.inclusive`          | `false`     | Whether prices include tax            |

**API Endpoints**:
| Method | Endpoint               | Access | Description                               |
| ------ | ---------------------- | ------ | ----------------------------------------- |
| GET    | `/api/settings`        | Public | Get all public settings (theme, features) |
| GET    | `/api/settings/:group` | Public | Get settings by group                     |
| PUT    | `/api/settings`        | Admin  | Update settings (bulk)                    |
| PUT    | `/api/settings/:key`   | Admin  | Update single setting                     |

---

### Module 2 — Authentication & Authorization

**System Roles**: `super_admin`, `admin`, `customer`

**RBAC Model**:
- `users.role` remains as a legacy compatibility column and base-role fallback.
- Effective access is derived from DB-backed role assignments and permissions.
- System roles are seeded into `roles`; custom roles are created in `/admin/access-control`.
- Reserved access-control permissions stay super-admin-only.

**Features**:
- Register with email + password (with **password policy** enforcement)
- Login → returns access token (15 min) + refresh token (7 days)
- Token refresh endpoint
- Logout (invalidate refresh token)
- Forgot/reset password (email link via Notification module)
- Email verification (optional, toggleable)
- Permission-aware route + API gating across admin features

**Security Measures**:
| Threat              | Mitigation                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Brute force login   | Rate limiter: 5 attempts / 15 min per IP                                                                              |
| Password leaks      | bcrypt with cost factor 12                                                                                            |
| Weak passwords      | Joi validation: 8+ chars, mixed case + number                                                                         |
| Token theft         | Short-lived access token (15 min), refresh rotation                                                                   |
| Stale sessions      | Refresh token stored in DB — revocable on logout                                                                      |
| After-logout access | Access token valid until expiry (15 min max), acceptable trade-off. For high-security: optional Redis token blacklist |

**User Model**:
| Column          | Type            | Description                        |
| --------------- | --------------- | ---------------------------------- |
| `id`            | UUID            | Primary key                        |
| `email`         | STRING (unique) | Login email                        |
| `password`      | STRING          | bcrypt hash (cost 12)              |
| `firstName`     | STRING          | —                                  |
| `lastName`      | STRING          | —                                  |
| `role`          | ENUM            | Legacy base role / compatibility fallback |
| `status`        | ENUM            | `active`, `inactive`, `banned`     |
| `emailVerified` | BOOLEAN         | —                                  |
| `lastLoginAt`   | TIMESTAMP       | —                                  |
| `deletedAt`     | TIMESTAMP       | Soft delete (paranoid)             |

**RBAC Tables**:
- `roles` — seeded system roles plus custom admin/customer-derived roles
- `permissions` — normalized permission catalog such as `products.read` and `roles.manage`
- `role_permissions` — many-to-many permission mapping for each role
- `user_roles` — many-to-many user assignment table (UI currently manages one active assigned role)

**Related Token Tables**:
- `PasswordResetToken` — `userId`, `token`, `expiresAt`
- `EmailVerificationToken` — `userId`, `token`, `expiresAt`

**API Endpoints**:
| Method | Endpoint                    | Access | Description              |
| ------ | --------------------------- | ------ | ------------------------ |
| POST   | `/api/auth/register`        | Public | Create account           |
| POST   | `/api/auth/login`           | Public | Login → tokens           |
| POST   | `/api/auth/refresh`         | Public | Refresh access token     |
| POST   | `/api/auth/logout`          | Auth   | Invalidate refresh token |
| POST   | `/api/auth/forgot-password` | Public | Send reset email         |
| POST   | `/api/auth/reset-password`  | Public | Reset with token         |

**Frontend Components**:
- `AuthContext` — stores user, tokens, login/logout methods, derived roles, and derived permissions
- `ProtectedRoute` — wraps routes, checks permission and role helpers:
  ```jsx
  <ProtectedRoute permission="dashboard.view">
    <AdminLayout />
  </ProtectedRoute>
  ```

**Admin Access Control UI**:
- `AccessControlPage` lets super admins list roles, inspect permissions, create custom roles, and assign roles to users.
- Custom roles use `baseRole` of `customer` or `admin`; practical access is permission-driven.

---

### Module 3 — Product Catalog

**Product Model**:
| Column             | Type            | Description                                               |
| ------------------ | --------------- | --------------------------------------------------------- |
| `id`               | UUID            | Primary key                                               |
| `name`             | STRING          | Product name                                              |
| `slug`             | STRING (unique) | URL-friendly identifier                                   |
| `description`      | TEXT            | Full description (sanitized HTML)                         |
| `shortDescription` | STRING          | For cards/listings                                        |
| `sku`              | STRING (unique) | Stock keeping unit                                        |
| `price`            | DECIMAL(10,2)   | Regular price (CHECK > 0)                                 |
| `salePrice`        | DECIMAL(10,2)   | Discounted price (CHECK < price)                          |
| `quantity`         | INTEGER         | Stock count (CHECK >= 0)                                  |
| `reservedQty`      | INTEGER         | Reserved during checkout (CHECK >= 0, <= quantity)        |
| `weight`           | DECIMAL(8,2)    | Weight in grams (for future shipping calc)                |
| `taxRate`          | DECIMAL(5,4)    | Per-product tax override (nullable, falls back to global) |
| `status`           | ENUM            | `draft`, `published`                                      |
| `categoryId`       | UUID (FK)       | Category reference                                        |
| `isFeatured`       | BOOLEAN         | Show on homepage                                          |
| `deletedAt`        | TIMESTAMP       | Soft delete                                               |

**Related Models**:
- `ProductImage` — `productId`, `url`, `alt`, `sortOrder`, `isPrimary`
- `ProductVariant` — `productId`, `name` (e.g. "Size"), `value` (e.g. "XL"), `priceModifier`, `quantity` , `sku`
- `Tag` — `name`, `slug`
- `ProductTag` — `productId`, `tagId` (join table)

**Category Model** (self-referencing for subcategories):
| Column        | Type                           | Description              |
| ------------- | ------------------------------ | ------------------------ |
| `id`          | UUID                           | Primary key              |
| `name`        | STRING                         | Category name            |
| `slug`        | STRING (unique)                | URL-friendly             |
| `description` | TEXT                           | —                        |
| `parentId`    | UUID (FK → Category, nullable) | Parent for subcategories |
| `image`       | STRING                         | Category image URL       |
| `sortOrder`   | INTEGER                        | Display order            |

**API Endpoints**:
| Method | Endpoint              | Access | Description                        |
| ------ | --------------------- | ------ | ---------------------------------- |
| GET    | `/api/products`       | Public | List (filters, search, pagination) |
| GET    | `/api/products/:slug` | Public | Product detail                     |
| POST   | `/api/products`       | Admin  | Create product                     |
| PUT    | `/api/products/:id`   | Admin  | Update product                     |
| DELETE | `/api/products/:id`   | Admin  | Soft delete                        |
| GET    | `/api/categories`     | Public | Category tree                      |
| POST   | `/api/categories`     | Admin  | Create category                    |
| PUT    | `/api/categories/:id` | Admin  | Update category                    |
| DELETE | `/api/categories/:id` | Admin  | Delete category                    |

---

### Module 4 — Shopping Cart

**Cart Model**:
| Column      | Type                | Description                                |
| ----------- | ------------------- | ------------------------------------------ |
| `id`        | UUID                | Primary key                                |
| `userId`    | UUID (FK, nullable) | Null for guest carts                       |
| `sessionId` | STRING              | For guest cart tracking                    |
| `status`    | ENUM                | `active`, `merged`, `converted`, `expired` |

**CartItem Model**:
| Column      | Type                | Description       |
| ----------- | ------------------- | ----------------- |
| `id`        | UUID                | Primary key       |
| `cartId`    | UUID (FK)           | Cart reference    |
| `productId` | UUID (FK)           | Product reference |
| `variantId` | UUID (FK, nullable) | Variant reference |
| `quantity`  | INTEGER             | (CHECK > 0)       |

**Guest → Logged-in Merge Flow**:
1. Guest adds items → stored in localStorage + optionally synced to DB with `sessionId`
2. On login → merge guest cart items into user's existing cart
3. Mark guest cart as `merged`

**Edge Cases Handled**:

| Edge Case                     | Solution                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Guest → login cart merge      | On login, merge guest cart items into user's existing cart, mark guest cart as `merged`                                                  |
| Cart item for deleted product | On cart fetch, filter out items where product is soft-deleted; notify customer                                                           |
| Price changed while in cart   | **At checkout**: re-validate all prices server-side against current product data, recalculate totals, warn customer if any price changed |
| Abandoned cart cleanup        | Cron job: mark carts as `expired` if `status = 'active'` AND `updated_at < NOW() - 30 days`                                              |

**API Endpoints**:
| Method | Endpoint              | Access | Description               |
| ------ | --------------------- | ------ | ------------------------- |
| GET    | `/api/cart`           | Auth   | Get user's cart           |
| POST   | `/api/cart/items`     | Auth   | Add item                  |
| PUT    | `/api/cart/items/:id` | Auth   | Update quantity           |
| DELETE | `/api/cart/items/:id` | Auth   | Remove item               |
| POST   | `/api/cart/merge`     | Auth   | Merge guest cart          |
| DELETE | `/api/cart`           | Auth   | Clear entire cart         |

---

### Module 5 — Checkout & Orders

**Order Lifecycle**:
```
pending_payment → paid → processing → shipped → delivered
                                    ↘ cancelled
                  paid → refunded
```

**Order Model**:
| Column                    | Type                | Description                               |
| ------------------------- | ------------------- | ----------------------------------------- |
| `id`                      | UUID                | Primary key                               |
| `orderNumber`             | STRING (unique)     | Human-readable (e.g. ORD-20260228-001)    |
| `userId`                  | UUID (FK)           | Customer                                  |
| `status`                  | ENUM                | See lifecycle above                       |
| `subtotal`                | DECIMAL(10,2)       | Before tax/shipping                       |
| `tax`                     | DECIMAL(10,2)       | Calculated from tax rate                  |
| `shippingCost`            | DECIMAL(10,2)       | Calculated from shipping settings         |
| `discountAmount`          | DECIMAL(10,2)       | Coupon discount (default 0)               |
| `total`                   | DECIMAL(10,2)       | subtotal + tax + shipping - discount      |
| `couponId`                | UUID (FK, nullable) | Applied coupon reference                  |
| `shippingAddressSnapshot` | JSONB               | Full address at time of order (immutable) |
| `notes`                   | TEXT                | Customer notes                            |

**OrderItem Model (Snapshot)**:
| Column          | Type          | Description                      |
| --------------- | ------------- | -------------------------------- |
| `id`            | UUID          | Primary key                      |
| `orderId`       | UUID (FK)     | Order reference                  |
| `productId`     | UUID (FK)     | Original product reference       |
| `snapshotName`  | STRING        | Product name at time of order    |
| `snapshotPrice` | DECIMAL(10,2) | Price at time of order           |
| `snapshotImage` | STRING        | Image URL at time of order       |
| `snapshotSku`   | STRING        | SKU at time of order             |
| `variantInfo`   | JSONB         | Variant details at time of order |
| `quantity`      | INTEGER       | —                                |
| `total`         | DECIMAL(10,2) | snapshotPrice × quantity         |

> **Why snapshots?** If a product is renamed, price changes, or image is updated after an order, the order history must still show exactly what the customer purchased. The `shippingAddressSnapshot` solves the same problem for addresses — a deleted address won't break order history.

**Checkout Flow (Edge-Case-Safe)**:
```
1. Validate cart is not empty
2. Re-fetch current product prices (NEVER trust cart's cached prices)
3. Calculate subtotal from CURRENT prices
4. If any price changed → return 409 with updated prices (frontend warns user)
5. Validate coupon (if applied) — check expiry, usage limit, min order
6. Calculate tax from settings (global rate or per-product override)
7. Calculate shipping from settings (flat rate or free threshold)
8. BEGIN TRANSACTION
   a. Reserve inventory (atomic UPDATE with WHERE check — prevents overselling)
   b. Create Order + OrderItems with snapshots
   c. Create Coupon Usage record (if coupon applied)
   d. Increment coupon.usedCount
   e. Mark cart as 'converted'
9. COMMIT TRANSACTION
10. Create Stripe Payment Intent (with idempotency key = orderId)
11. Return clientSecret to frontend
```

**API Endpoints**:
| Method | Endpoint                 | Access | Description                               |
| ------ | ------------------------ | ------ | ----------------------------------------- |
| POST   | `/api/orders`            | Auth   | Place order                               |
| GET    | `/api/orders`            | Auth   | My orders (customer) / All orders (admin) |
| GET    | `/api/orders/:id`        | Auth   | Order detail                              |
| PUT    | `/api/orders/:id/status` | Admin  | Update status                             |
| POST   | `/api/orders/:id/cancel` | Auth   | Cancel order (if pending)                 |
| GET    | `/api/addresses`         | Auth   | List saved addresses                      |
| POST   | `/api/addresses`         | Auth   | Add address                               |
| PUT    | `/api/addresses/:id`     | Auth   | Update address                            |
| DELETE | `/api/addresses/:id`     | Auth   | Delete address                            |
| PUT    | `/api/addresses/:id/default` | Auth | Set as default                           |

---

### Module 6 — Payment (Stripe)

**Payment Model**:
| Column          | Type              | Description                                  |
| --------------- | ----------------- | -------------------------------------------- |
| `id`            | UUID              | Primary key                                  |
| `orderId`       | UUID (FK, unique) | Order reference                              |
| `provider`      | STRING            | `stripe` (extensible)                        |
| `transactionId` | STRING            | Provider's transaction ID                    |
| `amount`        | DECIMAL(10,2)     | Amount charged (CHECK > 0)                   |
| `currency`      | STRING            | e.g. `usd`, `inr`                            |
| `status`        | ENUM              | `pending`, `completed`, `failed`, `refunded` |
| `metadata`      | JSONB             | Provider-specific data                       |

**WebhookEvent Model** (idempotency):
| Column        | Type        | Description                      |
| ------------- | ----------- | -------------------------------- |
| `id`          | STRING (PK) | Stripe event ID (e.g. `evt_xxx`) |
| `eventType`   | STRING      | e.g. `payment_intent.succeeded`  |
| `processedAt` | TIMESTAMP   | When we processed it             |

**Edge Cases Handled**:

| Edge Case                                               | Solution                                                                                                                                 |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Double payment (user clicks Pay twice)                  | Use Stripe **idempotency key** = `orderId` on `createPaymentIntent`. Same order always gets same intent.                                 |
| Webhook delivered twice                                 | Store `event.id` in `webhook_events` table. Skip if already processed.                                                                   |
| Payment succeeds but server crash before updating order | Stripe webhook (`payment_intent.succeeded`) is the source of truth. Order status update happens in webhook handler, which is idempotent. |
| Refund                                                  | Through admin API → calls Stripe refund API → updates both `Payment.status` and `Order.status` to `refunded`                             |
| Payment fails                                           | Webhook `payment_intent.payment_failed` → update order to `pending_payment` (customer can retry)                                         |

**Extensibility Pattern**:
```javascript
// Abstract interface
class PaymentProvider {
  async createPaymentIntent(amount, currency, metadata) { throw new Error('Not implemented'); }
  async handleWebhook(payload, signature) { throw new Error('Not implemented'); }
  async refund(transactionId, amount) { throw new Error('Not implemented'); }
}

// Per-client swap: stripe.provider.js, razorpay.provider.js, paypal.provider.js
```

**API Endpoints**:
| Method | Endpoint                      | Access | Description                            |
| ------ | ----------------------------- | ------ | -------------------------------------- |
| POST   | `/api/payments/create-intent` | Auth   | Create Stripe payment intent           |
| POST   | `/api/payments/webhook`       | Public | Stripe webhook handler (sig-verified)  |
| POST   | `/api/payments/:id/refund`    | Admin  | Initiate refund                        |

---

### Module 7 — Coupon & Discount *(NEW)*

**Coupon Model**:
| Column           | Type                       | Description                                 |
| ---------------- | -------------------------- | ------------------------------------------- |
| `id`             | UUID                       | Primary key                                 |
| `code`           | STRING (unique, uppercase) | Coupon code (e.g. `SAVE20`)                 |
| `type`           | ENUM                       | `percentage`, `fixed_amount`                |
| `value`          | DECIMAL(10,2)              | Discount value (e.g. 20 for 20% or $20)     |
| `minOrderAmount` | DECIMAL(10,2)              | Minimum order subtotal required             |
| `maxDiscount`    | DECIMAL(10,2)              | Cap for percentage coupons (nullable)       |
| `usageLimit`     | INTEGER                    | Max total uses (nullable = unlimited)       |
| `usedCount`      | INTEGER                    | Current usage count (default 0)             |
| `perUserLimit`   | INTEGER                    | Max uses per customer (default 1)           |
| `startDate`      | TIMESTAMP                  | Valid from                                  |
| `endDate`        | TIMESTAMP                  | Valid until                                 |
| `isActive`       | BOOLEAN                    | Master toggle                               |
| `applicableTo`   | ENUM                       | `all`, `category`, `product`                |
| `applicableIds`  | JSONB                      | Array of category/product UUIDs (if scoped) |

**CouponUsage Model**:
| Column      | Type      | Description      |
| ----------- | --------- | ---------------- |
| `id`        | UUID      | Primary key      |
| `couponId`  | UUID (FK) | Coupon reference |
| `userId`    | UUID (FK) | Who used it      |
| `orderId`   | UUID (FK) | Which order      |
| `createdAt` | TIMESTAMP | When used        |

**Validation Rules** (checked server-side in a transaction):
1. Coupon exists and `isActive = true`
2. Current date is between `startDate` and `endDate`
3. `usedCount < usageLimit` (if limit set)
4. User hasn't exceeded `perUserLimit` (check `CouponUsage` count)
5. Cart subtotal >= `minOrderAmount`
6. If scoped: at least one cart item belongs to applicable category/product
7. On order cancellation/refund: decrement `usedCount` and mark `CouponUsage` as reversed

**API Endpoints**:
| Method | Endpoint                | Rate Limit | Access | Description                 |
| ------ | ----------------------- | ---------- | ------ | --------------------------- |
| POST   | `/api/coupons`          | —          | Admin  | Create coupon               |
| GET    | `/api/coupons`          | —          | Admin  | List coupons                |
| PUT    | `/api/coupons/:id`      | —          | Admin  | Update coupon               |
| DELETE | `/api/coupons/:id`      | —          | Admin  | Delete coupon               |
| POST   | `/api/coupons/validate` | 10/min     | Auth   | Validate & preview discount |

---

### Module 8 — Customer Account

**UserProfile Model**:
| Column        | Type              | Description                                    |
| ------------- | ----------------- | ---------------------------------------------- |
| `id`          | UUID              | Primary key                                    |
| `userId`      | UUID (FK, unique) | Reference to User                              |
| `phone`       | STRING            | —                                              |
| `avatar`      | STRING            | Profile image URL                              |
| `dateOfBirth` | DATE              | —                                              |
| `gender`      | ENUM              | `male`, `female`, `other`, `prefer_not_to_say` |

**Address Model**:
| Column         | Type      | Description            |
| -------------- | --------- | ---------------------- |
| `id`           | UUID      | Primary key            |
| `userId`       | UUID (FK) | Owner                  |
| `label`        | STRING    | "Home", "Office", etc. |
| `fullName`     | STRING    | Recipient name         |
| `phone`        | STRING    | —                      |
| `addressLine1` | STRING    | —                      |
| `addressLine2` | STRING    | —                      |
| `city`         | STRING    | —                      |
| `state`        | STRING    | —                      |
| `postalCode`   | STRING    | —                      |
| `country`      | STRING    | —                      |
| `isDefault`    | BOOLEAN   | Default address        |

> **Address deletion safety**: Addresses can be freely deleted. Orders store the full address as a JSONB `shippingAddressSnapshot`, so order history is never affected by address changes or deletions.

**API Endpoints**:
| Method | Endpoint                 | Access | Description        |
| ------ | ------------------------ | ------ | ------------------ |
| GET    | `/api/users/me`          | Auth   | Get profile        |
| PUT    | `/api/users/me`          | Auth   | Update profile     |
| PUT    | `/api/users/me/password` | Auth   | Change password    |
| GET    | `/api/users`             | Admin  | List all customers |
| GET    | `/api/users/:id`         | Admin  | Customer detail    |

---

### Module 9 — Wishlist *(Feature-Toggleable)*

**Wishlist Model**: `id`, `userId`  
**WishlistItem Model**: `id`, `wishlistId`, `productId` (UNIQUE constraint on `wishlistId + productId`)

| Method | Endpoint                                 | Access | Description    |
| ------ | ---------------------------------------- | ------ | -------------- |
| GET    | `/api/wishlist`                          | Auth   | Get wishlist   |
| POST   | `/api/wishlist/items`                    | Auth   | Add product    |
| DELETE | `/api/wishlist/items/:productId`         | Auth   | Remove product |
| POST   | `/api/wishlist/items/:productId/to-cart` | Auth   | Move to cart   |

---

### Module 10 — Reviews & Ratings *(Feature-Toggleable)*

**Review Model**:
| Column               | Type      | Description                                                      |
| -------------------- | --------- | ---------------------------------------------------------------- |
| `id`                 | UUID      | Primary key                                                      |
| `productId`          | UUID (FK) | Product being reviewed                                           |
| `userId`             | UUID (FK) | Reviewer                                                         |
| `rating`             | INTEGER   | 1–5 stars (CHECK constraint)                                     |
| `title`              | STRING    | Review title (sanitized)                                         |
| `body`               | TEXT      | Review text (sanitized)                                          |
| `isVerifiedPurchase` | BOOLEAN   | Auto-set if user has a `delivered` order containing this product |
| `status`             | ENUM      | `pending`, `approved`, `rejected`                                |

**Constraints**:
- `UNIQUE (userId, productId)` — one review per user per product
- Rate limited: 5 reviews/day per user

**Edge Cases**:
| Case                    | Solution                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| Review without purchase | Allowed, but `isVerifiedPurchase = false`. Configurable via feature flag to require purchase. |
| Review spam             | Rate limiter + admin moderation (`status = pending` by default)                               |
| XSS in review body      | Sanitize with `sanitize-html` (plain text only, no HTML)                                      |

**API Endpoints**:
| Method | Endpoint                      | Access | Description                  |
| ------ | ----------------------------- | ------ | ---------------------------- |
| GET    | `/api/products/:slug/reviews` | Public | Product reviews              |
| POST   | `/api/products/:slug/reviews` | Auth   | Submit review (1 per product)|
| PUT    | `/api/reviews/:id/status`     | Admin  | Moderate (approve/reject)    |
| DELETE | `/api/reviews/:id`            | Admin  | Delete review                |

---

### Module 11 — Admin Dashboard

Built with **MUI DataGrid** for tables and **Recharts** for charts.

**Dashboard Overview**:
- Total Revenue (today / week / month)
- Total Orders (by status)
- Total Customers
- **Low Stock Alerts** (products where `quantity - reservedQty < threshold`)

**Admin Pages**:
| Page      | Features                                                 |
| --------- | -------------------------------------------------------- |
| Dashboard | Sales chart, order summary, quick stats                  |
| Products  | DataGrid, bulk actions, status toggle, image preview     |
| Orders    | DataGrid, status update dropdown, order detail modal     |
| Customers | DataGrid, customer detail, order history                 |
| Coupons   | CRUD, usage stats, activate/deactivate                   |
| Settings  | Theme editor, feature toggles, SEO, shipping, tax config |
| Audit Log | Filterable log of all admin actions                      |

---

### Module 12 — Audit Log

**AuditLog Model**:
| Column      | Type      | Description                                      |
| ----------- | --------- | ------------------------------------------------ |
| `id`        | UUID      | Primary key                                      |
| `userId`    | UUID (FK) | Admin who performed action                       |
| `action`    | STRING    | `CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`    |
| `entity`    | STRING    | `Product`, `Order`, `User`, `Settings`, `Coupon` |
| `entityId`  | STRING    | ID of affected record (supports UUID & numeric)  |
| `changes`   | JSONB     | `{ field: { old: "...", new: "..." } }`          |
| `ipAddress` | STRING    | Request IP                                       |
| `userAgent` | STRING    | Browser/client info                              |
| `createdAt` | TIMESTAMP | When the action occurred                         |

**Implementation**: Express middleware that auto-captures the state before mutation and logs the diff after:
```javascript
const auditLog = (entity) => (req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (data) => {
    if (res.statusCode < 400) {
      AuditService.log({
        userId: req.user.id,
        action: req.method === 'POST' ? 'CREATE' : req.method === 'PUT' ? 'UPDATE' : 'DELETE',
        entity,
        entityId: req.params.id || data?.data?.id,
        changes: req._auditChanges || null,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    }
    return originalJson(data);
  };
  next();
};
```

**API Endpoints**:
| Method | Endpoint          | Access | Description                           |
| ------ | ----------------- | ------ | ------------------------------------- |
| GET    | `/api/audit-logs` | Admin  | List audit logs (paginated, filtered) |

**Query Parameters**: `entity`, `action`, `userId`, `from`, `to`, `page`, `limit`

---

### Module 13 — Media Manager

**Features**:
- Upload images (Multer) with **MIME type validation** (not just extension)
- Resize and optimize (Sharp): thumbnail (150px), medium (600px), large (1200px)
- Rename to `{uuid}.{ext}` — prevents path traversal attacks
- Reject SVG uploads (can contain embedded JavaScript)
- Store locally (`/uploads/`) or S3-compatible storage
- Return URLs for product images, logos, banners

| Method | Endpoint            | Access | Description                           |
| ------ | ------------------- | ------ | ------------------------------------- |
| POST   | `/api/media/upload` | Admin  | Upload image(s) — multipart/form-data |
| GET    | `/api/media`        | Admin  | List uploaded media                   |
| DELETE | `/api/media/:id`    | Admin  | Delete media                          |

---

### Module 14 — Notification / Email *(NEW)*

**Purpose**: Centralized email system for transactional emails. Uses Nodemailer with configurable SMTP transport (or SendGrid/SES).

**NotificationTemplate Model**:
| Column     | Type            | Description                                                           |
| ---------- | --------------- | --------------------------------------------------------------------- |
| `id`       | UUID            | Primary key                                                           |
| `name`     | STRING (unique) | Template identifier (e.g. `order_confirmation`)                       |
| `subject`  | STRING          | Email subject with variables (e.g. `Order {{orderNumber}} Confirmed`) |
| `bodyHtml` | TEXT            | HTML template with Handlebars variables                               |
| `bodyText` | TEXT            | Plain text fallback                                                   |
| `isActive` | BOOLEAN         | Toggle                                                                |

**NotificationLog Model**:
| Column           | Type      | Description                 |
| ---------------- | --------- | --------------------------- |
| `id`             | UUID      | Primary key                 |
| `templateName`   | STRING    | Which template was used     |
| `recipientEmail` | STRING    | Sent to                     |
| `subject`        | STRING    | Rendered subject            |
| `status`         | ENUM      | `sent`, `failed`, `bounced` |
| `userId`         | UUID (FK) | Optional recipient reference |
| `orderId`        | UUID (FK) | Optional order reference     |
| `error`          | TEXT      | Error message if failed     |
| `createdAt`      | TIMESTAMP | When sent                   |

**Required Email Templates**:
| Event              | Template             | Trigger                                 |
| ------------------ | -------------------- | --------------------------------------- |
| Registration       | `welcome`            | After successful registration           |
| Email verification | `verify_email`       | After registration (if feature enabled) |
| Password reset     | `password_reset`     | On forgot-password request              |
| Order confirmed    | `order_confirmation` | After successful payment                |
| Order shipped      | `order_shipped`      | Admin updates status to `shipped`       |
| Order delivered    | `order_delivered`    | Admin updates status to `delivered`     |
| Low stock alert    | `low_stock_admin`    | Cron job detects low inventory          |

**API Endpoints**:
| Method | Endpoint                           | Access | Description              |
| ------ | ---------------------------------- | ------ | ------------------------ |
| GET    | `/api/notification-templates`      | Admin  | List email templates     |
| PUT    | `/api/notification-templates/:id`  | Admin  | Update template          |
| GET    | `/api/notification-logs`           | Admin  | View sent email log      |

---

### Module 15 — SEO

**Features**:
- `react-helmet-async` for dynamic `<title>`, `<meta>` tags, Open Graph
- **Sitemap endpoint**: `GET /api/sitemap.xml` — auto-generated from published products & categories
- **JSON-LD structured data** injected per page type:
  - `Product` schema on product detail pages
  - `BreadcrumbList` on category/product pages
  - `Organization` schema site-wide
- `robots.txt` served statically

**API Endpoints**:
| Method | Endpoint           | Access | Description                    |
| ------ | ------------------ | ------ | ------------------------------ |
| GET    | `/api/sitemap.xml` | Public | Auto-generated sitemap         |
| GET    | `/api/robots.txt`  | Public | Robots file                    |

---

### Edge Case Implementations

These code patterns are referenced by the modules above. They belong in the actual source code.

**Slug Collision Handling** (used by Product, Category):
```javascript
// utils/slugify.js
async function generateUniqueSlug(name, Model) {
  let slug = slugify(name, { lower: true, strict: true });
  let counter = 0;
  while (await Model.findOne({ where: { slug } })) {
    counter++;
    slug = `${slugify(name, { lower: true, strict: true })}-${counter}`;
  }
  return slug;
}
```

**Inventory Locking** (used by Checkout — prevents overselling):
```javascript
// product.service.js — called during checkout
async function reserveInventory(productId, qty, transaction) {
  const [affectedRows] = await Product.update(
    {
      reservedQty: Sequelize.literal(`reserved_qty + ${qty}`)
    },
    {
      where: {
        id: productId,
        [Op.and]: Sequelize.literal(`(quantity - reserved_qty) >= ${qty}`)
      },
      transaction
    }
  );
  if (affectedRows === 0) throw new Error('INSUFFICIENT_STOCK');
}
```

---

## Configuration System

### Fallback Chain

```
┌─────────────────────┐
│  Admin changes a    │
│  setting via UI     │──→ Saved to DB Settings table
└─────────────────────┘

On every request to GET /api/settings:

1. Read from DB Settings table
2. For any missing key → fall back to config/default.json
3. For any still missing → fall back to .env
4. Return merged config to frontend
```

### `config/default.json` Example

```json
{
  "general": {
    "storeName": "My Store",
    "storeDescription": "Premium online shopping",
    "currency": "USD",
    "locale": "en-US"
  },
  "theme": {
    "primaryColor": "#6C63FF",
    "secondaryColor": "#FF6584",
    "backgroundColor": "#0F0F1A",
    "surfaceColor": "#1A1A2E",
    "textColor": "#FFFFFF",
    "fontFamily": "Inter",
    "borderRadius": "12px",
    "mode": "dark"
  },
  "features": {
    "wishlist": true,
    "reviews": true,
    "coupons": true,
    "multiCurrency": false,
    "socialLogin": false,
    "guestCheckout": true,
    "emailVerification": false,
    "requirePurchaseForReview": false
  },
  "shipping": {
    "method": "flat_rate",
    "flatRate": 5.00,
    "freeThreshold": 50.00
  },
  "tax": {
    "rate": 0.00,
    "inclusive": false
  },
  "seo": {
    "titleTemplate": "%s | My Store",
    "defaultDescription": "Shop the best products online",
    "ogImage": "/assets/og-image.jpg"
  },
  "logo": {
    "main": "/assets/logo.png",
    "favicon": "/assets/favicon.ico"
  }
}
```

---

## Feature Flags

Feature flags allow toggling modules per client without code changes.

**Usage in Frontend**:
```jsx
const { config } = useSettings();
return (
  <>
    <ProductDetail product={product} />
    {config.features.reviews && <ReviewSection productId={product.id} />}
    {config.features.wishlist && <WishlistButton productId={product.id} />}
  </>
);
```

**Usage in Backend** (middleware):
```javascript
const featureGate = (feature) => async (req, res, next) => {
  const enabled = await SettingsService.get(`features.${feature}`);
  if (!enabled) return res.status(404).json({ success: false, error: { code: 'FEATURE_DISABLED', message: `${feature} is not enabled` } });
  next();
};

router.post('/wishlist', featureGate('wishlist'), wishlistController.add);
router.post('/coupons/validate', featureGate('coupons'), couponController.validate);
```

---

## Background Jobs / Cron

Scheduled jobs using `node-cron`, registered on server startup:

| Job                             | Schedule          | Purpose                                                       |
| ------------------------------- | ----------------- | ------------------------------------------------------------- |
| **Reservation Timeout**         | Every 5 minutes   | Release `reservedQty` for carts/orders unpaid for > 15 min    |
| **Abandoned Cart Cleanup**      | Daily at 2 AM     | Mark carts as `expired` if untouched for 30 days              |
| **Expired Coupon Deactivation** | Daily at midnight | Set `isActive = false` for coupons past `endDate`             |
| **Low Stock Alert**             | Daily at 9 AM     | Email admins about products with `quantity - reservedQty < 5` |

```javascript
// jobs/reservationTimeout.job.js
cron.schedule('*/5 * * * *', async () => {
  const expiredOrders = await Order.findAll({
    where: {
      status: 'pending_payment',
      createdAt: { [Op.lt]: new Date(Date.now() - 15 * 60 * 1000) }
    }
  });
  for (const order of expiredOrders) {
    await sequelize.transaction(async (t) => {
      for (const item of order.items) {
        await Product.update(
          { reservedQty: Sequelize.literal(`reserved_qty - ${item.quantity}`) },
          { where: { id: item.productId }, transaction: t }
        );
      }
      await order.update({ status: 'cancelled' }, { transaction: t });
    });
  }
});
```

---

## API Conventions

### Response Format
```json
// Success
{ "success": true, "data": {}, "message": "...", "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 } }

// Error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

### HTTP Status Codes
| Code | Usage                                                  |
| ---- | ------------------------------------------------------ |
| 200  | Success                                                |
| 201  | Created                                                |
| 400  | Bad request / validation                               |
| 401  | Unauthorized                                           |
| 403  | Forbidden (insufficient role)                          |
| 404  | Not found                                              |
| 409  | Conflict (price changed, duplicate, stock unavailable) |
| 429  | Rate limited                                           |
| 500  | Server error                                           |

### Naming Conventions
| Item         | Convention               | Example                              |
| ------------ | ------------------------ | ------------------------------------ |
| API routes   | kebab-case, plural nouns | `/api/products`, `/api/order-items`  |
| DB tables    | snake_case, plural       | `products`, `order_items`            |
| Model fields | camelCase                | `firstName`, `createdAt`             |
| File names   | dot-separated            | `product.model.js`, `auth.routes.js` |

---

## Client Onboarding (Setup CLI)

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
  --smtp-user "client@example.com"
```

**What the script does**:
1. Copies the template repo
2. Replaces logo/favicon in `client/public/assets/`
3. Writes `config/default.json` with provided theme values
4. Generates `.env` with database + SMTP credentials
5. Creates the PostgreSQL database
6. Runs `npx sequelize-cli db:migrate`
7. Runs `npx sequelize-cli db:seed:all` (demo data + default email templates)
8. Prints success message with dev server URL

---

## Build Order

| Phase       | Modules                                 | Deliverable                                      |
| ----------- | --------------------------------------- | ------------------------------------------------ |
| **Phase 1** | Settings & Config, Auth, Notification   | Config system + auth + email foundation          |
| **Phase 2** | Product, Category, Media                | Full catalog with images                         |
| **Phase 3** | Cart, Checkout, Order, Payment, Coupon  | Complete shopping flow with payments & discounts |
| **Phase 4** | Customer Account, Wishlist, Reviews     | User features                                    |
| **Phase 5** | Admin Dashboard, Audit Log              | Management UI                                    |
| **Phase 6** | SEO, Background Jobs, Setup CLI, Docker | Polish & deployment                              |

---

*This document serves as the single source of truth for the platform architecture. Update it as modules are built and decisions evolve.*
