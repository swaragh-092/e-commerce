'use strict';

const express = require('express');
const brandController = require('./brand.controller');
const brandValidation = require('./brand.validation');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate, optionalAuth } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');
const { auditLog } = require('../audit/audit.middleware');
const { idParamSchema } = require('../../utils/common.validation');


const router = express.Router();

router.get('/', optionalAuth, validate(brandValidation.queryBrandSchema, 'query'), brandController.getBrands);
router.get('/:slug', optionalAuth, validate(brandValidation.getBrandBySlugSchema, 'query'), brandController.getBrandBySlug);

// Protected Admin Routes
router.post(
    '/',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_CREATE),
    validate(brandValidation.createBrandSchema),
    auditLog('Brand'),
    brandController.createBrand
);

router.patch(
    '/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE),
    validate(idParamSchema, 'params'),
    validate(brandValidation.updateBrandSchema),
    auditLog('Brand'),
    brandController.updateBrand
);


router.delete(
    '/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_DELETE),
    validate(idParamSchema, 'params'),
    auditLog('Brand'),
    brandController.deleteBrand
);

module.exports = router;
