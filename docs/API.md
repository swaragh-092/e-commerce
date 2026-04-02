# API Reference (v2)

> **Base URL**: `http://localhost:5000/api`  
> **Auth**: Bearer JWT token in `Authorization` header  
> **Content-Type**: `application/json`  
> **Key Updates in v2**: Coupon endpoints, health check, 409 for price conflicts, 429 for rate limits

---

## Response Format

```json
// Success
{ "success": true, "data": {}, "message": "...", "meta": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 } }

// Error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

### HTTP Status Codes
| Code | Usage                                                       |
| ---- | ----------------------------------------------------------- |
| 200  | Success                                                     |
| 201  | Created                                                     |
| 400  | Bad request / validation                                    |
| 401  | Unauthorized                                                |
| 403  | Forbidden (insufficient role)                               |
| 404  | Not found / Feature disabled                                |
| 409  | Conflict (price changed, duplicate slug, stock unavailable) |
| 429  | Rate limited                                                |
| 500  | Server error                                                |

---

## Health Check

| Method | Endpoint  | Auth | Description                          |
| ------ | --------- | ---- | ------------------------------------ |
| GET    | `/health` | —    | Server health + DB connection status |

```json
// Response
{ "status": "ok", "uptime": 3600, "database": "connected", "timestamp": "2026-02-28T14:00:00Z" }
```

---

## Settings

| Method | Endpoint           | Auth | Role   | Description                                    |
| ------ | ------------------ | ---- | ------ | ---------------------------------------------- |
| GET    | `/settings`        | —    | Public | Get all public settings                        |
| GET    | `/settings/:group` | —    | Public | Get by group (theme/features/seo/shipping/tax) |
| PUT    | `/settings`        | ✅    | Admin  | Bulk update settings                           |
| PUT    | `/settings/:key`   | ✅    | Admin  | Update single setting                          |

---

## Authentication

| Method | Endpoint                | Rate Limit | Description                         |
| ------ | ----------------------- | ---------- | ----------------------------------- |
| POST   | `/auth/register`        | 3/hour     | Register (password policy enforced) |
| POST   | `/auth/login`           | 5/15min    | Login → access + refresh tokens     |
| POST   | `/auth/refresh`         | —          | Refresh access token                |
| POST   | `/auth/logout`          | —          | Invalidate refresh token            |
| POST   | `/auth/forgot-password` | 3/hour     | Send reset email (uses `password_reset_tokens`) |
| POST   | `/auth/reset-password`  | —          | Reset with token from email                 |
| POST   | `/auth/verify-email`    | —          | Verify email (uses `email_verification_tokens`) |

### POST `/auth/register`
```json
// Request
{ "email": "user@example.com", "password": "Secure123!", "firstName": "John", "lastName": "Doe" }
// Password: min 8 chars, 1 uppercase, 1 lowercase, 1 number

// Response 201
{ "success": true, "data": { "user": { "id": "...", "email": "...", "role": "customer" } } }
```

### POST `/auth/login`
```json
// Request
{ "email": "user@example.com", "password": "Secure123!" }

// Response 200
{ "success": true, "data": { "user": {...}, "accessToken": "eyJ...", "refreshToken": "eyJ..." } }

