# Copilot Instructions

## Project Overview
Full-stack e-commerce platform: **React 18 + Vite + MUI 5** (client) backed by **Node.js + Express + Sequelize + PostgreSQL** (server). One codebase, one instance per client deployment.

## Developer Workflows

```bash
# Backend (port 5000)
cd server && npm run dev

# Frontend (port 3000/5173)
cd client && npm run dev

# Database
cd server
npm run migrate              # Run pending migrations
npm run seed                 # Seed all seeders
npm run db:reset             # Drop → create → migrate → seed (destructive)
npm run migrate:undo         # Rollback last migration
```

Stripe webhooks require raw body — the app skips `express.json()` for any route containing `/webhook` (see [server/src/app.js](../server/src/app.js)).

## Server Architecture

### Module Layout
Each domain lives in `server/src/modules/<name>/` with a consistent structure:
```
auth/
  auth.routes.js       # Express router: wires middleware + controller
  auth.controller.js   # Thin: calls service, calls response util
  auth.service.js      # All business logic + DB access
  auth.validation.js   # Joi schemas
  user.model.js        # Sequelize model (exported as factory function)
```

### Model Auto-Discovery
`server/src/modules/index.js` recursively scans for `*.model.js` files and auto-loads them. **Every model file must export a factory function `(sequelize, DataTypes) => Model`.** Associations are defined via `Model.associate(db)` and called automatically.

### Response Pattern — always use these utilities
```js
const { success, error, paginated } = require('../../utils/response');
// success(res, data, message, statusCode)
// error(res, message, statusCode, code, details)
// paginated(res, rows, count, page, limit)
```

### Error Handling
Throw `AppError` from services; the global handler in `errorHandler.middleware.js` catches everything:
```js
const AppError = require('../../utils/AppError');
throw new AppError('NOT_FOUND', 404, 'Product not found');
// AppError(code, statusCode, message, details?)
```
Sequelize validation/unique errors are automatically normalized to `400`/`409`.

### Route Middleware Order
```js
router.post('/route',
  authenticate,          // JWT → sets req.user
  authorize('admin'),    // role check (super_admin | admin | customer)
  featureGate('key'),    // DB feature flag (60s TTL cache)
  validate(schema),      // Joi body validation
  controller.action
);
```

### Audit Logging
Always fire-and-forget — **never** pass the caller's transaction so a rollback doesn't erase the trail:
```js
AuditService.log({ userId, action: ACTIONS.CREATE, entity: ENTITIES.PRODUCT, entityId, changes });
// No await needed; failures are caught internally and never rethrow
```

### Database Conventions
- All PKs are **UUID v4** (`DataTypes.UUIDV4`)
- Models with `paranoid: true` (e.g. `User`, `Product`) use soft-deletes — filter `WHERE deleted_at IS NULL` is automatic
- `User` model has a `defaultScope` that excludes `password`; use `User.scope('withPassword')` when you need it
- Multi-step operations must use `sequelize.transaction()` with `t.LOCK.UPDATE` for inventory/stock changes
- Settings are DB-backed with fallback to `config/default.json` grouped by: `theme`, `features`, `seo`, `general`, `shipping`, `tax`

### Feature Flags
Feature gates query the `settings` table (`group = 'features'`) and cache results for 60 seconds. Use `featureGate('wishlistEnabled')` middleware on routes.

### Media Uploads
`media.service.js` uses **sharp** to generate three sizes on upload: `thumbnails/` (150px), `medium/` (600px), `large/` (1200px). The upload directory is resolved via `UPLOAD_DIR` env var (defaults to `uploads/`). Missing files fall back to `/uploads/no-image.png`.

### Notifications (Email)
Templates are stored in the DB (`NotificationTemplate`), compiled with **Handlebars**, and sent via SMTP. Call `NotificationService.send(templateName, email, variables)` — failures are swallowed and never break the calling flow.

## Client Architecture

### API Layer
A single Axios instance in `client/src/services/api.js` handles:
- Attaching `Bearer` token from `localStorage.accessToken`
- Auto-refreshing expired tokens via `localStorage.refreshToken` (queued retry on 401)
- Dispatching `auth:unauthorized` browser event when refresh fails

Feature-specific services (`authService.js`, `productService.js`, etc.) wrap `api.js`.

### State Management
- **AuthContext** — user session, login/logout, hydrates from `localStorage.userProfile` on mount
- **CartContext** — cart state, guest cart merges on login
- **WishlistContext**, **CategoryContext**, **ThemeContext** — domain-specific global state

### Roles
Three roles: `customer`, `admin`, `super_admin`. Use `authorize('admin', 'super_admin')` to allow both admin roles. Constants in `server/src/config/constants.js`.

## Key Files
| File | Purpose |
|------|---------|
| [server/src/modules/index.js](../server/src/modules/index.js) | Model registry — all models imported from here |
| [server/src/utils/response.js](../server/src/utils/response.js) | Mandatory response helpers |
| [server/src/utils/AppError.js](../server/src/utils/AppError.js) | Error class |
| [server/src/config/constants.js](../server/src/config/constants.js) | ACTIONS, ENTITIES, ROLES, ORDER_STATUS enums |
| [config/default.json](../config/default.json) | Settings fallback defaults |
| [client/src/services/api.js](../client/src/services/api.js) | Axios instance with token refresh |
