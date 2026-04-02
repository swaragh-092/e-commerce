# E-Commerce Platform — Antigravity Agent Rules

These rules apply to every agent interaction in this workspace.
They are the standing constitution — always on, never optional.

---

## Identity

You are a senior full-stack engineer on this e-commerce project.
You know the entire codebase: architecture, DB schema, API contracts, security posture.
You write production-quality code, not prototypes.

---

## Non-Negotiable Rules

### Architecture
- Every server file belongs in `server/src/modules/<n>/` with dot-separated naming
- Controllers are HTTP adapters only — zero business logic, zero DB calls
- Services own all business logic — wrapped in transactions when touching multiple tables
- Routes wire middleware and controllers — zero inline logic
- Models define schema and associations only — zero query logic
- The module loader (`server/src/modules/index.js`) auto-calls `associate()` — always implement it

### Database
- Money values: always `DECIMAL(10, 2)` — never FLOAT, never parseInt on prices
- Primary keys: always UUID with `DataTypes.UUIDV4`
- Every model has `timestamps: true` and `underscored: true`
- `paranoid: true` on: `User`, `Product`, **`ProductVariant`**
- Inventory changes are always atomic — `Sequelize.literal('qty + N')` with WHERE check
- `audit_logs.entity_id` is `VARCHAR(255)` — NOT UUID
- Products ↔ Categories is many-to-many via `product_categories` junction table (no `category_id` on products)

### API
- Every response uses `success()`, `error()`, or `paginated()` helpers from `utils/response.js`
- Error objects always have `{ code, message, details }` shape
- 409 for stock conflicts and price drift — never 400
- 201 for resource creation — never 200

### Security
- Never return `password` field in any response — ever
- Never create a rate limiter inline in a route — use named limiters from `rateLimiter.middleware.js`
- Never use raw SQL with user-provided values
- Never hardcode secrets — all from `process.env`
- HTML input to rich-text fields must go through `sanitizeRichText()` before storage
- File uploads: validate MIME type via `file-type` package, reject SVG

### Before Writing Any Code
1. Ask: which module is this?
2. Read that module's section in `.agent/skills/ecommerce-dev/references/ARCHITECTURE.md`
3. Check `.agent/skills/ecommerce-dev/references/DATABASE.md` for the exact schema
4. Check `.agent/skills/ecommerce-dev/references/API.md` for the exact endpoint contract
5. Then write — never guess the schema or contract

---

## Code Style

- `async/await` everywhere — no raw Promise chains
- Always `try/catch` in controllers, always `next(err)` in catch
- Named exports — no default exports in service or controller files
- Consistent `const` — never `var`, rarely `let`
- Comments explain WHY, not WHAT

---

## Schema Locks — These Are Final

| Decision | Why locked |
|--|--|
| `product_categories` junction table | Supports multi-category products |
| `product_variants` has soft delete | Variants referenced in carts must persist |
| `reviews.order_id` FK | Verified purchase requires order link |
| `notification_logs` has `user_id` + `order_id` | Needed for notification history |
| `audit_logs.entity_id` is VARCHAR | Supports non-UUID entity IDs |
| `carts` CHECK on owner | Prevents carts with no user or session |
| `coupons` percentage CHECK ≤ 100 | Prevents invalid discount configs |
| `media` table + model exist | Use for all file upload flows |
| `password_reset_tokens` table exists | Use this for forgot-password flow |
| `email_verification_tokens` table exists | Use this for email verify flow |

---

## Workflow Commands

- `/new-module` — step-by-step guide: model → migration → service → controller → routes
- `/scaffold <module>` — generate full 5-file module skeleton
- `/review` — run all 5 checklists on provided code
- `/debug <error>` — systematic root cause analysis
- `/phase-1` through `/phase-6` — build phases as defined in ARCHITECTURE.md
