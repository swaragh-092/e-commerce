'use strict';
const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const { getProductWriteSchema, productListQuerySchema, createProductSchema, catalogCreateProductSchema, updateProductSchema, bulkSaleSchema, bulkDeleteSchema, bulkUpdateSchema } = require('./product.validation');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { PERMISSIONS, getPermissionsForUser } = require('../../config/permissions');
const { error } = require('../../utils/response');
const { idParamSchema } = require('../../utils/common.validation');
const settingsService = require('../settings/settings.service');

const requireTagPermission = async (req, res, next) => {
  if (req.body?.tags === undefined) return next();
  const permissions = getPermissionsForUser(req.user);
  if (!permissions.includes(PERMISSIONS.TAGS_MANAGE)) {
    return error(res, 'You do not have permission to manage product tags.', 403, 'FORBIDDEN');
  }
  try {
    const { features } = await settingsService.getFeatures();
    if (features?.tags !== true) return error(res, 'Product tags are disabled for this store.', 403, 'FEATURE_DISABLED');
    return next();
  } catch (err) {
    return next(err);
  }
};

const validateProductWrite = (schema) => async (req, res, next) => {
  try {
    const { features } = await settingsService.getFeatures();
    if (schema === createProductSchema && features?.pricing === false && catalogCreateProductSchema) {
      return validate(catalogCreateProductSchema)(req, res, next);
    }
    return validate(getProductWriteSchema(schema, features))(req, res, next);
  } catch (err) {
    return next(err);
  }
};



router.get('/', optionalAuth, validate(productListQuerySchema, 'query'), productController.list);

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
  requireTagPermission,
  validateProductWrite(createProductSchema),
  auditLog('Product'),
  productController.create
);

router.put(
  '/:id',
  authenticate,
  authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  validate(idParamSchema, 'params'),
  requireTagPermission,
  validateProductWrite(updateProductSchema),
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
