# QA & Testing Guide — A to Z (v3.0)

This guide provides a comprehensive framework for manual and automated testing of the E-Commerce Platform.

---

## 1. Environment Setup
*   **Backend**: `cd server && npm install && npm run dev` (Runs on port 5000)
*   **Frontend**: `cd client && npm install && npm run dev` (Runs on port 5173)
*   **Database**: Ensure PostgreSQL is running and migrations are applied: `npx sequelize-cli db:migrate`.

---

## 2. Test Suite A: Authentication & User Management
| Feature | Test Case | Expected Result |
| :--- | :--- | :--- |
| **Registration** | Register with valid data | User created, redirect to login/home |
| **Login** | Login with valid credentials | Access & Refresh tokens stored in local storage |
| **RBAC** | Admin accesses `/admin`, Customer blocked | Admin sees dashboard; Customer gets 403 or redirect |
| **Password Reset** | Use "Forgot Password" flow | Email sent (check logs/mailhog), token allows reset |
| **Rate Limiting** | Spam login attempts (5+ in 15min) | HTTP 429 received, account locked temporarily |

---

## 3. Test Suite B: Product Catalog & Media
| Feature | Test Case | Expected Result |
| :--- | :--- | :--- |
| **Search** | Search for "Headphones" | Results filtered by name/description/tags |
| **Filtering** | Filter by Category + Price Range | Product list updates dynamically |
| **Media Upload** | Upload JPEG/PNG via Admin | File stored, media record created, SVG rejected |
| **Variants** | Add product with Size/Color variants | Frontend displays selection, price updates per variant |
| **SEO Fields** | Edit meta tags on Product Page | Tags updated in database and rendered in `<head>` |

---

## 4. Test Suite C: Cart & Checkout (Crucial Flows)
| Feature | Test Case | Expected Result |
| :--- | :--- | :--- |
| **Add to Cart** | Add 3 items, 1 out of stock | Success for 3; Error/Disable for out of stock |
| **Quantity Update**| Increment above available stock | Request fails with 400 "Insufficient Stock" |
| **Price Drift** | Admin changes price while item in cart | Checkout fails with 409 "Price Changed" |
| **Coupon Apply** | Apply percentage vs flat coupon | Total reflects discount; min-spend enforced |
| **Guest Checkout** | Checkout without login | Session-based cart works; prompted to login/register |

---

## 5. Test Suite D: Orders & Shipping
| Feature | Test Case | Expected Result |
| :--- | :--- | :--- |
| **Order Creation** | Place order with multiple items | Order record created, stock decremented atomically |
| **Shipping Calc** | Change address to different zone | Shipping fee updates based on rules/zones |
| **Provider Config** | Update Shiprocket API credentials | Credentials encrypted in DB (verify via DB query) |
| **Status Update** | Admin updates Order to "Shipped" | Audit log recorded, notification triggered |
| **Tracking** | Add tracking ID to order | Customer sees tracking link in order detail page |

---

## 6. Test Suite E: SEO Control System (New)
| Feature | Test Case | Expected Result |
| :--- | :--- | :--- |
| **Global Toggle** | Disable SEO in Settings | All meta tags revert to default browser behavior |
| **Path Override** | Create override for `/about-us` | `<title>` and `og:image` change for that specific path |
| **Sitemap** | Access `/sitemap.xml` | Returns valid XML with all published products/categories |
| **Robots** | Access `/robots.txt` | Returns standard crawler directives |
| **Social Preview** | Paste URL into Meta Tag Debugger | OG tags (title, description, image) show correctly |

---

## 7. Test Suite G: Payment Gateways
| Feature | Test Case | Expected Result |
| :--- | :--- | :--- |
| **Multi-Provider** | Select Razorpay vs Stripe vs Cashfree | Correct gateway SDK/hosted page opens |
| **COD Workflow** | Place order with COD | Status is `pending_cod`; stock reserved |
| **COD Confirmation**| Admin confirms cash collection | Order status → `paid`; Payment → `cod_collected` |
| **Webhook Logic** | Simulate successful webhook payload | Order marked `paid` automatically; idempotency prevents double credit |
| **Encryption** | Save provider API secret in Admin | DB value is ciphertext; Decryptable only by server |
| **Verify Flow** | Complete payment, then click "Verify" | Frontend calls backend to confirm status with provider API |

---

## 8. Test Suite H: Admin Operations & Security
| Feature | Test Case | Expected Result |
| :--- | :--- | :--- |
| **Audit Logs** | Create/Update a product | Audit entry shows: User, Entity ID, Action, and Changes |
| **URL Masking** | Change `ADMIN_PATH_SECRET` env | Admin dashboard accessible ONLY at the secret URL |
| **Permissions** | Create "Editor" role without "Settings" access | Editor can manage products but cannot see/edit settings |
| **Input Sanitization**| Inject `<script>` into product description | HTML is sanitized (e.g., via DOMPurify/Sanitize) |

---

## 9. Error Codes Reference for Testers
*   **409 Conflict**: Price drift or Stock run-out during checkout.
*   **429 Too Many Requests**: Rate limit hit (Auth/Coupons).
*   **403 Forbidden**: Insufficient permissions for administrative actions.
*   **401 Unauthorized**: JWT expired or missing.

---

## 10. Contact for Critical Bugs
For P0 issues (Payment failure, Stock leakage), contact the Backend Lead immediately.
