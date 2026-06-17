# E-Commerce Platform — Complete A-to-Z Audit Plan

> **Scope**: Full-stack audit of all 24 server modules, 19 client services, 43+ pages, deployment, security, and architecture.
> **Status**: Existing coverage for ~40% of the system. This plan covers remaining 60%.

---

## PRE-AUDIT: What's Already Covered

| Area | Existing Report | Status |
|------|----------------|--------|
| Categories, Variants, Cart/Order, Auth, Admin UX, FE-BE Alignment, Performance | `docs/AUDIT-REPORT.md` (763 lines) | All 15 items resolved |
| Coupons | `docs/COUPON-AUDIT-REPORT.md` (63 lines) | Minor recs only |
| Reviews | `docs/REVIEW-AUDIT-REPORT.md` (114 lines) | 16/20 resolved |
| Review UI/UX | `docs/REVIEW-UI-AUDIT.md` (68 lines) | 24/26 resolved |
| Edge Cases | `docs/EDGE-CASES.md` (37 lines) | 25/28 resolved |
| Fix Plan | `docs/FIX-PLAN.md` (1216 lines) | All 19 fixes resolved |
| Code Review | `docs/CODE_REVIEW_REPORT.md` (534 lines) | 76+ issues, many unresolved |

---

## AUDIT PHASE 1: PAYMENT MODULE (HIGH PRIORITY)

**Files**: `server/src/modules/payment/{model,service,controller,routes,validation}.js`
**Client**: `client/src/services/paymentService.js`, checkout pages

### 1.1 Refund Flow Audit
- [ ] Verify model has `refunded` status but no implementation exists
- [ ] Check if order cancellation triggers any payment reversal
- [ ] Audit Razorpay refund API integration feasibility
- [ ] Audit Stripe refund API integration feasibility
- [ ] Audit Cashfree refund API integration feasibility
- [ ] Define refund flow: admin-initiated vs auto-on-cancel
- [ ] Check if `refundedAmount` tracking exists on Payment model

### 1.2 PayU Webhook & Idempotency
- [ ] PayU return handler has NO idempotency check — critical gap
- [ ] Audit PayU return URL handling for replay attacks
- [ ] Verify PayU hash verification is implemented
- [ ] Plan WebhookEvent integration for PayU

### 1.3 Stripe Webhook Transaction Safety
- [ ] `stripeWebhook` handler runs outside explicit transaction
- [ ] Compare with Razorpay handler that uses `sequelize.transaction` + `LOCK.UPDATE`
- [ ] Risk: webhook could create Payment row but order update could fail

### 1.4 Gateway Return Shape Inconsistency
- [ ] Razorpay: `{ provider, id, amount, currency }`
- [ ] Cashfree: `{ provider, orderId, paymentSessionId, amount, currency, mode }`
- [ ] Stripe: `{ provider, url, sessionId }`
- [ ] PayU: `{ provider, action, fields }`
- [ ] Frontend must handle 4 different shapes — fragile
- [ ] Recommend standardizing to `{ provider, redirectUrl?, modalData?, orderData? }`

### 1.5 Cashfree Race Condition
- [ ] Order lookup + payment lookup happen outside `markOrderPaid` transaction
- [ ] Risk: simultaneous webhook + client-side verify could double-process

### 1.6 COD Configuration
- [ ] COD always returns `connected: true`
- [ ] No admin toggle to disable COD globally (only per-shipping-rule `codAllowed`)
- [ ] Check COD risk: orders without payment confirmation

---

## AUDIT PHASE 2: SHIPPING MODULE (MEDIUM PRIORITY)

**Files**: `server/src/modules/shipping/{model,service,controller,routes,validation}.js` + provider files
**Client**: `client/src/services/shippingService.js`, checkout shipping step

### 2.1 Ekart Integration
- [ ] `EkartProvider.js` is a **stub** — generates fake AWB codes
- [ ] No real API calls for serviceability, rate, tracking
- [ ] Credentials fetched but never used
- [ ] Either implement or disable from admin UI

### 2.2 Missing Delhivery Provider
- [ ] Comment placeholder exists: `// delhivery: DelhiveryProvider, // add when ready`
- [ ] No implementation files exist

