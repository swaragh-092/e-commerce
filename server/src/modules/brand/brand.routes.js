'use strict';

const express = require('express');
const brandController = require('./brand.controller');
const brandValidation = require('./brand.validation');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { PERMISSIONS } = require('../../config/permissions');

const router = express.Router();

router.get('/', validate(brandValidation.queryBrandSchema, 'query'), brandController.getBrands);
router.get('/:slug', brandController.getBrandBySlug);

// Protected Admin Routes
router.post(
    '/',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_CREATE),
    validate(brandValidation.createBrandSchema),
    brandController.createBrand
);

router.patch(
    '/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE),
    validate(brandValidation.updateBrandSchema),
    brandController.updateBrand
);

router.delete(
    '/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.PRODUCTS_DELETE),
    brandController.deleteBrand
);

module.exports = router;
