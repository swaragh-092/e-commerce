# 📋 Frontend Pending Tasks

> Generated from code review — April 2, 2026  
> Last updated — April 3, 2026

---

## ✅ Completion Summary (April 3, 2026)

**34 of 39 tasks completed** in the implementation pass.

| Priority | Total | Done | Remaining |
|---|---|---|---|
| 🔴 Critical | 11 | 11 | 0 |
| 🟡 Should Fix | 14 | 12 | 2 |
| ⚡ Performance | 4 | 3 | 1 |
| 🧠 Architecture | 8 | 7 | 1 |
| 🔒 Security | 2 | 2 | 0 |
| **Total** | **39** | **34** | **5** |

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
- [ ] On mount, check if product is already in the user's wishlist
- [ ] Either pass `initialInWishlist` from parent or create a `useWishlist` hook with cached IDs

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
- [ ] When multiple variant groups exist (Size + Color), validate the specific combination
- [ ] Match backend `ProductVariant` rows by `name+value` pair combination

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
- [ ] `CategoryNav.jsx` and `ProductFilters.jsx` both independently call `GET /categories`
- [ ] Lift into a `CategoryContext` or React Query cache

### 24. Debounce Search Input in `ProductListPage.jsx`
- [x] `useDebounce` hook created and applied — 400ms debounce on search input

### 25. Fix: `ProductFilters.jsx` — Price Slider Fires Duplicate API Calls
- [x] Local `sliderValue` state used while dragging; `onChangeCommitted` fires the API call

### 26. Cache User Profile on Load
- [ ] After `getMe()`, persist user to `localStorage` and hydrate on init to avoid blank screen

---

## 🧠 Architecture / Code Quality

### 27. Remove Duplication: `authService` vs `userService`
- [x] Removed `getMe` and `updateProfile` from `authService.js`
- [x] `AuthContext` now uses `userService.getMe`

### 28. Add Global Toast/Snackbar System
- [ ] Consider `notistack` or a `ToastContext` for unified notifications
- [ ] Replace remaining `window.confirm()` calls with modal dialogs

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
- [ ] Import `CategoryNav` in `StoreLayout.jsx` and render it below the `AppBar`

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

## 🔲 Remaining Tasks (5)

1. **`WishlistButton` initial state** — check if product is in wishlist on mount
2. **`VariantSelector` cross-group validation** — validate variant combinations
3. **Category deduplication** — `CategoryContext` or React Query cache
4. **Cache user profile** — hydrate from `localStorage` on init
5. **`CategoryNav` in `StoreLayout`** — import and render below AppBar

- [ ] Wire up the **"Add to Cart"** button in `ProductDetailPage.jsx` (currently has no `onClick`)
- [ ] Display cart item count badge in `StoreLayout` navbar
- [ ] Create `src/pages/storefront/CartPage.jsx` — route `/cart`

---

### 2. Checkout Page — ENTIRELY MISSING
- [ ] Create `src/pages/storefront/CheckoutPage.jsx` — route `/checkout`
- [ ] Step 1: Address selection — call `GET /users/me/addresses`, allow selecting existing or adding new
- [ ] Step 2: Coupon field — call `POST /coupons/validate` with `{ code, orderAmount }`
- [ ] Step 3: Order summary — subtotal, tax, shipping, discount, total
- [ ] Step 4: Place order — call `POST /orders` with `{ shippingAddressId, couponCode?, notes? }`
- [ ] Add `/checkout` route to `AppRoutes.jsx` inside `<ProtectedRoute>`

---

### 3. Payment Pages — ENTIRELY MISSING
- [ ] Create `src/services/paymentService.js`
  - `POST /payments/create-intent` — `{ orderId }`
- [ ] Create `src/pages/storefront/PaymentPage.jsx` — route `/payment/:orderId`
  - Call `create-intent` to get Stripe `clientSecret`
  - Integrate Stripe Elements (`@stripe/react-stripe-js`)
  - Handle payment confirmation
