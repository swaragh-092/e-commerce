'use strict';
const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const { createProductSchema, updateProductSchema, bulkSaleSchema } = require('./product.validation');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { PERMISSIONS } = require('../../config/permissions');

router.get('/', optionalAuth, productController.list);
router.get('/id/:id', authenticate, authorizePermissions(PERMISSIONS.PRODUCTS_READ), productController.getById);
router.post('/bulk-sale', authenticate, authorizePermissions(PERMISSIONS.PRODUCTS_BULK_SALE), validate(bulkSaleSchema), auditLog('Product'), productController.bulkSale);
router.get('/:slug', optionalAuth, productController.getBySlug);

router.post(
  '/',
  authenticate,
  authorizePermissions(PERMISSIONS.PRODUCTS_CREATE),
  validate(createProductSchema),
  auditLog('Product'),
  productController.create
);

router.put(
  '/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  validate(updateProductSchema),
  auditLog('Product'),
  productController.update
);

router.delete(
  '/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.PRODUCTS_DELETE),
  auditLog('Product'),
  productController.delete
);

module.exports = router;