### 2.3 Customer Tracking Endpoint
- [ ] No customer-facing tracking endpoint in routes
- [ ] Tracking only available via admin dashboard
- [ ] Plan: `GET /api/orders/:orderId/tracking` with webhook events

### 2.4 Rate Engine Gap
- [ ] `strictOverride` on shipping rules queried but never evaluated
- [ ] Rules use `.find()` (first match wins) but `strictOverride` should break the loop
- [ ] Default dimensions for unmeasured products hardcoded at 10x10x10cm, 500g

### 2.5 Pincode Comparison Bug
- [ ] `pincodeMatches` uses lexicographic string comparison for ranges
- [ ] Mixed numeric/string pincodes could produce incorrect zone matches

### 2.6 Zone Deletion Safety
- [ ] Zone deletion checks for rules but not active quotes or shipments

---

## AUDIT PHASE 3: NOTIFICATION MODULE (MEDIUM PRIORITY)

**Files**: `server/src/modules/notification/{model,service,controller,routes,validation}.js` + `defaults.js` + `channels/`
**Client**: `client/src/services/notificationService.js`

### 3.1 Critical Bug: `status='skipped'` Violates Model Validation
- [ ] Model validates status: `isIn: [['sent', 'failed', 'bounced']]`
- [ ] Service code sets `status = 'skipped'` for disabled channels (line ~155)
- [ ] Calling `NotificationLog.create({ status: 'skipped' })` will throw Sequelize validation error
- [ ] Fix: either add `'skipped'` to model enum or don't create log entries for skipped channels

### 3.2 Missing Template Seeder
- [ ] `DEFAULTS` has 16+ templates but no migration/seeder creates them on first run
- [ ] If DB is empty, `send()` silently returns `false` — no email delivery without admin seeding
- [ ] Plan: migration that upserts default templates on startup

### 3.3 SMTP Transport Pooling
- [ ] `createTransporter()` called on every `send()` — creates new connection each time
- [ ] Should use `transporter.sendMail()` with pooled connections

### 3.4 WhatsApp WABA Integration
- [ ] Comments mention WABA template messages but only free-form text is used
- [ ] WABA requires pre-approved message templates — free-form may fail on production WhatsApp numbers

### 3.5 Error Alerting
- [ ] `sendDeliveryUpdate` silently catches errors and returns `false`
- [ ] No alerting mechanism for systemic notification failures

---

## AUDIT PHASE 4: ACCESS/RBAC MODULE (MEDIUM PRIORITY)

**Files**: `server/src/modules/access/*.model.js`, `shared/authorization.json`
**Client**: Admin role/permission pages

### 4.1 Missing Bootstrap/Seeder
- [ ] No migration or seeder creates initial roles + permissions in DB
- [ ] `shared/authorization.json` defines schema but is never loaded programmatically
- [ ] App depends on migrations that may not exist
- [ ] Verify: `20260222000006-create-roles-permissions.js` exists and works

### 4.2 Permission Enforcement Gaps
- [ ] Some order operations (refund) check `isAdmin` instead of using role middleware
- [ ] `admin.service.js` has direct DB queries without middleware-level permission checks
- [ ] `access` module has no service/controller/routes — management is in `admin` module

### 4.3 Role Hierarchy Validation
- [ ] `createRoleSchema.baseRole` only allows `customer` or `admin` — correct
- [ ] `updateRoleSchema.baseRole` should also NOT allow `super_admin` — verify

### 4.4 Frontend Permission Checks
- [ ] Client-side permission checks match server-side exactly
- [ ] `canAccess()` utility handles all permission formats
- [ ] ProtectedRoute uses correct permission map

---

## AUDIT PHASE 5: SETTINGS MODULE (LOW-MEDIUM PRIORITY)

**Files**: `server/src/modules/settings/{model,service,controller,routes,validation}.js`, `config/default.json`
**Client**: `client/src/context/ThemeContext.jsx`, settings pages