// Error 429 (rate limited)
{ "success": false, "error": { "code": "RATE_LIMIT", "message": "Too many attempts. Try again in 15 minutes." } }
```

---

## Users

| Method | Endpoint             | Auth | Role  | Description                |
| ------ | -------------------- | ---- | ----- | -------------------------- |
| GET    | `/users/me`          | ✅    | Any   | Get current user profile   |
| PUT    | `/users/me`          | ✅    | Any   | Update profile             |
| PUT    | `/users/me/password` | ✅    | Any   | Change password            |
| GET    | `/users`             | ✅    | Admin | List all users (paginated) |
| GET    | `/users/:id`         | ✅    | Admin | Get user by ID             |

---

## Products

| Method | Endpoint          | Auth | Role   | Description                         |
| ------ | ----------------- | ---- | ------ | ----------------------------------- |
| GET    | `/products`       | —    | Public | List (search, filter, paginate)     |
| GET    | `/products/:slug` | —    | Public | Product detail                      |
| POST   | `/products`       | ✅    | Admin  | Create (auto-generates unique slug) |
| PUT    | `/products/:id`   | ✅    | Admin  | Update                              |
| DELETE | `/products/:id`   | ✅    | Admin  | Soft delete                         |

### GET `/products` — Query Parameters
| Param      | Type   | Description                                     |
| ---------- | ------ | ----------------------------------------------- |
| `page`     | number | Page number (default: 1)                        |
| `limit`    | number | Items per page (default: 20)                    |
| `search`   | string | Search in name/description                      |
| `category` | string | Category slug filter                            |
| `minPrice` | number | Min price filter                                |
| `maxPrice` | number | Max price filter                                |
| `status`   | string | `draft` / `published` (admin only)              |
| `sort`     | string | `price_asc`, `price_desc`, `newest`, `name_asc` |
| `tags`     | string | Comma-separated tag slugs                       |

### POST `/products`
```json
{
  "name": "Premium Headphones",
  "description": "<p>Noise cancelling</p>",
  "sku": "HP-001",
  "price": 299.99,
  "salePrice": 249.99,
  "quantity": 50,
  "weight": 350.00,
  "categoryId": "uuid",
  "status": "draft",
  "tags": ["electronics"],
  "variants": [
    { "name": "Color", "value": "Black", "priceModifier": 0, "quantity": 30, "sku": "HP-001-BLK" }
  ],
  "images": [
    { "url": "...", "alt": "Front View", "isPrimary": true, "mediaId": "uuid" }
  ]
}
// Note: slug auto-generated from name, with collision handling (blue-shirt → blue-shirt-1)
// Note: description HTML is sanitized server-side
```

---

## Categories

| Method | Endpoint            | Auth | Role   | Description                                   |
| ------ | ------------------- | ---- | ------ | --------------------------------------------- |
| GET    | `/categories`       | —    | Public | Get category tree                             |
| GET    | `/categories/:slug` | —    | Public | Category with products                        |
| POST   | `/categories`       | ✅    | Admin  | Create (warns about child products on delete) |
| PUT    | `/categories/:id`   | ✅    | Admin  | Update                                        |
| DELETE | `/categories/:id`   | ✅    | Admin  | Delete (products set to categoryId=NULL)      |

---

## Cart

| Method | Endpoint          | Auth | Description                                                          |
| ------ | ----------------- | ---- | -------------------------------------------------------------------- |
| GET    | `/cart`           | ✅    | Get cart (filters out soft-deleted products, warns of price changes) |
| POST   | `/cart/items`     | ✅    | Add item (validates stock availability)                              |
| PUT    | `/cart/items/:id` | ✅    | Update quantity (validates stock)                                    |
| DELETE | `/cart/items/:id` | ✅    | Remove item                                                          |
| POST   | `/cart/merge`     | ✅    | Merge guest cart on login                                            |
| DELETE | `/cart`           | ✅    | Clear entire cart                                                    |

---

## Coupons *(NEW)*

| Method | Endpoint            | Rate Limit | Auth | Role     | Description                 |
| ------ | ------------------- | ---------- | ---- | -------- | --------------------------- |
| POST   | `/coupons`          | —          | ✅    | Admin    | Create coupon               |
| GET    | `/coupons`          | —          | ✅    | Admin    | List coupons                |
| PUT    | `/coupons/:id`      | —          | ✅    | Admin    | Update coupon               |
| DELETE | `/coupons/:id`      | —          | ✅    | Admin    | Delete coupon               |
| POST   | `/coupons/validate` | 10/min     | ✅    | Customer | Validate & preview discount |

### POST `/coupons/validate`
```json
// Request
{ "code": "SAVE20" }

// Response 200 (valid)
{
  "success": true,
  "data": {
    "coupon": { "code": "SAVE20", "type": "percentage", "value": 20 },
    "discount": 15.99,
    "message": "Coupon applied: 20% off"
  }
}

// Response 400 (invalid)
{ "success": false, "error": { "code": "COUPON_EXPIRED", "message": "This coupon has expired" } }
// Other codes: COUPON_NOT_FOUND, COUPON_USAGE_LIMIT, COUPON_MIN_ORDER, COUPON_ALREADY_USED
```

---

## Orders

| Method | Endpoint             | Auth | Role     | Description                               |
| ------ | -------------------- | ---- | -------- | ----------------------------------------- |
| POST   | `/orders`            | ✅    | Customer | Place order (with checkout validation)    |
| GET    | `/orders`            | ✅    | Any      | My orders (customer) / All orders (admin) |
| GET    | `/orders/:id`        | ✅    | Any      | Order detail                              |
| PUT    | `/orders/:id/status` | ✅    | Admin    | Update status                             |
| POST   | `/orders/:id/cancel` | ✅    | Customer | Cancel (if pending)                       |

### POST `/orders`
```json
// Request
{ "shippingAddressId": "uuid", "couponCode": "SAVE20", "notes": "Leave at door" }

