# 🛠️ Fix Plan — eCommerce Application
## Actionable Implementation Guide (Based on Audit Report)

> **Generated:** April 3, 2026  
> **Based on:** [AUDIT-REPORT.md](./AUDIT-REPORT.md)  
> **Priority:** P1 = Critical Bug → P2 = Architecture → P3 = Security → P4 = Missing Feature → P5 = Improvement

---

## 📋 Fix Index

| # | Priority | Title | Files |
|---|---|---|---|
| F-01 | 🔴 P1 | Dead code: payment intent unreachable in `placeOrder` | `order.service.js` |
| F-02 | 🔴 P1 | `reservationTimeout.job` references non-existent model fields | `reservationTimeout.job.js` |
| F-03 | 🔴 P1 | Cart stock check uses product quantity, not variant quantity | `cart.service.js` |
| F-04 | 🔴 P1 | `useEffect` after conditional return in `VariantSelector.jsx` | `VariantSelector.jsx` |
| F-05 | 🔴 P1 | Public product list exposes draft products | `product.service.js` |
| F-06 | 🟠 P2 | Mount attribute routes in `app.js` | `app.js` |
| F-07 | 🟠 P2 | Add auth guards to all attribute routes | `attribute.routes.js`, `categoryAttribute.routes.js`, `productVariant.routes.js` |
| F-08 | 🟠 P2 | `sanitizeBody` middleware is a no-op | `sanitize.middleware.js` |
| F-09 | 🟠 P2 | Circular category parent chain not prevented | `category.service.js` |
| F-10 | 🟠 P2 | `deleteCategory` does not check for assigned products | `category.service.js` |
| F-11 | 🟠 P2 | Subcategory product inheritance in category filter | `product.service.js` |
| F-12 | 🟠 P2 | Migration: add missing DB indexes | New migration file |
| F-13 | 🟡 P3 | Add `avg_rating` + `review_count` to Product (cached) | `product.model.js`, `review.service.js`, migration |
| F-14 | 🟡 P3 | Add `attributeService.js` to frontend | New file: `client/src/services/attributeService.js` |
| F-15 | 🟡 P3 | Admin Attributes management page | New file: `client/src/pages/admin/AttributesPage.jsx` |
| F-16 | 🟡 P3 | Upgrade `ProductEditPage` variant panel to use attribute picker | `ProductEditPage.jsx` |
| F-17 | 🟡 P3 | Add `variantId` FK to `order_items` | New migration file |
| F-18 | 🟡 P3 | Allow order cancellation for `processing` status | `order.service.js` |
| F-19 | 🟢 P4 | Add `/admin/attributes` route to frontend router | `AppRoutes.jsx`, `AdminLayout.jsx` |

---

## F-01 🔴 Dead Code: Payment Intent Unreachable in `placeOrder`

**File:** `server/src/modules/order/order.service.js`

**Problem:** `placeOrder` returns inside the `sequelize.transaction()` call. The `PaymentService.createIntent` call and `clientSecret` logic below it are dead code — they never execute. Every order is created but the payment intent is never initialized, so the frontend receives no `clientSecret` and cannot open Stripe.

**Fix:**

```javascript
// BEFORE (in order.service.js — placeOrder function, around line 47)
return sequelize.transaction(async (t) => {
    // ... all the order creation logic ...
    await cart.update({ status: 'converted' }, { transaction: t });
    return order;   // ← function exits here inside the transaction
});

// Dead code below is never reached:
let clientSecret = null;
try {
    const intent = await PaymentService.createIntent(order.userId, order.id);
    clientSecret = intent.clientSecret;
} catch (err) {
    clientSecret = null;
}
return { order, clientSecret };
```

```javascript
// AFTER — await the transaction, THEN create the payment intent outside it
const order = await sequelize.transaction(async (t) => {
    // ... all the order creation logic (unchanged) ...
    await cart.update({ status: 'converted' }, { transaction: t });
    return order;
});

// Payment intent runs OUTSIDE the transaction so a Stripe failure
// does not roll back the order — frontend can retry payment independently
let clientSecret = null;
try {
    const intent = await PaymentService.createIntent(order.userId, order.id);
    clientSecret = intent.clientSecret;
} catch (err) {
    // Log but don't fail — order exists, payment can be retried
    clientSecret = null;
}

return { order, clientSecret };
```

**Also update the controller** to forward `clientSecret` in the response:

```javascript
// server/src/modules/order/order.controller.js  — placeOrder handler
const result = await orderService.placeOrder(req.user.id, req.body);
return success(res, { order: result.order, clientSecret: result.clientSecret }, 'Order placed', 201);
```