### 5.1 No Type Validation on Values
- [ ] `updateSingleSettingSchema`: `{ value: Joi.any().required() }`
- [ ] `bulkUpdateSchema`: also `Joi.any()`
- [ ] Number fields can receive strings, URLs can receive garbage
- [ ] Plan: per-key type schemas for all setting keys

### 5.2 No Settings Cache
- [ ] `getAll()` and `getByGroup()` query DB on every request
- [ ] Storefront pages hit DB for theme settings on every render
- [ ] Plan: in-memory TTL cache + invalidation on update

### 5.3 Stripe Client Instantiation
- [ ] `new Stripe(secret)` called per request (expensive)
- [ ] Should cache Stripe instance with credential-change invalidation

### 5.4 Orphaned Settings Risk
- [ ] `bulkUpdate` resolves group from `defaultSettings[g][key]`
- [ ] Key not in defaults -> defaults to `'general'` group — orphaned settings possible

### 5.5 Credential Decryption Failures
- [ ] `getCredential` catches decrypt failures but returns `null` silently
- [ ] Could mask misconfiguration (wrong encryption key, corrupted data)

---

## AUDIT PHASE 6: PRODUCT MODULE (DEEP AUDIT)

**Files**: `server/src/modules/product/{model,service,controller,routes,validation}.js`
**Client**: Product pages, admin product management

### 6.1 Inventory Race Conditions
- [ ] Cart stock validation uses `findByPk` + update (not atomic in all paths)
- [ ] `reservedQty` tracking — verify all reservation/release paths
- [ ] `reservationTimeout.job.js` — verify it properly releases all reservations

### 6.2 Variant System
- [ ] Variant pricing (override/increment)
- [ ] Variant SKU generation
- [ ] Variant image assignment
- [ ] Bulk variant operations
- [ ] Attribute <-> Variant relationship integrity

### 6.3 Product Image Handling
- [ ] Image reordering
- [ ] Primary image designation
- [ ] Thumbnail/medium/large generation with Sharp
- [ ] Orphaned image cleanup on product delete

### 6.4 Draft/Hidden Products
- [ ] Draft products not visible to customers — verify all query paths
- [ ] Scheduled publish/depublish
- [ ] Sale labels (sale badge, countdown timer)

### 6.5 SKU Generation
- [ ] Configurable rules from `config/default.json`
- [ ] Uniqueness enforcement
- [ ] Auto-generation on variant creation

### 6.6 Bulk Operations
- [ ] Bulk delete
- [ ] Bulk sale/discount
- [ ] Bulk category assignment
- [ ] Transaction safety for bulk ops

### 6.7 Product Relations
- [ ] Tags (many-to-many)
- [ ] Categories (many-to-many via ProductCategory)
- [ ] Brand association
- [ ] Cross-sell/upsell (if implemented)

---

## AUDIT PHASE 7: ORDER MODULE (DEEP AUDIT)

**Files**: `server/src/modules/order/{model,service,controller,routes,validation}.js`
**Client**: Order pages, checkout flow

### 7.1 Order Number Generation
- [ ] `crypto.randomBytes(3)` -> 6-char hex — collision risk under high volume
- [ ] No database-level uniqueness constraint on order number
- [ ] Plan: DB sequence or timestamp-based + retry

### 7.2 Status Workflow Enforcement
- [ ] `shared/order-workflow.json` defines 11 statuses + transition graph
- [ ] Verify every status change follows allowed transitions
- [ ] Check for missing transition guards

### 7.3 Reservation Timeout
- [ ] `reservationTimeout.job.js` — verify atomic release
- [ ] Edge case: order placed between reservation check and timeout

### 7.4 Fulfillment System
- [ ] Partial fulfillment
- [ ] Fulfillment <-> Shipment status sync
- [ ] Fulfillment -> Order status propagation
- [ ] Cancellation of unfulfilled items

### 7.5 Refund/Cancellation Flow
- [ ] Order cancellation releases inventory + coupons
- [ ] Payment reversal during cancellation
- [ ] Refund amount calculation (partial vs full)
- [ ] Return-to-origin (RTO) handling

### 7.6 Invoice Generation
- [ ] No invoice PDF generation identified
- [ ] `EDGE-CASES.md` lists invoice as "deferred"
- [ ] Audit what invoice data is available

