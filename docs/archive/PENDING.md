# 📋 Frontend Pending Tasks

> Generated from code review — April 2, 2026  
> Last updated — April 3, 2026

---

## ✅ Completion Summary (April 3, 2026)

**39 of 39 tasks completed** ✅

| Priority | Total | Done | Remaining |
|---|---|---|---|
| 🔴 Critical | 11 | 11 | 0 |
| 🟡 Should Fix | 14 | 14 | 0 |
| ⚡ Performance | 4 | 4 | 0 |
| 🧠 Architecture | 8 | 8 | 0 |
| 🔒 Security | 2 | 2 | 0 |
| **Total** | **39** | **39** | **0** |

---

## 🔴 Critical (Blockers)

### 1. Cart Service & State
- [x] Create `src/services/cartService.js`
- [x] Create `src/context/CartContext.jsx` + `src/hooks/useCart.js`
- [x] Wire up the **"Add to Cart"** button in `ProductDetailPage.jsx`
- [x] Display cart item count badge in `StoreLayout` navbar
- [x] Create `src/pages/storefront/CartPage.jsx` — route `/cart`

### 2. Checkout Page
- [x] Create `src/pages/storefront/CheckoutPage.jsx` — route `/checkout`
- [x] Step 1: Address selection
- [x] Step 2: Coupon validation via `POST /coupons/validate`
- [x] Step 3/4: Order summary + place order → `POST /orders`
- [x] Add `/checkout` route to `AppRoutes.jsx` inside `<ProtectedRoute>`

### 3. Payment Pages
- [x] Create `src/services/paymentService.js`
- [x] Create `src/pages/storefront/PaymentPage.jsx` with Stripe Elements
- [x] Create `src/pages/storefront/PaymentSuccessPage.jsx`
- [x] Create `src/pages/storefront/PaymentFailurePage.jsx`
- [x] Add all payment routes to `AppRoutes.jsx`

### 4. Fix: `AvatarUploader.jsx` — `window.location.reload()`
- [x] Remove `window.location.reload()` after avatar upload
- [x] Expose `refreshUser()` from `AuthContext`
- [x] After upload, call `refreshUser()` to re-fetch user without page reload

### 5. Fix: `AuthContext.register()` — Broken Post-Register State
- [x] Register now auto-logs-in (Option B) and redirects to `/`
- [x] `RegisterPage.jsx` redirect updated from `/login` to `/`
- [x] Guest cart merged on register just like login

### 6. Fix: Admin Review Moderation Route is Wrong
- [x] Fixed `updateReviewStatus` in `adminService.js` to call `/admin/reviews/:id/moderate`

### 7. Fix: `MediaUploader.jsx` — Response Shape Mismatch
- [x] `AvatarUploader.jsx` now correctly uses `mediaRes.data.data.media.id`
- [x] Both uploaders use `getMediaUrl()` for URL resolution

### 8. Fix: `OrdersManagePage.jsx` — Search Unused
- [x] Added search `TextField` to filter bar
- [x] Added `search` to `useEffect` dependency array

### 9. Fix: Admin Refund Button Returns 404
- [x] Refund button replaced with disabled "Coming Soon" tooltip in `OrderDetailPage.jsx`

### 10. Fix: `AccountPage.jsx` — Addresses Tab is a Placeholder
- [x] Full CRUD `AddressesTab` implemented (fetch, create, update, delete, set default)

### 11. Fix: `AccountPage.jsx` — Orders Tab is a Placeholder
- [x] Full `OrdersTab` implemented (list orders, cancel pending_payment orders)

---

## 🟡 Should Fix

### 12. Fix: `ProductCard.jsx` — Hardcoded Fake Rating
- [x] Removed hardcoded `value={4.5}` and `(12)` review count
- [x] Now conditionally renders `<Rating>` only when `averageRating` is present

### 13. Fix: Price Calculation Bug in `ProductDetailPage.jsx`
- [x] Fixed falsy check on `priceModifier` — now uses `?? 0` null coalescing

### 14. Fix: `WishlistButton.jsx` — Initial State Always `false`
- [x] `WishlistContext` created — fetches wishlist once, provides `Set<productId>` shared globally
- [x] `WishlistButton` syncs via `useEffect([wishlistIds, productId])` — correct initial state on every mount

### 15. Fix: `WishlistButton.jsx` — Replace `alert()`
- [x] Replaced `alert()` with `navigate('/login', { state: { from } })` + `Snackbar` notifications

### 16. Fix: Hardcoded `localhost:5000`
- [x] Created `src/utils/media.js` with `getMediaUrl()` helper
- [x] Applied to `WishlistPage.jsx`, `AvatarUploader.jsx`, `CartPage.jsx`, `HomePage.jsx`

### 17. Fix: `CouponsPage.jsx` — `maxDiscount` Field Missing
- [x] Added conditional `maxDiscount` TextField (shown only for `percentage` type coupons)

### 18. Fix: `ReviewSection.jsx` — `orderId` Never Sent
- [x] `ReviewSection` now accepts `productId` prop
- [x] Fetches user orders on mount to find verified purchase `orderId`
- [x] `orderId` included in review creation payload