---

## F-02 🔴 `reservationTimeout.job` References Non-Existent Fields

**File:** `server/src/jobs/reservationTimeout.job.js`

**Problems:**
1. `order.cartId` — `Order` model has no `cartId` column.
2. `item.variantId` — `OrderItem` model has no `variantId` column (only `variantInfo` JSONB).
3. `AuditLog.create` uses wrong field names (`adminId`, `entityType`) — the real model uses `userId`, `entity`.
4. `created_at` in the `where` clause — Sequelize underscored mode maps `createdAt`, not `created_at` in queries.
5. Inventory is released only for variants — base product `reservedQty` is never released.

**Complete replacement:**

```javascript
'use strict';

const cron = require('node-cron');
const { Op } = require('sequelize');
const { Order, OrderItem, Product, sequelize } = require('../modules');
const AuditService = require('../modules/audit/audit.service');
const logger = require('../utils/logger');

const run = () => {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Running reservationTimeout job...');
    const transaction = await sequelize.transaction();
    try {
      const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000);

      const expiredOrders = await Order.findAll({
        where: {
          status: 'pending_payment',
          createdAt: { [Op.lt]: fifteenMinsAgo },
        },
        include: [{ model: OrderItem, as: 'items' }],
        transaction,
      });

      for (const order of expiredOrders) {
        // Release product-level reserved inventory for each order item
        for (const item of order.items) {
          if (item.productId && item.quantity > 0) {
            await Product.update(
              { reservedQty: sequelize.literal(`reserved_qty - ${item.quantity}`) },
              { where: { id: item.productId }, transaction }
            );
          }
        }

        await order.update({ status: 'cancelled' }, { transaction });

        try {
          await AuditService.log({
            userId: null,
            action: 'ORDER_TIMEOUT',
            entity: 'Order',
            entityId: order.id,
            changes: { message: 'Order expired — inventory released automatically' },
          }, transaction);
        } catch (_) { /* audit failure must not block the job */ }
      }

      await transaction.commit();

      if (expiredOrders.length > 0) {
        logger.info(`Released inventory for ${expiredOrders.length} expired orders.`);
      }
    } catch (error) {
      await transaction.rollback();
      logger.error('Error in reservationTimeout job:', error);
    }
  });
};

module.exports = { run };
```

---

## F-03 🔴 Cart Stock Check Uses Product Quantity, Not Variant Quantity

**File:** `server/src/modules/cart/cart.service.js`

**Problem:** When a `variantId` is provided, the stock check still uses `product.quantity - product.reservedQty`. Each variant has its own `quantity` field which is completely ignored.

**Fix — replace the `addItem` function's stock check block:**

```javascript
// BEFORE
const product = await Product.findByPk(productId, { transaction: t });
if (!product) {
    throw new AppError('NOT_FOUND', 404, 'Product not found or unavailable');
}

const availableStock = product.quantity - (product.reservedQty || 0);
```

```javascript
// AFTER
const product = await Product.findByPk(productId, { transaction: t });
if (!product) {
    throw new AppError('NOT_FOUND', 404, 'Product not found or unavailable');
}

let availableStock;
if (variantId) {
    const variant = await ProductVariant.findOne({
        where: { id: variantId, productId },
        transaction: t,
    });
    if (!variant) {
        throw new AppError('NOT_FOUND', 404, 'Variant not found');
    }
    availableStock = variant.quantity - 0; // variants don't have reservedQty yet — see F-12
} else {
    availableStock = product.quantity - (product.reservedQty || 0);
}
```

> **Note:** Once migration F-12 adds `reserved_qty` to `product_variants`, update the variant line to:
> `availableStock = variant.quantity - (variant.reservedQty || 0);`

---

## F-04 🔴 `useEffect` After Conditional Return in `VariantSelector.jsx`

**File:** `client/src/components/product/VariantSelector.jsx`

**Problem:** A `useEffect` is called after an early `return null` statement. This violates React's Rules of Hooks — hooks must be called unconditionally at the top level.

**Fix — move the early return AFTER the `useEffect`:**

```jsx
// BEFORE
const VariantSelector = ({ variants, selectedVariantId, onSelect }) => {
    const [selections, setSelections] = useState({});

    if (!variants || variants.length === 0) return null;   // ← early return BEFORE useEffect

    const grouped = variants.reduce(...)
    const groupNames = Object.keys(grouped);
    const isMultiGroup = groupNames.length > 1;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {                                       // ← hook AFTER conditional return ❌
        ...
    }, [selectedVariantId, variants]);
```

