'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true }); // inherit :id from parent
const productTabController = require('./productTab.controller');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema } = require('../../utils/common.validation');
const {
    createTabSchema,
    updateTabSchema,
    reorderTabsSchema,
    syncTabsSchema,
} = require('./productTab.validation');

// Param schema for :tabId
const Joi = require('joi');
const tabIdParamSchema = Joi.object({ id: Joi.string().uuid().required(), tabId: Joi.string().uuid().required() });

// GET  /api/products/:id/tabs  — public-safe
router.get(
    '/:id/tabs',
    validate(idParamSchema, 'params'),
    productTabController.list
);

// POST /api/products/:id/tabs  — admin: create one tab
router.post(
    '/:id/tabs',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE),
    validate(idParamSchema, 'params'),
    validate(createTabSchema),
    productTabController.create
);

// PUT  /api/products/:id/tabs  — admin: full sync
router.put(
    '/:id/tabs',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE),
    validate(idParamSchema, 'params'),
    validate(syncTabsSchema),
    productTabController.sync
);

// PUT  /api/products/:id/tabs/reorder
router.put(
    '/:id/tabs/reorder',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE),
    validate(idParamSchema, 'params'),
    validate(reorderTabsSchema),
    productTabController.reorder
);

// PUT  /api/products/:id/tabs/:tabId
router.put(
    '/:id/tabs/:tabId',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE),
    validate(tabIdParamSchema, 'params'),
    validate(updateTabSchema),
    productTabController.update
);

// DELETE /api/products/:id/tabs/:tabId
router.delete(
    '/:id/tabs/:tabId',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE),
    validate(tabIdParamSchema, 'params'),
    productTabController.remove
);

module.exports = router;