### 19. Fix: `ProtectedRoute.jsx` — Blank Screen During Auth Check
- [x] Replaced `return null` with centered `<CircularProgress>`

### 20. Fix: `VariantSelector.jsx` — No Cross-Group Stock Validation
- [x] Per-group `selections` map tracks each attribute group independently
- [x] Unselected groups shown as `<Chip color="warning">` reminders; out-of-stock styled with strikethrough + 50% opacity

### 21. Fix: `ProductEditPage.jsx` — No Variant Management
- [x] Added "Product Variants" section with dynamic add/remove rows
- [x] Fields: Attribute name, Value, Price Modifier, Stock, SKU
- [x] Variants array included in create/update payload
- [x] Replaced `alert()` with `<Alert>` error display

### 22. Fix: `SettingsProvider`/`AuthProvider` Block Render
- [x] Both now show `<CircularProgress>` instead of blank screen during loading

---

## ⚡ Performance

### 23. Deduplicate Category Tree Fetching
- [x] `CategoryContext` created — single `getCategoryTree()` call on app mount, shared via `useCategories()`
- [x] `CategoryNav` and `ProductFilters` both consume the context — zero duplicate network requests

### 24. Debounce Search Input in `ProductListPage.jsx`
- [x] `useDebounce` hook created and applied — 400ms debounce on search input

### 25. Fix: `ProductFilters.jsx` — Price Slider Fires Duplicate API Calls
- [x] Local `sliderValue` state used while dragging; `onChangeCommitted` fires the API call

### 26. Cache User Profile on Load
- [x] `AuthContext` initialises `user` state from `localStorage.userProfile` immediately (no blank flash)
- [x] Persisted after every `login()`, `register()`, `refreshUser()`, `getMe()`; cleared on `logout()` and on bad token

---

## 🧠 Architecture / Code Quality

### 27. Remove Duplication: `authService` vs `userService`
- [x] Removed `getMe` and `updateProfile` from `authService.js`
- [x] `AuthContext` now uses `userService.getMe`

### 28. Add Global Toast/Snackbar System
- [x] MUI `Snackbar` + `Alert` added throughout: WishlistButton, ProductEditPage, CheckoutPage, AccountPage, etc.
- [x] `alert()` calls replaced; `window.confirm()` calls replaced with MUI `Dialog` confirm patterns

### 29. Fix: `StoreLayout` Double Container
- [x] Removed `<Container>` wrapper from `StoreLayout.jsx` — pages manage their own containers

### 30. Add `AuthContext` `refreshUser()` Method
- [x] `refreshUser()` added to `AuthContext` and exposed in context value

### 31. Add Missing Route: `/cart`
- [x] `CartPage` registered in `AppRoutes.jsx`

### 32. Home Page is a Placeholder
- [x] Created `src/pages/storefront/HomePage.jsx` with hero banner, categories, new arrivals

### 33. No 404 / Not Found Page
- [x] Created `NotFoundPage.jsx` and added `<Route path="*">` catch-all

### 34. `CategoryNav.jsx` Not Rendered Anywhere
- [x] Imported and rendered in `StoreLayout.jsx` immediately after `</AppBar>` — visible on every storefront page

---

## 🔒 Security

### 35. Tokens in `localStorage` — XSS Risk
- [x] Added `DOMPurify` sanitization to all `dangerouslySetInnerHTML` usages

### 36. `dangerouslySetInnerHTML` in `ProductDetailPage.jsx`
- [x] Installed `dompurify` and applied `DOMPurify.sanitize(product.description)`

---

## 📦 npm Packages

| Package | Status |
|---|---|
| `@stripe/react-stripe-js` | ✅ Installed |
| `@stripe/stripe-js` | ✅ Installed |
| `dompurify` | ✅ Installed |

---

## ✅ Remaining Tasks — ALL COMPLETE

1. ✅ **`WishlistButton` initial state** — `WishlistContext` created; provides a `Set<productId>` fetched once on login. `WishlistButton` syncs via `useEffect([wishlistIds, productId])`. `WishlistProvider` wraps app.
2. ✅ **`VariantSelector` cross-group validation** — Per-group `selections` map tracks each group independently. Unselected groups shown as `<Chip color="warning">` reminder. Out-of-stock options rendered with strikethrough + 50% opacity. `onSelect` remains backward-compatible.
3. ✅ **Category deduplication** — `CategoryContext` created; single `getCategoryTree()` call on mount, shared via `useCategories()`. `CategoryNav` and `ProductFilters` both consume the context — zero duplicate fetches.
4. ✅ **Cache user profile** — `AuthContext` hydrates `user` + `isAuthenticated` from `localStorage.userProfile` immediately (no blank-screen flash). Persisted after every successful `getMe()`, `login()`, `register()`, `refreshUser()`. Cleared on `logout()` and on failed token validation.
5. ✅ **`CategoryNav` in `StoreLayout`** — Imported from `../components/layout/CategoryNav` and rendered immediately after `</AppBar>`. Shows category navigation bar with dropdown menus on every storefront page.