```jsx
// AFTER
const VariantSelector = ({ variants, selectedVariantId, onSelect }) => {
    const [selections, setSelections] = useState({});

    // useEffect must come BEFORE any conditional return
    useEffect(() => {
        if (selectedVariantId && variants) {
            const v = variants.find(v => v.id === selectedVariantId);
            if (v) {
                setSelections(prev => {
                    if (prev[v.name] === v.id) return prev;
                    return { ...prev, [v.name]: v.id };
                });
            }
        }
    }, [selectedVariantId, variants]);

    if (!variants || variants.length === 0) return null;   // ← early return AFTER hooks ✅

    const grouped = variants.reduce(...)
    // ... rest unchanged
```

---

## F-05 🔴 Public Product List Exposes Draft Products

**File:** `server/src/modules/product/product.service.js`

**Problem:** `getProducts` only applies a status filter when `filters.status` is explicitly provided. The public `GET /api/products` route never provides a status, so draft products are visible to all users.

**Fix — enforce `published` status by default for non-admin calls:**

```javascript
// In product.controller.js — list handler, pass isAdmin flag:
exports.list = async (req, res, next) => {
    try {
        const isAdmin = req.user && ['admin', 'super_admin'].includes(req.user.role);
        const { page = 1, limit = 20, ...filters } = req.query;
        const result = await productService.getProducts(filters, page, limit, isAdmin);
        return success(res, result);
    } catch (err) {
        next(err);
    }
};
```

```javascript
// In product.service.js — getProducts, add isAdmin parameter:
exports.getProducts = async (filters, page, limit, isAdmin = false) => {
    const { limit: queryLimit, offset } = getPagination(page, limit);
    const where = {};

    // Default to published for storefront; admin can see all or filter by status
    if (!isAdmin) {
        where.status = 'published';
    } else if (filters.status) {
        where.status = filters.status;
    }

    // ... rest of function unchanged
```

---

## F-06 🟠 Mount Attribute Routes in `app.js`

**File:** `server/src/app.js`

**Problem:** The three attribute route files exist but are never registered in the Express app. All attribute system endpoints are unreachable.

**Fix — add to the route registration section:**

```javascript
// Add these requires alongside the other route requires:
const attributeRoutes = require('./modules/attribute/attribute.routes');
const categoryAttributeRoutes = require('./modules/attribute/categoryAttribute.routes');
const productVariantRoutes = require('./modules/attribute/productVariant.routes');

// Add these app.use calls after the existing ones:
app.use('/api/attributes', attributeRoutes);
app.use('/api/categories', categoryAttributeRoutes);  // mounts /:id/attributes sub-routes
app.use('/api/products', productVariantRoutes);        // mounts /:id/variants/bulk-generate and /clone
```

> ⚠️ **Must complete F-07 (add auth guards) BEFORE or simultaneously with mounting these routes.**
> Mounting unprotected admin mutation routes to production is a security risk.

---

## F-07 🟠 Add Auth Guards to All Attribute Routes

**Files:**
- `server/src/modules/attribute/attribute.routes.js`
- `server/src/modules/attribute/categoryAttribute.routes.js`
- `server/src/modules/attribute/productVariant.routes.js`

**Problem:** All three files have comments saying auth middleware should be added "when ready". These are admin-only mutation endpoints that are currently wide open.

### `attribute.routes.js`

```javascript
// AFTER — replace the entire file:
'use strict';

const express = require('express');
const router = express.Router();
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const {
    createAttributeSchema,
    updateAttributeSchema,
    addValueSchema,
} = require('./attribute.validation');

const adminOnly = [authenticate, authorize('admin', 'super_admin')];

// Public read
router.get('/', controller.getAllAttributes);
router.get('/:id', controller.getAttributeById);

// Admin mutations
router.post('/', ...adminOnly, validate(createAttributeSchema), controller.createAttribute);
router.put('/:id', ...adminOnly, validate(updateAttributeSchema), controller.updateAttribute);
router.delete('/:id', ...adminOnly, controller.deleteAttribute);

// Attribute Values — admin only
router.post('/:id/values', ...adminOnly, validate(addValueSchema), controller.addValue);
router.delete('/:attrId/values/:valueId', ...adminOnly, controller.removeValue);

module.exports = router;
```

### `categoryAttribute.routes.js`

