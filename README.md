# E-Commerce Platform — Pro v2.0

> A production-grade, highly customizable, and white-label ready e-commerce engine. Built for performance, security, and developer happiness.

---

## 🏛️ Project Philosophy

This platform is engineered as a **reusable foundation** for high-scale e-commerce. It follows a "one codebase, many instances" model, allowing you to deploy fully independent stores with shared architecture but unique identities.

- **Zero Multi-tenancy**: Each client gets their own database and codebase for maximum isolation and security.
- **Config-First**: Visuals, features, SEO, and shipping are all driven by a centralized configuration engine.
- **Audit-Ready**: Every administrative action is logged with detailed change diffs.
- **Safety by Design**: Atomic inventory updates, snapshot-based orders, and AES-encrypted credentials.

---

## 🚀 A to Z Module Features

### 🔐 Authentication & Access Control (RBAC)
- **Advanced Permissions**: Granular permission gates (e.g., `products.read`, `orders.manage`) for every feature.
- **Dynamic Roles**: Super-admins can create custom roles with specific inherited permissions.
- **Security-Hardened**: JWT with refresh token rotation, bcrypt hashing (cost 12), and per-route rate limiting.
- **Session Protection**: Brute-force protection and automated refresh token revocation on logout.

### 📦 Product Catalog & Inventory
- **Multi-Variant Support**: Manage sizes, colors, and attributes with unique SKUs and price modifiers.
- **SEO Ready**: Per-product meta titles, descriptions, and Open Graph tags.
- **Volumetric Aware**: Physical dimensions (L x B x H) for precise shipping calculations.
- **Atomic Inventory**: Prevents overselling using atomic database increments and reservation timeouts.

### 🛒 Shopping Cart & Checkout
- **Guest-to-User Merge**: Seamlessly merge local carts into user accounts upon login.
- **Price Integrity**: Server-side price re-validation at the moment of checkout (prevents stale price exploits).
- **Coupon Engine**: Support for flat, percentage, and free-shipping discounts with usage limits and expiry.
- **Address Book**: Manage multiple shipping/billing addresses with default tagging.

### 📈 Admin Dashboard (Widget-Based)
- **Configurable Layouts**: Choose from Balanced, Analytics, or Compact density views.
- **Widget Registry**: Drag-and-drop KPI cards, Sales Charts, Recent Orders, and Low Stock Alerts.
- **Role-Based Views**: Dashboard widgets automatically hide/show based on the admin's permissions.
- **Store Health**: Real-time checklist for inventory warnings, failed payments, and system alerts.

### 💳 Payment Infrastructure
- **Gateway Manager**: Toggle and configure Stripe, Razorpay, Cashfree, PayU, and COD.
- **Encrypted Credentials**: API keys are stored with AES-256-GCM encryption at rest.
- **Webhook Idempotency**: Dedicated event logging prevents double-processing of payment signals.
- **Refund Management**: Initiate and track refunds directly from the admin interface.

### 🚚 Shipping & Fulfillment Engine
- **Zonal Rules**: Define shipping costs based on Pincode prefixes (Local, Regional, National, Remote).
- **Volumetric Calculation**: Chargeable weight calculated using industry-standard divisors (e.g., 5000).
- **Carrier Adapters**: Integrated with Shiprocket and Ekart for real-time label generation and tracking.
- **Quote Locking**: Shipping costs are locked for 10 minutes during checkout to ensure price stability.

### 🔍 SEO & Meta Management
- **Hierarchical Resolution**: URL Overrides > Entity SEO > Global Defaults.
- **Social Previews**: Rich OG tags for social media, including dynamic price and availability.
- **Canonical Safety**: Automatic canonical URL generation with manual override capability.
- **Admin Previews**: Real-time Google search snippet preview in the CMS.

### 🛠️ Audit & Logging
- **Action Diffing**: Logs old vs. new values for every mutation (Products, Orders, Settings).
- **Security Logs**: Tracks login attempts, permission changes, and sensitive data access.
- **Admin UI**: Filterable audit trail for accountability and debugging.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18 (Vite), MUI 5, React Helmet Async, Axios |
| **Backend** | Node.js (Express), Sequelize ORM, JWT, Joi |
| **Database** | PostgreSQL 15+ (JSONB for Diffs & Config) |
| **Payments** | Stripe, Razorpay, Cashfree, PayU, COD |
| **Shipping** | Shiprocket, Ekart, Custom Zonal Engine |
| **Storage** | Local Filesystem / S3 (via Media Module) |
| **Infra** | Docker, Docker Compose, node-cron |

---

## 🏗️ Project Structure

```text
e-commerce/
├── client/              # React frontend (Vite + MUI)
│   ├── src/components/  # Atomic UI + Dashboard Widgets
│   ├── src/pages/       # Storefront & Admin Modules
│   └── src/context/     # Global State (Auth, Cart, Settings)
├── server/              # Express backend
│   ├── src/modules/     # Domain-driven modules (Auth, Order, etc.)
│   ├── src/middleware/  # Security, Auth, RBAC, Sanitization
│   └── src/jobs/        # Background Cron tasks
├── config/              # Default fallback configurations
├── docs/                # Deep-dive architecture & module docs
└── docker-compose.yml   # Production-ready orchestration
```

---

## 🚦 Quick Start

### 1. Setup Environment
```bash
cp .env.example .env
# Fill in your Database, JWT_SECRET, and Provider API Keys
```

### 2. Install & Initialize
```bash
# In /server
npm install
npx sequelize-cli db:create
npm run migrate
npm run seed

# In /client
npm install
```

### 3. Run Development
```bash
# Terminal 1 (Backend)
cd server && npm run dev

# Terminal 2 (Frontend)
cd client && npm run dev
```

### 4. Deploy to AWS (EC2)
For automated deployment on an AWS Ubuntu instance:
```bash
./scripts/aws-deploy.sh
```
This script installs Docker, generates secure secrets, builds containers, and initializes the database.

---

## 📖 Extended Documentation

For deep dives into specific subsystems, refer to the `docs/` directory:

- [Architecture Overview](docs/ARCHITECTURE.md)
- [Database Schema & Constraints](docs/DATABASE.md)
- [API Contract Reference](docs/API.md)
- [SEO Implementation Guide](docs/SEO_IMPLEMENTATION.md)
- [Shipping Engine & Volumetric Logic](docs/SHIPPING-SYSTEM-GUIDE.md)
- [Audit & Compliance Report](docs/AUDIT-REPORT.md)

---

## 🛡️ Default Access (Post-Seed)

| Role | Email | Password |
| :--- | :--- | :--- |
| **Super Admin** | `admin@example.com` | `Password123!` |
| **Customer** | `customer@example.com` | `Password123!` |

---

## 📄 License

ISC © 2026 E-Commerce Pro Team
