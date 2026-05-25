'use strict';
const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const { createProductSchema, updateProductSchema, bulkSaleSchema, bulkDeleteSchema, bulkUpdateSchema } = require('./product.validation');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema, paginationQuerySchema } = require('../../utils/common.validation');



router.get('/', optionalAuth, validate(paginationQuerySchema, 'query'), productController.list);

router.get('/id/:id', authenticate, authorizePermissions(PERMISSIONS.PRODUCTS_READ), validate(idParamSchema, 'params'), productController.getById);

router.post('/bulk-sale', authenticate, authorizePermissions(PERMISSIONS.PRODUCTS_BULK_SALE), validate(bulkSaleSchema), auditLog('Product'), productController.bulkSale);
router.delete('/bulk', authenticate, authorizePermissions(PERMISSIONS.PRODUCTS_DELETE), validate(bulkDeleteSchema), auditLog('Product'), productController.bulkDelete);
router.patch('/bulk', authenticate, authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE), validate(bulkUpdateSchema), auditLog('Product'), productController.bulkUpdate);
router.get('/id/:id/related', optionalAuth, productController.getRelated);
router.get('/id/:id/stock-history', authenticate, authorizePermissions(PERMISSIONS.PRODUCTS_READ), validate(idParamSchema, 'params'), productController.getStockHistory);

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
  validate(idParamSchema, 'params'),
  validate(updateProductSchema),
  auditLog('Product'),
  productController.update
);


router.delete(
  '/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.PRODUCTS_DELETE),
  validate(idParamSchema, 'params'),
  auditLog('Product'),
  productController.delete
);


module.exports = router;