```javascript
'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const { linkAttributeSchema } = require('./attribute.validation');

const adminOnly = [authenticate, authorize('admin', 'super_admin')];

// Public read (used by frontend attribute picker when creating products)
router.get('/:id/attributes', controller.getCategoryAttributes);

// Admin mutations
router.post('/:id/attributes', ...adminOnly, validate(linkAttributeSchema), controller.linkAttributeToCategory);
router.delete('/:id/attributes/:attrId', ...adminOnly, controller.unlinkAttributeFromCategory);

module.exports = router;
```

### `productVariant.routes.js`

```javascript
'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const controller = require('./attribute.controller');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const { bulkGenerateSchema, cloneVariantsSchema } = require('./attribute.validation');

const adminOnly = [authenticate, authorize('admin', 'super_admin')];

router.post('/:id/variants/bulk-generate', ...adminOnly, validate(bulkGenerateSchema), controller.bulkGenerateVariants);
router.post('/:id/variants/clone', ...adminOnly, validate(cloneVariantsSchema), controller.cloneVariants);

module.exports = router;
```

---

## F-08 🟠 `sanitizeBody` Middleware Is a No-Op

**File:** `server/src/middleware/sanitize.middleware.js`

**Problem:** `sanitizeBody()` returns a middleware that does nothing (`next()` immediately). It gives false confidence that string fields are being stripped.

**Fix — implement recursive body sanitization:**

```javascript
'use strict';

const sanitizeHtml = require('sanitize-html');

const sanitizeRichText = (html) => {
  if (!html) return html;
  return sanitizeHtml(html, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'img'],
    allowedAttributes: { 'a': ['href'], 'img': ['src', 'alt'] }
  });
};

const sanitizePlainText = (text) => {
  if (!text) return text;
  return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });
};

/**
 * Recursively strips all HTML tags from string values in an object.
 * Arrays and nested objects are traversed.
 */
const deepSanitize = (obj) => {
  if (typeof obj === 'string') return sanitizePlainText(obj);
  if (Array.isArray(obj)) return obj.map(deepSanitize);
  if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const key of Object.keys(obj)) {
      result[key] = deepSanitize(obj[key]);
    }
    return result;
  }
  return obj;
};

/**
 * Express middleware that sanitizes req.body string fields.
 * Use on routes that don't expect HTML (most non-product endpoints).
 */
const sanitizeBody = () => {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = deepSanitize(req.body);
    }
    next();
  };
};

module.exports = {
  sanitizeRichText,
  sanitizePlainText,
  sanitizeBody,
};
```

---

## F-09 🟠 Circular Category Parent Chain Not Prevented

**File:** `server/src/modules/category/category.service.js`

**Problem:** `updateCategory` only checks `data.parentId === id` (direct self-loop). A chain like `A → B → C → A` passes undetected, creating infinite loops in `buildTree`.

**Fix — add a cycle detection helper before the update:**

```javascript
// Add this helper function at the top of category.service.js:
const wouldCreateCycle = async (categoryId, newParentId) => {
    let current = newParentId;
    const visited = new Set();
    while (current) {
        if (visited.has(current)) break; // already-existing cycle safety
        if (current === categoryId) return true; // cycle detected
        visited.add(current);
        const parent = await Category.findByPk(current, { attributes: ['id', 'parentId'] });
        if (!parent) break;
        current = parent.parentId;
    }
    return false;
};

// In updateCategory, replace the direct self-reference check:
// BEFORE
if (data.parentId === id) {
    throw new AppError('VALIDATION_ERROR', 400, 'Category cannot be its own parent');
}

// AFTER
if (data.parentId) {
    if (data.parentId === id || await wouldCreateCycle(id, data.parentId)) {
        throw new AppError('VALIDATION_ERROR', 400, 'Setting this parent would create a circular reference');
    }
}
```

---

## F-10 🟠 `deleteCategory` Does Not Check for Assigned Products

**File:** `server/src/modules/category/category.service.js`

**Problem:** A category with products assigned to it can be deleted, leaving those products orphaned in the junction table or silently unlinked.

**Fix — add a product count check:**

```javascript
// In deleteCategory, add after the children check:
exports.deleteCategory = async (id) => {
    const category = await Category.findByPk(id);
    if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');

    const childrenCount = await Category.count({ where: { parentId: id } });
    if (childrenCount > 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Cannot delete category with subcategories');
    }

    // NEW: check for assigned products
    const productCount = await category.countProducts();
    if (productCount > 0) {
        throw new AppError('VALIDATION_ERROR', 400, `Cannot delete category: ${productCount} product(s) are assigned to it. Reassign them first.`);
    }

    await category.destroy();
    return true;
};
```

> **Requires** the `Category.belongsToMany(Product)` association to be set up in the model (it already is via `ProductCategory`).

---