// Response 201
{
  "success": true,
  "data": {
    "order": { "id": "uuid", "orderNumber": "ORD-20260228-001", "status": "pending_payment", "total": 529.98 },
    "clientSecret": "pi_xxx_secret_xxx"
  }
}

// Response 409 (price changed since add-to-cart)
{
  "success": false,
  "error": {
    "code": "PRICE_CHANGED",
    "message": "Some product prices have changed",
    "details": [
      { "productId": "uuid", "oldPrice": 50.00, "currentPrice": 65.00 }
    ]
  }
}

// Response 409 (out of stock)
{ "success": false, "error": { "code": "INSUFFICIENT_STOCK", "message": "Product 'X' only has 2 left", "details": [...] } }
```

---

## Addresses

| Method | Endpoint                 | Auth | Description                                   |
| ------ | ------------------------ | ---- | --------------------------------------------- |
| GET    | `/addresses`             | ✅    | List saved addresses                          |
| POST   | `/addresses`             | ✅    | Add new address                               |
| PUT    | `/addresses/:id`         | ✅    | Update address                                |
| DELETE | `/addresses/:id`         | ✅    | Delete (safe — orders have address snapshots) |
| PUT    | `/addresses/:id/default` | ✅    | Set as default                                |

---

## Payments

| Method | Endpoint                  | Auth | Role     | Description                                   |
| ------ | ------------------------- | ---- | -------- | --------------------------------------------- |
| POST   | `/payments/create-intent` | ✅    | Customer | Create Stripe intent (idempotent per orderId) |
| POST   | `/payments/webhook`       | —    | —        | Stripe webhook (sig-verified, idempotent)     |
| POST   | `/payments/:id/refund`    | ✅    | Admin    | Issue refund                                  |

---

## Wishlist *(Feature-Toggleable)*

| Method | Endpoint                             | Auth | Description    |
| ------ | ------------------------------------ | ---- | -------------- |
| GET    | `/wishlist`                          | ✅    | Get wishlist   |
| POST   | `/wishlist/items`                    | ✅    | Add product    |
| DELETE | `/wishlist/items/:productId`         | ✅    | Remove product |
| POST   | `/wishlist/items/:productId/to-cart` | ✅    | Move to cart   |

---

## Reviews *(Feature-Toggleable)*

| Method | Endpoint                  | Rate Limit | Auth | Role     | Description                       |
| ------ | ------------------------- | ---------- | ---- | -------- | --------------------------------- |
| GET    | `/products/:slug/reviews` | —          | —    | Public   | Product reviews (includes `orderId` if verified) |
| POST   | `/products/:slug/reviews` | 5/day      | ✅    | Customer | Submit (can reference `orderId`) |
| PUT    | `/reviews/:id/status`     | —          | ✅    | Admin    | Moderate                          |
| DELETE | `/reviews/:id`            | —          | ✅    | Admin    | Delete                            |

---

## Media

| Method | Endpoint        | Auth | Role  | Description                           |
| ------ | --------------- | ---- | ----- | ------------------------------------- |
| POST   | `/media/upload` | ✅    | Admin | Upload (MIME validated, SVG rejected) |
| GET    | `/media`        | ✅    | Admin | List uploaded files                   |
| DELETE | `/media/:id`    | ✅    | Admin | Delete file                           |

---

## Audit Log

| Method | Endpoint      | Auth | Role  | Description                |
| ------ | ------------- | ---- | ----- | -------------------------- |
| GET    | `/audit-logs` | ✅    | Admin | List (paginated, filtered) |

### Query Parameters
| Param            | Type   | Description                             |
| ---------------- | ------ | --------------------------------------- |
| `entity`         | string | Filter by type (Product, Order, etc.)   |
| `action`         | string | Filter by action (CREATE, UPDATE, etc.) |
| `userId`         | string | Filter by admin user                    |
| `from` / `to`    | date   | Date range                              |
| `page` / `limit` | number | Pagination                              |

---

## SEO

| Method | Endpoint       | Auth | Description            |
| ------ | -------------- | ---- | ---------------------- |
| GET    | `/sitemap.xml` | —    | Auto-generated sitemap |
| GET    | `/robots.txt`  | —    | Robots file            |

---

*All list endpoints support `page` and `limit` query parameters. Default: page=1, limit=20. Rate-limited endpoints return HTTP 429 on excess.*
