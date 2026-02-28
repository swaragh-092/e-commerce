---
description: How to build Phase 4 — Customer Account, Wishlist, and Reviews
---

# Phase 4 — User Features (Account, Wishlist, Reviews)

// turbo-all

## Prerequisites
Phase 3 must be complete (full shopping flow working).

## Step 1: Build Customer Account (User module update)

Extend the existing `user` module:
- Add `user_profiles` model (phone, avatar, dateOfBirth, gender)
- GET /api/users/me with profile data
- PUT /api/users/me to update profile
- PUT /api/users/me/password to change password
- GET /api/users (admin) — paginated customer list
- GET /api/users/:id (admin) — customer detail + order history

## Step 2: Build Wishlist module (Feature-Toggleable)

Follow `/new-module` workflow for `wishlist`:
- Models: `wishlists`, `wishlist_items`
- UNIQUE constraint on (wishlist_id, product_id)
- Feature gate: check `features.wishlist` setting
- Move-to-cart endpoint: POST /api/wishlist/items/:productId/to-cart
- Apply `featureGate('wishlist')` middleware on all routes

## Step 3: Build Reviews module (Feature-Toggleable)

Follow `/new-module` workflow for `review`:
- Model: `reviews` with CHECK (rating >= 1 AND rating <= 5)
- UNIQUE constraint: one review per user per product
- isVerifiedPurchase: auto-check if user has a 'delivered' order with this product
- Status: 'pending' by default (admin moderation)
- Sanitize title and body (plain text, no HTML)
- Rate limit: 5 reviews/day per user
- Feature gate: check `features.reviews` setting
- Optional: check `features.requirePurchaseForReview`

## Step 4: Frontend — Account pages

Create:
- `pages/storefront/AccountPage.jsx` — Profile edit, addresses
- `pages/storefront/OrderHistoryPage.jsx` — Order list + detail
- Wishlist page (if feature enabled)
- Review submission on ProductDetailPage (if feature enabled)

## Step 5: Test Phase 4

1. Update profile + change password
2. Add/remove wishlist items, move to cart
3. Submit review (check isVerifiedPurchase auto-set)
4. Try duplicate review → rejected (409)
5. Admin: moderate reviews (approve/reject)
6. Disable wishlist feature → routes return 404
7. Disable reviews feature → routes return 404