## F-11 🟠 Subcategory Product Inheritance in Category Filter

**File:** `server/src/modules/product/product.service.js`

**Problem:** When filtering by category slug, only products directly assigned to that exact category are returned. Products assigned to child categories are invisible.

**Fix — collect the full subtree of category IDs before the query:**

```javascript
// Add this helper to the top of product.service.js (after requires):
const { Category } = require('../index'); // already imported, shown for clarity

/**
 * Returns an array of IDs: the given categoryId plus all descendant IDs.
 */
const getCategoryAndDescendantIds = async (slug) => {
    const root = await Category.findOne({ where: { slug }, attributes: ['id'] });
    if (!root) return [];

    const allCategories = await Category.findAll({ attributes: ['id', 'parentId'] });
    const idMap = {};
    for (const c of allCategories) {
        if (!idMap[c.parentId]) idMap[c.parentId] = [];
        idMap[c.parentId].push(c.id);
    }

    const result = [];
    const queue = [root.id];
    while (queue.length) {
        const current = queue.shift();
        result.push(current);
        if (idMap[current]) queue.push(...idMap[current]);
    }
    return result;
};

// In getProducts — replace the category include block:
// BEFORE
if (filters.category) {
    include.push({
        model: Category,
        as: 'categories',
        where: { slug: filters.category },
        required: true
    });
}

// AFTER
if (filters.category) {
    const categoryIds = await getCategoryAndDescendantIds(filters.category);
    if (categoryIds.length === 0) {
        // Unknown category — return empty result
        return getPagingData([], 0, page, queryLimit);
    }
    include.push({
        model: Category,
        as: 'categories',
        where: { id: categoryIds },
        required: true
    });
}
```

---

## F-12 🟠 Migration: Add Missing DB Indexes

**New file:** `server/migrations/20260403100001-add-missing-indexes.js`

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // products.status — every public listing filters on this
    await queryInterface.addIndex('products', ['status'], {
      name: 'products_status_idx',
    });

    // products.is_featured
    await queryInterface.addIndex('products', ['is_featured'], {
      name: 'products_is_featured_idx',
    });

    // cart_items composite lookup
    await queryInterface.addIndex('cart_items', ['cart_id', 'product_id', 'variant_id'], {
      name: 'cart_items_cart_product_variant_idx',
    });

    // orders: user + status combination
    await queryInterface.addIndex('orders', ['user_id', 'status'], {
      name: 'orders_user_status_idx',
    });

    // attribute_values: every attribute join hits this
    await queryInterface.addIndex('attribute_values', ['attribute_id'], {
      name: 'attribute_values_attribute_id_idx',
    });

    // reviews: product + status (public list filters both)
    await queryInterface.addIndex('reviews', ['product_id', 'status'], {
      name: 'reviews_product_status_idx',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('products', 'products_status_idx');
    await queryInterface.removeIndex('products', 'products_is_featured_idx');
    await queryInterface.removeIndex('cart_items', 'cart_items_cart_product_variant_idx');
    await queryInterface.removeIndex('orders', 'orders_user_status_idx');
    await queryInterface.removeIndex('attribute_values', 'attribute_values_attribute_id_idx');
    await queryInterface.removeIndex('reviews', 'reviews_product_status_idx');
  },
};
```

---

## F-13 🟡 Add `avg_rating` + `review_count` to Product

### Step 1 — Migration

**New file:** `server/migrations/20260403100002-add-rating-cache-to-products.js`

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'avg_rating', {
      type: Sequelize.FLOAT,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn('products', 'review_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('products', 'avg_rating');
    await queryInterface.removeColumn('products', 'review_count');
  },
};
```

### Step 2 — Update Product Model

Add to `server/src/modules/product/product.model.js` inside the field definitions:

```javascript
avgRating: {
    type: DataTypes.FLOAT,
    allowNull: true,
},
reviewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
},
```

### Step 3 — Update Review Service to Refresh Cache

Add a helper and call it after `create` and `moderate` in `server/src/modules/review/review.service.js`:

```javascript
// Add this helper:
const refreshProductRatingCache = async (productId, transaction) => {
  const result = await Review.findOne({
    where: { productId, status: 'approved' },
    attributes: [
      [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'reviewCount'],
    ],
    raw: true,
    transaction,
  });
  await Product.update({
    avgRating: result.avgRating ? parseFloat(Number(result.avgRating).toFixed(2)) : null,
    reviewCount: parseInt(result.reviewCount, 10) || 0,
  }, { where: { id: productId }, transaction });
};

// Call it at the end of the create transaction:
// await refreshProductRatingCache(productId, t);

// Call it at the end of the moderate transaction:
// await refreshProductRatingCache(review.productId, t);
```