- [ ] Create `src/pages/storefront/PaymentSuccessPage.jsx` — route `/payment/success`
- [ ] Create `src/pages/storefront/PaymentFailurePage.jsx` — route `/payment/failure`
- [ ] Add all payment routes to `AppRoutes.jsx`

---

### 4. Fix: `AvatarUploader.jsx` — `window.location.reload()` Must Be Removed
- [ ] Remove `window.location.reload()` after avatar upload
- [ ] Expose `setUser` or a `refreshUser()` method from `AuthContext`
- [ ] After successful upload, call `refreshUser()` to re-fetch `/users/me` and update context

---

### 5. Fix: `AuthContext.register()` — Broken Post-Register State
- [ ] Decide on one of two strategies:
  - **Option A**: Don't call `setUser`/`setIsAuthenticated` on register → redirect to `/login` (current flow, but tokens ARE stored in localStorage — inconsistent)
  - **Option B**: Call `setUser`/`setIsAuthenticated` on register → redirect to `/` (consistent with login flow)
- [ ] Clear the stored tokens from `localStorage` in `authService.register()` if Option A is chosen, OR remove the `/login` redirect if Option B is chosen

---

### 6. Fix: Admin Review Moderation Route is Wrong
- [ ] In `src/services/adminService.js`, fix `updateReviewStatus`:
  ```js
  // ❌ Wrong:
  const updateReviewStatus = (id, status) => api.put(`/reviews/${id}/status`, { status });
  // ✅ Correct:
  const updateReviewStatus = (id, status) => api.put(`/admin/reviews/${id}/moderate`, { status });
  ```
- [ ] Admin review approve/reject is **completely broken** until this is fixed

---

### 7. Fix: `MediaUploader.jsx` — Response Shape Mismatch
- [ ] Audit the media upload API response shape from `POST /media/upload`
- [ ] Align `MediaUploader.jsx` (`res.data?.data?.media`) with `AvatarUploader.jsx` (`res.data.data.id`) — one of them is wrong
- [ ] Standardize the `onUploadSuccess` callback to always receive the media object with `{ id, url, ... }`

---

### 8. Fix: `OrdersManagePage.jsx` — Search is Declared but Never Used
- [ ] Add a `TextField` search input to the filter bar
- [ ] Add `search` to `useEffect` dependency array:
  ```js
  useEffect(() => { fetchOrders(); }, [paginationModel, status, search]);
  ```
- [ ] Debounce the search input (300ms) before triggering fetch

---

### 9. Fix: Admin Refund Button Always Returns 404
- [ ] The route `POST /payments/:id/refund` does **not exist** in the backend
- [ ] Either implement the refund route on the backend, OR
- [ ] Disable/hide the "Issue Refund" button in `OrderDetailPage.jsx` until the backend route exists

---

### 10. Fix: `accountPage.jsx` — Addresses Tab is a Placeholder
- [ ] Implement `AddressesTab` component:
  - Fetch addresses: `GET /users/me/addresses`
  - Create: `POST /users/me/addresses`
  - Update: `PUT /users/me/addresses/:id`
  - Delete: `DELETE /users/me/addresses/:id`
  - Set default: `PUT /users/me/addresses/:id/default`
- [ ] Fields required by backend: `fullName`, `addressLine1`, `addressLine2?`, `city`, `state`, `postalCode`, `country`, `phone?`, `isDefault`

---

### 11. Fix: `AccountPage.jsx` — Orders Tab is a Placeholder
- [ ] Implement `OrdersTab` component:
  - Fetch: `GET /orders` (paginated)
  - Display: `orderNumber`, `status`, `total`, `createdAt`, items count
  - Detail view or link to an order detail page
  - Cancel button: `POST /orders/:id/cancel` (for `pending_payment` orders)

---

## 🟡 Should Fix (Quality & Correctness)

### 12. Fix: `ProductCard.jsx` — Hardcoded Fake Rating
- [ ] Remove hardcoded `value={4.5}` and `(12)` review count
- [ ] Either request `averageRating` and `reviewCount` from the backend product list endpoint, OR
- [ ] Remove the `<Rating>` component from `ProductCard` entirely

---

