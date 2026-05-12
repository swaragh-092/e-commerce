'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true }); // inherit :id from /api/products/:id/...
const productComboController = require('./productCombo.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema } = require('../../utils/common.validation');
const { syncComboItemsSchema } = require('./productCombo.validation');

// GET  /api/products/:id/combo-items/stock          — virtual stock (read-only, admin)
router.get(
    '/:id/combo-items/stock',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_READ),
    validate(idParamSchema, 'params'),
    productComboController.getVirtualStock
);

// GET  /api/products/:id/combo-items/suggested-price — admin utility
router.get(
    '/:id/combo-items/suggested-price',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_READ),
    validate(idParamSchema, 'params'),
    productComboController.getSuggestedPrice
);

// GET  /api/products/:id/combo-items                — list combo items (public-safe for storefront)
router.get(
    '/:id/combo-items',
    validate(idParamSchema, 'params'),
    productComboController.getComboItems
);

// PUT  /api/products/:id/combo-items                — full sync (admin only)
router.put(
    '/:id/combo-items',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE),
    validate(idParamSchema, 'params'),
    validate(syncComboItemsSchema),
    productComboController.syncComboItems
);

module.exports = router;