---

## F-14 🟡 Add `attributeService.js` to Frontend

**New file:** `client/src/services/attributeService.js`

```javascript
import api from './api';

// --- Attribute Templates ---
export const getAllAttributes = () =>
    api.get('/attributes');

export const getAttributeById = (id) =>
    api.get(`/attributes/${id}`);

export const createAttribute = (data) =>
    api.post('/attributes', data);

export const updateAttribute = (id, data) =>
    api.put(`/attributes/${id}`, data);

export const deleteAttribute = (id) =>
    api.delete(`/attributes/${id}`);

// --- Attribute Values ---
export const addAttributeValue = (attributeId, data) =>
    api.post(`/attributes/${attributeId}/values`, data);

export const removeAttributeValue = (attributeId, valueId) =>
    api.delete(`/attributes/${attributeId}/values/${valueId}`);

// --- Category-Attribute Linking ---
export const getCategoryAttributes = (categoryId, inherit = false) =>
    api.get(`/categories/${categoryId}/attributes`, { params: { inherit } });

export const linkAttributeToCategory = (categoryId, attributeId) =>
    api.post(`/categories/${categoryId}/attributes`, { attributeId });

export const unlinkAttributeFromCategory = (categoryId, attributeId) =>
    api.delete(`/categories/${categoryId}/attributes/${attributeId}`);

// --- Bulk Variant Generation ---
export const bulkGenerateVariants = (productId, attributes) =>
    api.post(`/products/${productId}/variants/bulk-generate`, { attributes });

export const cloneVariants = (targetProductId, sourceProductId) =>
    api.post(`/products/${targetProductId}/variants/clone`, { sourceProductId });
```

---

## F-15 🟡 Admin Attributes Management Page

**New file:** `client/src/pages/admin/AttributesPage.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, TextField, Paper, List, ListItem,
    ListItemText, ListItemSecondaryAction, IconButton, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions, Alert, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
    getAllAttributes, createAttribute, updateAttribute,
    deleteAttribute, addAttributeValue, removeAttributeValue,
} from '../../services/attributeService';

const AttributesPage = () => {
    const [attributes, setAttributes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Create/Edit attribute dialog
    const [attrDialog, setAttrDialog] = useState({ open: false, editing: null, name: '', sortOrder: 0 });

    // Add value dialog
    const [valueDialog, setValueDialog] = useState({ open: false, attributeId: null, attributeName: '', value: '' });

    const load = async () => {
        setLoading(true);
        try {
            const res = await getAllAttributes();
            setAttributes(res.data?.data || []);
        } catch (e) {
            setError('Failed to load attributes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const handleSaveAttribute = async () => {
        try {
            if (attrDialog.editing) {
                await updateAttribute(attrDialog.editing, { name: attrDialog.name, sortOrder: attrDialog.sortOrder });
            } else {
                await createAttribute({ name: attrDialog.name, sortOrder: attrDialog.sortOrder });
            }
            setAttrDialog({ open: false, editing: null, name: '', sortOrder: 0 });
            load();
        } catch (e) {
            setError(e.response?.data?.error?.message || 'Failed to save attribute');
        }
    };

    const handleDeleteAttribute = async (id) => {
        if (!window.confirm('Delete this attribute and all its values?')) return;
        try {
            await deleteAttribute(id);
            load();
        } catch (e) {
            setError(e.response?.data?.error?.message || 'Failed to delete');
        }
    };

    const handleAddValue = async () => {
        try {
            await addAttributeValue(valueDialog.attributeId, { value: valueDialog.value });
            setValueDialog({ open: false, attributeId: null, attributeName: '', value: '' });
            load();
        } catch (e) {
            setError(e.response?.data?.error?.message || 'Failed to add value');
        }
    };

    const handleRemoveValue = async (attributeId, valueId) => {
        if (!window.confirm('Remove this value?')) return;
        try {
            await removeAttributeValue(attributeId, valueId);
            load();
        } catch (e) {
            setError(e.response?.data?.error?.message || 'Failed to remove value');
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h4">Attribute Templates</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setAttrDialog({ open: true, editing: null, name: '', sortOrder: 0 })}
                >
                    New Attribute
                </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

            {loading ? (
                <Typography>Loading...</Typography>
            ) : (
                attributes.map(attr => (
                    <Paper key={attr.id} sx={{ mb: 3, p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="h6">{attr.name}</Typography>
                            <Box>
                                <IconButton
                                    size="small"
                                    onClick={() => setAttrDialog({ open: true, editing: attr.id, name: attr.name, sortOrder: attr.sortOrder })}
                                >
                                    <EditIcon fontSize="small" />
                                </IconButton>
                                <IconButton size="small" color="error" onClick={() => handleDeleteAttribute(attr.id)}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                            {(attr.values || []).map(val => (
                                <Chip
                                    key={val.id}
                                    label={val.value}
                                    size="small"
                                    onDelete={() => handleRemoveValue(attr.id, val.id)}
                                />
                            ))}
                        </Box>

                        <Button
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => setValueDialog({ open: true, attributeId: attr.id, attributeName: attr.name, value: '' })}
                        >
                            Add Value
                        </Button>
                    </Paper>
                ))
            )}

            {/* Create/Edit Attribute Dialog */}
            <Dialog open={attrDialog.open} onClose={() => setAttrDialog({ ...attrDialog, open: false })} maxWidth="xs" fullWidth>
                <DialogTitle>{attrDialog.editing ? 'Edit Attribute' : 'New Attribute'}</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth autoFocus margin="normal" label="Attribute Name"
                        placeholder="e.g. Size, Color, Weight"
                        value={attrDialog.name}
                        onChange={e => setAttrDialog({ ...attrDialog, name: e.target.value })}
                    />
                    <TextField
                        fullWidth margin="normal" label="Sort Order" type="number"
                        value={attrDialog.sortOrder}
                        onChange={e => setAttrDialog({ ...attrDialog, sortOrder: parseInt(e.target.value) || 0 })}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAttrDialog({ ...attrDialog, open: false })}>Cancel</Button>
                    <Button variant="contained" onClick={handleSaveAttribute} disabled={!attrDialog.name.trim()}>Save</Button>
                </DialogActions>
            </Dialog>

            {/* Add Value Dialog */}
            <Dialog open={valueDialog.open} onClose={() => setValueDialog({ ...valueDialog, open: false })} maxWidth="xs" fullWidth>
                <DialogTitle>Add Value to "{valueDialog.attributeName}"</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth autoFocus margin="normal" label="Value"
                        placeholder="e.g. Red, Large, 500g"
                        value={valueDialog.value}
                        onChange={e => setValueDialog({ ...valueDialog, value: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddValue(); }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setValueDialog({ ...valueDialog, open: false })}>Cancel</Button>
                    <Button variant="contained" onClick={handleAddValue} disabled={!valueDialog.value.trim()}>Add</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AttributesPage;
```