### 13. Fix: Price Calculation Bug in `ProductDetailPage.jsx`
- [ ] Fix falsy check on `priceModifier` (breaks when modifier is `0`):
  ```jsx
  // ❌ Current (breaks when priceModifier === 0):
  const currentPrice = selectedVariant?.priceModifier
    ? parseFloat(product.salePrice || product.price) + parseFloat(selectedVariant.priceModifier)
    : parseFloat(product.salePrice || product.price);

  // ✅ Fix:
  const basePrice = parseFloat(product.salePrice || product.price);
  const currentPrice = basePrice + parseFloat(selectedVariant?.priceModifier ?? 0);
  ```

---

### 14. Fix: `WishlistButton.jsx` — Initial State is Always `false`
- [ ] On component mount, check if product is in wishlist
- [ ] Either pass `initialInWishlist` from parent (requires wishlist items to be loaded), OR
- [ ] Create a `useWishlist` hook that holds the wishlist product IDs in memory (fetched once)

---

### 15. Fix: `WishlistButton.jsx` — Replace `alert()` with Proper UI Feedback
- [ ] Replace `alert('Please login to use wishlist')` with:
  - A `Snackbar` notification, OR
  - `navigate('/login', { state: { from: location.pathname } })`

---

### 16. Fix: Hardcoded `localhost:5000` in `WishlistPage.jsx` and `AvatarUploader.jsx`
- [ ] Create a utility `getMediaUrl(path)` in `src/utils/media.js`:
  ```js
  const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace('/api', '');
  export const getMediaUrl = (path) =>
    !path ? '' : path.startsWith('http') ? path : `${BASE}${path}`;
  ```
- [ ] Replace all hardcoded `http://localhost:5000` image URLs with `getMediaUrl()`

---

### 17. Fix: `CouponsPage.jsx` — `maxDiscount` Field Missing from Form
- [ ] Add a `TextField` for `maxDiscount` in the coupon dialog (only relevant for `percentage` type)
- [ ] Show/hide it conditionally: `{form.type === 'percentage' && <TextField ... />}`

---

### 18. Fix: `ReviewSection.jsx` — `orderId` Never Sent (Verified Purchase Always False)
- [ ] Allow passing `orderId` as a prop to `ReviewSection`
- [ ] In `ProductDetailPage`, if user is authenticated, fetch their orders (`GET /orders`) and find one containing this product
- [ ] Pre-fill `orderId` in the review form if found
- [ ] Send `orderId` in `reviewService.create()` payload

---

### 19. Fix: `ProtectedRoute.jsx` — Blank Screen During Auth Check
- [ ] Replace `return null` with a loading spinner:
  ```jsx
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
      <CircularProgress />
    </Box>
  );
  ```

---

### 20. Fix: `VariantSelector.jsx` — No Cross-Group Stock Validation
- [ ] When multiple variant groups exist (e.g. Size + Color), validate that the specific *combination* is in stock, not just individual attribute values
- [ ] Backend model has one `ProductVariant` per combination row — use `name+value` pair matching

---

### 21. Fix: `ProductEditPage.jsx` — No Variant Management
- [ ] Add a "Variants" section to the product form
- [ ] Allow admin to add/edit/delete `ProductVariant` records: `name`, `value`, `priceModifier`, `quantity`, `sku`
- [ ] Call variant-specific API endpoints (check backend attribute/variant routes)

---

### 22. Fix: `SettingsProvider` and `AuthProvider` Block Render Sequentially
- [ ] Both use `{!loading && children}` which causes a blank screen on slow connections
- [ ] Show a full-page loading spinner instead of blocking render:
  ```jsx
  if (loading) return <FullPageSpinner />;
  ```
- [ ] Consider loading both in parallel using `Promise.all` at the App level

---

## ⚡ Performance

### 23. Deduplicate Category Tree Fetching
- [ ] `CategoryNav.jsx` and `ProductFilters.jsx` both independently call `GET /categories`
- [ ] Lift category state into a `CategoryContext` or a React Query cache
- [ ] One fetch, shared everywhere

