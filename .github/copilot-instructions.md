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

Default credentials after seeding: `admin@store.com` / `Admin123!` (super_admin), `customer@store.com` / `Customer123!`.

Stripe webhooks require raw body — the app skips `express.json()` for any route containing `/webhook` (see [server/src/app.js](../server/src/app.js)).

## Server Architecture

### Module Layout
Each domain lives in `server/src/modules/<name>/` with a consistent structure:
```
product/
  product.routes.js      # Express router: wires middleware + controller
  product.controller.js  # Thin: calls service, sends response via util
  product.service.js     # All business logic + DB access
  product.validation.js  # Joi schemas
  product.model.js       # Sequelize model (factory function)
```

### Model Auto-Discovery
`server/src/modules/index.js` recursively scans for `*.model.js` files and auto-loads them. **Every model file must export a factory function `(sequelize, DataTypes) => Model`.** Associations are defined via `Model.associate(db)` and called automatically after all models load — see [server/src/modules/ASSOCIATIONS.md](../server/src/modules/ASSOCIATIONS.md).

### Response Pattern — always use these utilities
```js
const { success, error, paginated } = require('../../utils/response');
success(res, data, message, statusCode);          // { success, data, message }
error(res, message, statusCode, code, details);   // { success: false, error: { code, message } }
paginated(res, rows, count, page, limit);         // adds meta.total/page/totalPages/limit
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
  authenticate,          // JWT → sets req.user (throws 401 if missing/expired)
  authorize('admin'),    // role check — use authorize('admin', 'super_admin') for both
  featureGate('key'),    // DB feature flag, 60s TTL cache, fails closed on DB error
  validate(schema),      // Joi body validation
  auditLog('Entity'),    // wraps res.json — fires AFTER success response (2xx only)
  controller.action
);
```
Use `optionalAuth` instead of `authenticate` on public routes that behave differently when logged in (e.g. product listing shows draft products to admins).

### Audit Logging
Two patterns — prefer the **middleware** form on admin mutation routes:
```js
// 1. Middleware (preferred for standard CRUD — auto-detects action from HTTP verb)
auditLog('Product')    // in route chain, AFTER authorize
// Override action or attach diff via request properties in the controller:
req._auditAction = 'STATUS_CHANGE';
req._auditChanges = { status: { old: 'pending', new: 'shipped' } };

// 2. Direct service call (for background jobs / non-route contexts)
AuditService.log({ userId, action: ACTIONS.CREATE, entity: ENTITIES.PRODUCT, entityId, changes });
// Always fire-and-forget — never pass the caller's transaction
```

### Database Conventions
- All PKs are **UUID v4** (`DataTypes.UUIDV4`)
- Models with `paranoid: true` (e.g. `User`, `Product`) use soft-deletes — `WHERE deleted_at IS NULL` is automatic
- `User` model has a `defaultScope` that excludes `password`; use `User.scope('withPassword')` when you need it
- Multi-step operations must use `sequelize.transaction()` with `t.LOCK.UPDATE` for inventory/stock changes
- Settings are DB-backed with fallback to `config/default.json` grouped by: `theme`, `features`, `seo`, `general`, `shipping`, `tax`, `sku`, `logo`, `hero`, `footer`, `announcement`, `nav`, `catalog`, `homepage`, `productPage`
- All 15 groups have dedicated admin UI tabs in `client/src/pages/admin/SettingsPage.jsx` — add new settings there when extending

### Feature Flags
Feature gates query the `settings` table (`group = 'features'`) and cache results for 60 seconds. Fail **closed** — when the DB is unreachable the feature is denied. Use `featureGate('wishlistEnabled')` middleware on routes.

### Cart: Guest & Auth
`cart.service.js` identifies a cart by `userId` (authenticated) or `sessionId` (guest cookie). The service auto-creates a cart on first access. On login, the guest cart is merged into the user cart by the auth flow.

### Media Uploads
`media.service.js` uses **sharp** to generate three sizes on upload: `thumbnails/` (150px), `medium/` (600px), `large/` (1200px). The upload directory is resolved via `UPLOAD_DIR` env var (defaults to `uploads/`). Both `app.js` static serving and the service use `path.resolve(UPLOAD_DIR)` — keep them in sync. Missing files fall back to `/uploads/no-image.png`.

### Notifications (Email)
Templates stored in DB (`NotificationTemplate`), compiled with **Handlebars**, sent via SMTP. Call `NotificationService.send(templateName, email, variables)` — failures are swallowed and never break the calling flow. Not exposed as API routes in Phase 1.

## Client Architecture

### API Layer
A single Axios instance in `client/src/services/api.js` handles:
- Attaching `Bearer` token from `localStorage.accessToken`
- Auto-refreshing expired tokens via `localStorage.refreshToken` (queued retry on 401)
- Dispatching `auth:unauthorized` browser event when refresh fails → `AuthContext` listens and clears session

Feature-specific services (`authService.js`, `productService.js`, etc.) all wrap `api.js`.

### State Management
- **`AuthContext`** (`AuthContext.jsx`) — user session, login/logout, hydrates from `localStorage.userProfile` on mount before API round-trip
- **`CartContext`** — cart state; call `fetchCart()` after login to merge guest cart
- **`SettingsContext`** — exported from `ThemeContext.jsx` (not its own file); provides DB settings merged over `config/default.json` defaults; also builds the MUI theme from `settings.theme.*`
- **`WishlistContext`**, **`CategoryContext`** — domain-specific global state

### Settings & Feature Hooks (`client/src/hooks/useSettings.js`)
```js
const { settings } = useSettings();          // full grouped settings object
const enabled = useFeature('wishlist');       // true if not explicitly disabled; optimistic on load
const { formatPrice } = useCurrency();       // Intl.NumberFormat with settings.general.currency
```

### Routing
All pages are lazy-loaded via `React.lazy`. Two layouts: `StoreLayout` (storefront) and `AdminLayout` (admin). Protected routes use `<ProtectedRoute>` for auth and `<ProtectedRoute requiredRole="admin">` for admin-only. See `client/src/routes/AppRoutes.jsx`.

### Roles
Three roles: `customer`, `admin`, `super_admin`. Use `authorize('admin', 'super_admin')` to allow both admin roles. Constants in `server/src/config/constants.js`.

## Key Files
| File | Purpose |
|------|---------|
| [server/src/modules/index.js](../server/src/modules/index.js) | Model registry — all models imported from here |
| [server/src/utils/response.js](../server/src/utils/response.js) | Mandatory response helpers |
| [server/src/utils/AppError.js](../server/src/utils/AppError.js) | Error class |
| [server/src/config/constants.js](../server/src/config/constants.js) | ACTIONS, ENTITIES, ROLES, ORDER_STATUS enums |
| [server/src/modules/ASSOCIATIONS.md](../server/src/modules/ASSOCIATIONS.md) | Model association wiring guide |
| [config/default.json](../config/default.json) | Settings fallback defaults (all groups) |
| [client/src/services/api.js](../client/src/services/api.js) | Axios instance with token refresh |
| [client/src/context/ThemeContext.jsx](../client/src/context/ThemeContext.jsx) | `SettingsContext` + MUI theme builder |
| [client/src/hooks/useSettings.js](../client/src/hooks/useSettings.js) | `useSettings`, `useFeature`, `useCurrency` |