---

## F-16 🟡 Add `variantId` FK to `order_items`

**New file:** `server/migrations/20260403100003-add-variant-id-to-order-items.js`

```javascript
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('order_items', 'variant_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'product_variants', key: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('order_items', ['variant_id'], {
      name: 'order_items_variant_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('order_items', 'order_items_variant_id_idx');
    await queryInterface.removeColumn('order_items', 'variant_id');
  },
};
```

**Update `orderItem.model.js`** to add the field:

```javascript
variantId: {
    type: DataTypes.UUID,
    allowNull: true,
},
```

**Update `OrderItem.associate`:**

```javascript
OrderItem.associate = (models) => {
    OrderItem.belongsTo(models.Order, { foreignKey: 'orderId', onDelete: 'CASCADE' });
    OrderItem.belongsTo(models.Product, { foreignKey: 'productId', as: 'product' });
    OrderItem.belongsTo(models.ProductVariant, { foreignKey: 'variantId', as: 'variant' }); // NEW
};
```

**Update `placeOrder` in `order.service.js`** to populate `variantId` when creating order items:

```javascript
await OrderItem.create({
    orderId: order.id,
    productId: item.productId,
    variantId: item.variantId || null,   // NEW
    snapshotName: item.currentProduct.name,
    // ... rest unchanged
}, { transaction: t });
```

---

## F-17 🟡 Allow Order Cancellation for `processing` Status

**File:** `server/src/modules/order/order.service.js`

**Problem:** `cancelOrder` throws if `order.status !== 'pending_payment'`. In real scenarios, an admin might also need to cancel `processing` orders.

**Fix:**

```javascript
// BEFORE
if (order.status !== 'pending_payment') {
    throw new AppError('VALIDATION_ERROR', 400, 'Only pending orders can be cancelled');
}

// AFTER
const cancellableStatuses = ['pending_payment', 'processing'];
if (!cancellableStatuses.includes(order.status)) {
    throw new AppError('VALIDATION_ERROR', 400, `Orders with status "${order.status}" cannot be cancelled`);
}
```