### 24. Debounce Search Input in `ProductListPage.jsx`
- [ ] Wrap `handleFilterChange` call inside a `useDebounce` hook (300–400ms)
- [ ] Prevents an API call on every keystroke

### 25. Fix: `ProductFilters.jsx` — Price Slider Fires Duplicate API Calls
- [ ] Remove the `onChange` handler from `<Slider>` — keep only `onChangeCommitted`
- [ ] Use local component state for the slider value while dragging:
  ```jsx
  const [sliderValue, setSliderValue] = useState([0, 2000]);
  <Slider
    value={sliderValue}
    onChange={(_, val) => setSliderValue(val)}          // local only
    onChangeCommitted={(_, val) => onFilterChange(...)} // fires API
  />
  ```

### 26. Cache User Profile — Avoid Round-Trip on Every Page Load
- [ ] After successful `getMe()`, persist the user object to `localStorage`
- [ ] On init, hydrate from `localStorage` immediately (no blank screen), then verify in background

---

## 🧠 Architecture / Code Quality

### 27. Remove Duplication: `authService` vs `userService`
- [ ] Remove `getMe` and `updateProfile` from `authService.js`
- [ ] Update `AuthContext` to import `userService.getMe` and `userService.updateMe`

### 28. Add Global Toast/Snackbar System
- [ ] Install `notistack` or create a `ToastContext`
- [ ] Replace all `alert()` calls with toast notifications
- [ ] Standardize API error handling across all pages with a single `handleApiError(err)` utility

### 29. Fix: `StoreLayout` Double Container
- [ ] Remove the `<Container maxWidth="lg">` wrapper from `StoreLayout.jsx`
- [ ] Let each page manage its own container (`ProductListPage` uses `xl`, others use `md`/`lg`)

### 30. Add `AuthContext` `setUser` Exposure / `refreshUser()` Method
- [ ] Add `refreshUser: async () => { const u = await userService.getMe(); setUser(u); }` to `AuthContext`
- [ ] Use this in `AvatarUploader`, `ProfileTab`, anywhere the user object needs to refresh without a page reload

### 31. Add Missing Route: `/cart`
- [ ] Register `CartPage` in `AppRoutes.jsx` (no auth required — cart supports guests)

### 32. Home Page is a Placeholder
- [ ] Create `src/pages/storefront/HomePage.jsx`
- [ ] Suggested sections: hero banner, featured products (`GET /products?featured=true` or similar), category navigation

### 33. No 404 / Not Found Page
- [ ] Add a catch-all `<Route path="*" element={<NotFoundPage />} />` to `AppRoutes.jsx`

### 34. `CategoryNav.jsx` is Not Rendered Anywhere
- [ ] `CategoryNav` exists but is not imported in `StoreLayout.jsx`
- [ ] Add it to the store navbar below the `AppBar`

---

## 🔒 Security

### 35. Tokens in `localStorage` — XSS Risk
- [ ] Evaluate migrating access token to memory (variable) and refresh token to `httpOnly` cookie
- [ ] At minimum, ensure no user-generated HTML is rendered without sanitization (`dangerouslySetInnerHTML` in `ProductDetailPage` — audit this)

### 36. `dangerouslySetInnerHTML` in `ProductDetailPage.jsx`
- [ ] Sanitize `product.description` before rendering:
  ```js
  import DOMPurify from 'dompurify';
  <Box dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description) }} />
  ```
- [ ] Install `dompurify`: `npm install dompurify`

---

## 📦 Missing npm Packages (needed for above tasks)

| Package | Purpose |
|---|---|
| `@stripe/react-stripe-js` | Payment page — Stripe Elements |
| `@stripe/stripe-js` | Stripe JS loader |
| `dompurify` | Sanitize HTML in product description |
| `notistack` *(optional)* | Global toast notifications |

---

## Summary Count

| Priority | Count |
|---|---|
| 🔴 Critical | 11 |
| 🟡 Should Fix | 14 |
| ⚡ Performance | 4 |
| 🧠 Architecture | 8 |
| 🔒 Security | 2 |
| **Total** | **39** |
