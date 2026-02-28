---
description: How to build Phase 1 — Settings, Auth, and Notification modules
---

# Phase 1 — Settings & Config + Auth + Notification

// turbo-all

## Step 1: Initialize the project structure

```bash
cd /home/sr-user91/Videos/e-commerce
mkdir -p server/src/{modules,middleware,config,utils,jobs}
mkdir -p server/{migrations,seeders}
mkdir -p client/src/{components/{common,layout,product,cart},pages/{storefront,admin},layouts,context,services,hooks,routes,theme,utils}
mkdir -p client/public/assets
mkdir -p config scripts docs
```

## Step 2: Initialize backend package.json

```bash
cd /home/sr-user91/Videos/e-commerce/server
npm init -y
```

## Step 3: Install backend dependencies

```bash
cd /home/sr-user91/Videos/e-commerce/server
npm install express sequelize pg pg-hstore bcryptjs jsonwebtoken joi cors helmet express-rate-limit sanitize-html multer sharp nodemailer node-cron dotenv morgan uuid
npm install --save-dev sequelize-cli nodemon
```

## Step 4: Initialize Sequelize

```bash
cd /home/sr-user91/Videos/e-commerce/server
npx sequelize-cli init
```

## Step 5: Create the server config files

Create these files:
- `server/src/config/database.js` — Sequelize connection using env vars
- `server/src/config/app.js` — Config loader (DB → JSON → ENV fallback)
- `server/src/config/constants.js` — Enums and status codes
- `server/.sequelizerc` — Point Sequelize CLI to correct paths

## Step 6: Create utility files

Create these files:
- `server/src/utils/response.js` — success() and error() helpers
- `server/src/utils/pagination.js` — Paginate helper for Sequelize
- `server/src/utils/slugify.js` — generateUniqueSlug() with collision handling
- `server/src/utils/logger.js` — Winston or Pino logger

## Step 7: Create middleware files

Create these files:
- `server/src/middleware/auth.middleware.js` — JWT verification
- `server/src/middleware/role.middleware.js` — Role checking (authorize)
- `server/src/middleware/validate.middleware.js` — Joi validation wrapper
- `server/src/middleware/rateLimiter.middleware.js` — Rate limit configs
- `server/src/middleware/sanitize.middleware.js` — HTML sanitization
- `server/src/middleware/upload.middleware.js` — Multer config + MIME check
- `server/src/middleware/errorHandler.middleware.js` — Central error handler

## Step 8: Build Settings module

Follow the `new-module` workflow for the settings module:
- Model: `settings` table (id, key, value JSONB, group, updatedBy)
- Service: DB → JSON fallback logic
- Endpoints: GET /api/settings, GET /api/settings/:group, PUT /api/settings, PUT /api/settings/:key
- Seed: Default settings from config/default.json

## Step 9: Build Auth module

Follow the `new-module` workflow for the auth module:
- Models: `users` table, `refresh_tokens` table
- Service: register, login, refresh, logout, forgotPassword, resetPassword
- Password hashing: bcrypt with cost factor 12
- JWT: access token (15min), refresh token (7days)
- Rate limiting: 5/15min on login, 3/hour on register and forgot-password
- Validation: password policy (8+ chars, mixed case, number)

## Step 10: Build User module

Follow the `new-module` workflow for the user module:
- Models: `user_profiles` table
- Service: getMe, updateMe, changePassword, listAll (admin), getById (admin)
- Endpoints per docs/API.md

## Step 11: Build Notification module

Follow the `new-module` workflow for the notification module:
- Models: `notification_templates`, `notification_logs` tables
- Service: Nodemailer setup, template rendering with Handlebars
- Seed: Default email templates (welcome, verify_email, password_reset, order_confirmation, order_shipped, order_delivered, low_stock_admin)

## Step 12: Create the Express app

Create `server/src/app.js`:
- Apply helmet, cors, rate-limit, body-parser, sanitize middleware
- Register module routes
- Apply error handler last

Create `server/index.js`:
- Import app, connect DB, sync models, start server

## Step 13: Create .env.example and config/default.json

Create `.env.example` with all required env vars from docs/DEPLOYMENT.md
Create `config/default.json` with default theme/features/SEO/shipping/tax config

## Step 14: Initialize frontend

```bash
cd /home/sr-user91/Videos/e-commerce
npm create vite@latest client -- --template react
cd client
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled axios react-router-dom react-helmet-async
```

## Step 15: Create frontend foundation

Create these files:
- `client/src/theme/muiTheme.js` — createTheme() from settings API
- `client/src/services/api.js` — Axios instance with interceptors
- `client/src/services/authService.js` — login, register, refresh, logout
- `client/src/services/settingsService.js` — getSettings
- `client/src/context/AuthContext.jsx` — Auth state management
- `client/src/context/ThemeContext.jsx` — MUI theme from config
- `client/src/hooks/useAuth.js` — Hook for auth context
- `client/src/hooks/useSettings.js` — Hook for settings context
- `client/src/routes/ProtectedRoute.jsx` — Role-based route guard
- `client/src/routes/AppRoutes.jsx` — Route definitions
- `client/src/layouts/StoreLayout.jsx` — Header + Footer wrapper
- `client/src/layouts/AdminLayout.jsx` — Sidebar + TopBar wrapper
- `client/src/pages/storefront/LoginPage.jsx`
- `client/src/pages/storefront/RegisterPage.jsx`

## Step 16: Test Phase 1

```bash
cd /home/sr-user91/Videos/e-commerce/server && npm run dev
```

Test:
1. GET /api/settings — returns default config
2. POST /api/auth/register — creates user
3. POST /api/auth/login — returns tokens
4. POST /api/auth/refresh — refreshes token
5. POST /api/auth/logout — invalidates token
6. Rate limiting works on login
7. Frontend login/register pages work