---

## AUDIT PHASE 8: CLIENT-SIDE AUDIT

### 8.1 Token Security
- [ ] Tokens in `localStorage` — XSS vulnerability
- [ ] Token refresh uses `axios.post` instead of `api.post` — bypasses interceptors
- [ ] No httpOnly cookie option
- [ ] Plan: evaluate httpOnly cookie + CSRF token approach

### 8.2 Infinite Loop Risk
- [ ] CODE_REVIEW_REPORT flagged `useEffect` loops in ProductListPage
- [ ] Audit all `useEffect` dependencies across 43+ pages

### 8.3 Missing Shared Components
- [ ] EmptyState (empty lists, no results)
- [ ] LoadingState (skeleton loaders, spinners)
- [ ] CurrencyDisplay (consistent price formatting)
- [ ] ErrorState (retry buttons, error messages)

### 8.4 Duplicate Components
- [ ] `OrderInvoicePage` exists in both `pages/storefront/` and `pages/admin/`
- [ ] Extract shared invoice component

### 8.5 Accessibility
- [ ] ARIA labels on interactive elements
- [ ] Keyboard navigation for menus, modals, dialogs
- [ ] Color contrast ratios
- [ ] Focus management on route changes

### 8.6 Performance
- [ ] No React Query/TanStack Query — manual loading/error/data states
- [ ] Image lazy loading implementation
- [ ] Code splitting effectiveness (verify bundle sizes)
- [ ] Re-render optimization (React.memo, useMemo, useCallback)

### 8.7 Error Handling
- [ ] `AppErrorBoundary` coverage
- [ ] Network error recovery (retry buttons)
- [ ] Form validation error display
- [ ] 404/403 page implementation

### 8.8 Responsive Design
- [ ] Mobile checkout flow
- [ ] Mobile admin dashboard
- [ ] Touch targets on mobile

---

## AUDIT PHASE 9: SECURITY AUDIT (OWASP TOP 10)

### 9.1 Authentication
- [ ] JWT access token expiry configuration
- [ ] Refresh token rotation (is old token invalidated?)
- [ ] Password reset token expiry + one-time use
- [ ] Email verification requirement enforcement
- [ ] Login rate limiting effectiveness

