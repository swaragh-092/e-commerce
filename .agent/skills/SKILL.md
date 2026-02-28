---
name: E-Commerce Platform — Coding Standards & Rules
description: Strict coding standards, conventions, and rules the agent MUST follow when writing code for this project. Read this before ANY code change.
---

# Agent Rules & Coding Standards

---

## 🚨 RULE 1: NEVER HALLUCINATE — Always Read Before Coding

Before writing ANY code, you MUST:

1. **Read the relevant doc** — ALWAYS check these files for the source of truth:
   - `docs/ARCHITECTURE.md` — Module specs, models, endpoints, edge cases
   - `docs/DATABASE.md` — Exact SQL schemas with constraints
   - `docs/API.md` — Endpoint signatures, request/response formats
   - `docs/EDGE-CASES.md` — Known issues and their resolutions

2. **Read existing code first** — Before modifying any module, read ALL files in that module directory. Do NOT assume what exists — verify.

3. **Match the schema exactly** — Model fields, column types, constraints MUST match `docs/DATABASE.md`. Do NOT invent columns or change types.

4. **Match the API exactly** — Endpoint paths, HTTP methods, request bodies, response shapes MUST match `docs/API.md`. Do NOT create undocumented endpoints.

5. **When unsure, ask** — If the docs don't cover something, ASK the user. Do NOT guess or make up patterns.

6. **Verify after writing** — After creating/editing code, run the server to check for errors. Do NOT assume it works.

---

## 🚨 RULE 2: Follow the Module Pattern — No Exceptions

Every backend module lives in `server/src/modules/<name>/` and MUST follow this file structure:

```
<name>.model.js        → Sequelize model (fields, options, associations)
<name>.controller.js   → Thin handlers (extract params → call service → send response)
<name>.service.js      → ALL business logic lives here
<name>.routes.js       → Express router with middleware chain
<name>.validation.js   → Joi schemas for request validation
```

### What goes WHERE:

| Logic Type               | Goes In                | NEVER In            |
| ------------------------ | ---------------------- | ------------------- |
| Database queries         | service.js             | controller, routes  |
| Request validation       | validation.js (Joi)    | controller, service |
| Auth/role checks         | middleware (on routes) | controller, service |
| HTTP response formatting | controller.js          | service             |
| Business rules           | service.js             | controller, model   |
| Model associations       | model.js `associate()` | anywhere else       |

### Controller Pattern (THIN — no logic):
```javascript
exports.create = async (req, res, next) => {
  try {
    const result = await SomeService.create(req.body);
    return success(res, result, 'Created', 201);
  } catch (err) {
    next(err);
  }
};
```

### Route Pattern (middleware chain):
```javascript
router.post('/',
  authenticate,                          // JWT check
  authorize('admin', 'super_admin'),     // Role check
  validate(createSchema),                // Joi validation
  controller.create                      // Handler
);
```

---

## 🚨 RULE 3: Tech Stack — Do NOT Change

| What               | Use                          | Do NOT Use                                    |
| ------------------ | ---------------------------- | --------------------------------------------- |
| Frontend framework | React 18+ (Vite)             | Next.js, CRA, Angular, Vue                    |
| UI library         | MUI (Material UI) 5+         | TailwindCSS, Bootstrap, custom CSS frameworks |
| Backend            | Express (CommonJS `require`) | ES modules `import`, Fastify, Koa             |
| Database           | PostgreSQL 15+               | MySQL, MongoDB, SQLite                        |
| ORM                | Sequelize 6+                 | Prisma, Knex, TypeORM                         |
| Validation         | Joi                          | Yup, Zod, express-validator                   |
| Auth               | JWT + bcrypt (cost 12)       | Passport, OAuth-only                          |
| Payment            | Stripe                       | —                                             |
| Email              | Nodemailer                   | —                                             |

---

## RULE 4: Naming Conventions

| Item             | Convention               | Example                               |
| ---------------- | ------------------------ | ------------------------------------- |
| API routes       | kebab-case, plural nouns | `/api/products`, `/api/cart/items`    |
| DB tables        | snake_case, plural       | `products`, `order_items`             |
| DB columns       | snake_case               | `created_at`, `is_featured`           |
| JS model fields  | camelCase                | `createdAt`, `isFeatured`             |
| Backend files    | dot-separated            | `product.model.js`, `auth.routes.js`  |
| React components | PascalCase               | `ProductCard.jsx`, `CartDrawer.jsx`   |
| React hooks      | camelCase with "use"     | `useAuth.js`, `useCart.js`            |
| Service files    | camelCase                | `productService.js`, `authService.js` |
| Constants/Enums  | UPPER_SNAKE_CASE         | `ORDER_STATUS`, `USER_ROLES`          |

---

## RULE 5: API Response Format — Always Use Helpers

ALWAYS use `utils/response.js` helpers. Never return raw JSON.

```javascript
// ✅ CORRECT
return success(res, product, 'Product created', 201);
return error(res, 'Not found', 404, 'NOT_FOUND');

// ❌ WRONG — never do this
return res.json({ product });
return res.status(404).json({ message: 'Not found' });
```