---

## F-18 🟡 Add Pagination to `getAllAttributes`

**File:** `server/src/modules/attribute/attribute.service.js`

```javascript
// BEFORE
const getAllAttributes = async () => {
    return AttributeTemplate.findAll({
        include: [{ model: AttributeValue, as: 'values', ... }],
        order: [['sortOrder', 'ASC'], ...],
    });
};

// AFTER
const getAllAttributes = async (page = 1, limit = 50) => {
    const { getPagination, getPagingData } = require('../../utils/pagination');
    const { limit: lmt, offset } = getPagination(page, limit);

    const { rows, count } = await AttributeTemplate.findAndCountAll({
        include: [{ model: AttributeValue, as: 'values', attributes: ['id', 'value', 'slug', 'sortOrder'] }],
        order: [['sortOrder', 'ASC'], [{ model: AttributeValue, as: 'values' }, 'sortOrder', 'ASC']],
        limit: lmt,
        offset,
        distinct: true,
    });

    return getPagingData(rows, count, page, lmt);
};
```

**Update the controller** to pass query params:

```javascript
exports.getAllAttributes = async (req, res, next) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const result = await attributeService.getAllAttributes(page, limit);
        return success(res, result, 'Attributes retrieved');
    } catch (err) {
        next(err);
    }
};
```

---

## F-19 🟡 Register Attributes Page in Frontend Router and Admin Nav

### `client/src/routes/AppRoutes.jsx`

Add to the admin routes section:

```jsx
import AttributesPage from '../pages/admin/AttributesPage';

// Inside the admin <Route> block:
<Route path="attributes" element={<AttributesPage />} />
```

### `client/src/layouts/AdminLayout.jsx`

Add to the admin sidebar navigation array (wherever Categories or Products nav items exist):

```jsx
{ label: 'Attributes', path: '/admin/attributes', icon: <TuneIcon /> }
```

> Import `TuneIcon` from `@mui/icons-material/Tune`.

---

## 🚀 Implementation Order

Execute fixes in this exact order to avoid breaking dependencies:

```
Phase 1 — Critical Bugs (no schema changes needed, deploy immediately)
  ✅ F-04  VariantSelector Rules of Hooks
  ✅ F-01  Dead code in placeOrder
  ✅ F-02  reservationTimeout job
  ✅ F-03  Cart stock check
  ✅ F-05  Public product list drafts

Phase 2 — Security (before mounting attribute routes)
  ✅ F-07  Auth guards on attribute routes
  ✅ F-06  Mount attribute routes in app.js  ← MUST be after F-07
  ✅ F-08  sanitizeBody implementation

Phase 3 — DB Migrations (run in order)
  ✅ F-12  20260403100001-add-missing-indexes.js
  ✅ F-13  20260403100002-add-rating-cache-to-products.js
  ✅ F-16  20260403100003-add-variant-id-to-order-items.js

Phase 4 — Service & Model Updates (after migrations)
  ✅ F-09  Circular category prevention
  ✅ F-10  Delete category product check
  ✅ F-11  Subcategory product inheritance
  ✅ F-13  Review service rating cache update
  ✅ F-16  orderItem model + placeOrder update
  ✅ F-17  Order cancel statuses
  ✅ F-18  Attribute pagination

Phase 5 — Frontend (can run in parallel with Phase 3/4)
  ✅ F-14  attributeService.js
  ✅ F-15  AttributesPage.jsx
  ✅ F-19  Router + nav link
```

---

## ✅ Post-Fix Checklist

| Area | Validation |
|---|---|
| `placeOrder` | Confirm `clientSecret` is returned in response and Stripe modal opens |
| `reservationTimeout` | Verify via logs that expired orders' `reservedQty` is decremented |
| Cart stock | Add a variant with qty=2, try to add 3 — expect 409 |
| VariantSelector | No React console warnings about hooks order |
| Public product list | `GET /api/products` — confirm no `draft` products returned |
| Attribute routes | `POST /api/attributes` without JWT → expect 401 |
| Attribute routes accessible | `GET /api/attributes` → expect 200 |
| Category subcategory filter | Browse parent "Vegetables" — child-assigned products should appear |
| Category circular guard | Try `PATCH /api/categories/:A` with `parentId = :C` where C's parent is A → expect 400 |
| Delete category with products | Attempt to delete a category with products → expect 400 |
| `avg_rating` | Post a review, approve it → product `avgRating` updates |
| Admin attributes page | Navigate to `/admin/attributes` — create attribute, add values |
| Order cancellation | Confirm `processing` orders can be cancelled |