### 9.2 Authorization
- [ ] IDOR checks on all admin endpoints
- [ ] User-scoped queries (can user A access user B's orders?)
- [ ] Role escalation prevention
- [ ] Permission check consistency

### 9.3 Injection
- [ ] SQL injection via raw queries — audit all `sequelize.literal()` and `sequelize.query()` calls
- [ ] NoSQL injection (N/A — PostgreSQL)
- [ ] HTML/JS injection via sanitize-html (review all input that renders HTML)

### 9.4 CSRF
- [ ] No CSRF protection for the SPA
- [ ] CORS configuration review (origins, methods, credentials)

### 9.5 Rate Limiting
- [ ] Rate limiters use in-memory store — not suitable for multi-instance
- [ ] Plan: Redis-backed rate limiter for horizontal scaling

### 9.6 Data Exposure
- [ ] Sensitive fields in API responses (passwords, tokens, keys)
- [ ] Credential masking in settings API
- [ ] Error messages in production (stack traces, DB errors)

### 9.7 Dependency Vulnerabilities
- [ ] Run `npm audit` on server and client
- [ ] Check for known CVEs in key dependencies

### 9.8 File Upload Security
- [ ] MIME type validation bypass risks
- [ ] File size limits
- [ ] Path traversal protection
- [ ] Malware scanning (not implemented)

### 9.9 Secrets Management
- [ ] `.env` file in `.gitignore` — verify
- [ ] Hardcoded secrets in source code
- [ ] JWT secrets strength
- [ ] Encryption key for credentials

---

## AUDIT PHASE 10: DATABASE & INFRASTRUCTURE

### 10.1 Schema Audit
- [ ] Missing indexes (check slow query patterns)
- [ ] Foreign key cascade rules
- [ ] Column type appropriateness (UUID vs VARCHAR for entityId)
- [ ] JSONB usage patterns
- [ ] Migration history consistency (82 migrations)

### 10.2 Query Performance
- [ ] N+1 query detection across all modules
- [ ] Missing `.include` on frequent JOIN patterns
- [ ] `attributes` selection to avoid over-fetching

### 10.3 Docker Configuration
- [ ] `docker-compose.yml` service definitions
- [ ] Health checks configured correctly
- [ ] Volume mounts for persistence
- [ ] Network configuration

### 10.4 Deployment
- [ ] `scripts/aws-deploy.sh` review
- [ ] Environment variable handling in production
- [ ] SSL/TLS termination (nginx config in client Dockerfile)
- [ ] Backup strategy (none identified)

### 10.5 Monitoring & Observability
- [ ] No Sentry/Error tracking
- [ ] No Prometheus/Grafana metrics
- [ ] Winston logger configuration
- [ ] Audit log as monitoring signal

---

## AUDIT PHASE 11: REMAINING MODULES (QUICK AUDIT)

### 11.1 Media Module
- [ ] Upload flow: temporary -> permanent assignment
- [ ] Image optimization (Sharp config)
- [ ] Orphaned file cleanup job
- [ ] Storage limits enforcement

### 11.2 SEO Module
- [ ] Per-entity override application (product, category, page)
- [ ] Default fallback chain
- [ ] Structured data (JSON-LD) generation
- [ ] Sitemap generation

### 11.3 Page/Menu CMS
- [ ] Page CRUD with Quill rich text
- [ ] Slug uniqueness
- [ ] Menu nesting limits
- [ ] Menu item target/link validation

### 11.4 Brand Module
- [ ] Brand CRUD
- [ ] Brand-product relationship
- [ ] Brand image/logo handling

### 11.5 Wishlist Module
- [ ] Guest wishlist migration on login
- [ ] Wishlist to cart flow
- [ ] Shared wishlist (if implemented)

### 11.6 Enquiry Module
- [ ] Form validation
- [ ] Admin response flow
- [ ] Email notification on new enquiry

### 11.7 Tax Module
- [ ] IGST/CGST/SGST calculation
- [ ] HSN code support
- [ ] Tax exemption rules
- [ ] Tax display in cart/checkout

### 11.8 User Module
- [ ] Profile update validation
- [ ] Address CRUD (default address logic)
- [ ] Account deletion flow
- [ ] GDPR/data export

---

## AUDIT OUTPUT FORMAT

Each audit phase produces a report with:

1. **Module Overview**: Files reviewed, lines of code, dependencies
2. **Critical Issues** (red): Security vulnerabilities, data loss risks, system failures
3. **High Issues** (orange): Business logic bugs, incorrect calculations, user-facing errors
4. **Medium Issues** (yellow): Performance problems, code quality, missing features
5. **Low Issues** (green): Style, documentation, minor improvements
6. **Score**: Module score out of 10
7. **Recommended Fixes**: Prioritized with implementation approach

---

## AUDIT EXECUTION ORDER

1. **Phase 1** — Payment (highest risk: refund gap, PayU idempotency)
2. **Phase 3** — Notification (critical bug: `status='skipped'`)
3. **Phase 2** — Shipping (Ekart stub, rate engine gap)
4. **Phase 4** — Access/RBAC (missing seeder)
5. **Phase 5** — Settings (no type validation, no cache)
6. **Phase 6** — Product (deep audit: inventory, variants, images)
7. **Phase 7** — Order (deep audit: workflow, fulfillment, refund)
8. **Phase 9** — Security (OWASP Top 10)
9. **Phase 8** — Client-side (token security, components, a11y, perf)
10. **Phase 10** — Database & Infrastructure
11. **Phase 11** — Remaining modules (quick audit)

---

## VERIFICATION

- Each phase produces its own `AUDIT-{MODULE}.md` in `docs/`
- Critical/High issues are tracked in `EDGE-CASES.md`
- After all phases: consolidated `AUDIT-SUMMARY.md` with system-wide score and prioritized action items
- Cross-reference with existing `CODE_REVIEW_REPORT.md` issues to avoid duplicates