Response shape:
```json
// Success
{ "success": true, "data": {}, "message": "...", "meta": { "page": 1, "limit": 20, "total": 100 } }

// Error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

---

## RULE 6: Database Model Rules

1. **Primary keys**: UUID (`DataTypes.UUIDV4`) — no auto-increment integers
2. **Timestamps**: Always `timestamps: true`
3. **Underscored**: Always `underscored: true` (camelCase in JS → snake_case in DB)
4. **Soft delete**: Use `paranoid: true` for Users, Products, Orders
5. **Associations**: Define in `associate()` static method, NOT in the model body
6. **CHECK constraints**: Add via migrations (price > 0, quantity >= 0, etc.)
7. **Slugs**: Use `utils/slugify.js` with collision detection — NEVER use name directly

---

## RULE 7: Security — Always Apply

1. **Input**: Validate with Joi BEFORE processing. Sanitize HTML with `sanitize-html`
2. **Passwords**: bcrypt with cost factor 12. Policy: 8+ chars, uppercase, lowercase, number
3. **Auth routes**: Rate limit — login: 5/15min, register: 3/hour, forgot-password: 3/hour
4. **File uploads**: Validate MIME type with `file-type` package. Reject SVGs. Rename to `{uuid}.{ext}`
5. **CORS**: Restrict to `process.env.CLIENT_URL` only — NEVER use `*`
6. **Inventory**: Use atomic SQL updates inside transactions — NEVER read-then-write
7. **Payments**: Use Stripe idempotency keys. Deduplicate webhooks via `webhook_events` table
8. **Checkout**: Re-validate ALL prices server-side. Return 409 if prices changed

---

## RULE 8: Frontend Rules

1. **MUI only** — Use MUI components for all UI. No custom CSS for standard elements
2. **Theme from API** — Colors, fonts come from `/api/settings`. Use `ThemeContext`
3. **API calls via services** — NEVER write `axios.get()` in components. Use service files
4. **Auth via context** — Use `useAuth()` hook. Never store tokens in localStorage directly
5. **Protected routes** — Admin pages MUST use `<ProtectedRoute roles={['admin', 'super_admin']}>`
6. **Feature flags** — Check `config.features.<feature>` before rendering toggleable UI

---

## RULE 9: Error Handling

1. **Controllers**: Always `try/catch` + `next(err)`
2. **Services**: Throw errors with appropriate messages — let errorHandler.middleware catch them
3. **Custom errors**: Use error classes like `throw { statusCode: 404, message: 'Not found' }`
4. **Sequelize errors**: errorHandler middleware maps them to proper HTTP codes automatically
5. **Frontend**: API service interceptors handle 401 (auto-refresh token) and show toast on errors

---

## RULE 10: When Creating a New Module

Use the `/new-module` workflow. Summary:
1. Read the docs for that module's spec
2. Create directory: `server/src/modules/<name>/`
3. Create model → migration → run migration
4. Create validation schemas
5. Create service (all business logic)
6. Create controller (thin)
7. Create routes (with middleware chain)
8. Register routes in `app.js`
9. Create seed data if needed
10. Test all endpoints

---

## Quick Reference: Middleware Order on Routes

```javascript
// Public route
router.get('/products', controller.getAll);

// Auth-only route
router.get('/cart', authenticate, controller.getCart);

// Admin-only route
router.post('/products', authenticate, authorize('admin', 'super_admin'), validate(schema), controller.create);

// Admin with audit logging
router.put('/products/:id', authenticate, authorize('admin', 'super_admin'), auditLog('Product'), validate(schema), controller.update);

// Feature-gated route
router.post('/wishlist', authenticate, featureGate('wishlist'), validate(schema), controller.add);

// Rate-limited route
router.post('/auth/login', loginLimiter, validate(loginSchema), controller.login);
```

---

## RULE 11: Always Suggest Improvements

**Be proactive, not just reactive.** After completing any task, think critically about:

1. **Performance** — Can this query be optimized? Should we add an index? Is there an N+1 problem?
2. **Security** — Is there a vulnerability we missed? An edge case not covered?
3. **UX** — Would a loading state, error message, or toast notification improve the experience?
4. **Code quality** — Is there duplication? Can something be extracted into a reusable util or hook?
5. **Edge cases** — What happens with empty data, null values, concurrent requests, network failures?
6. **Scalability** — Will this work with 10,000 products? 1,000 concurrent users?

**How to suggest:**
- After finishing a module or feature, briefly list 2-3 improvement ideas
- Flag potential issues you notice in existing code while working on something else
- Suggest better patterns if you see something that could be cleaner
- Recommend tests that would catch regressions

**Examples of good suggestions:**
- "This product search uses LIKE — consider adding a GIN index for full-text search if the catalog grows"
- "The cart merge logic doesn't handle duplicate variants — should we sum quantities or keep the latest?"
- "Consider adding a debounce to the search input to reduce API calls"
- "This admin route is missing audit logging — should I add it?"

---

## RULE 12: Brainstorm Before Building

When starting a new feature or solving a complex problem:

1. **Think about alternatives** — Don't just jump to the first approach. Consider 2-3 ways
2. **Identify trade-offs** — Every choice has pros/cons. State them briefly
3. **Check for existing patterns** — Is there a similar pattern already in the codebase? Reuse it
4. **Consider the user flow** — Walk through the feature as a customer AND as an admin
5. **Flag decisions** — If there's a significant design choice, mention it to the user before coding
