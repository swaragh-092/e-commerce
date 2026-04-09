'use strict';

const express = require('express');
const brandController = require('./brand.controller');
const brandValidation = require('./brand.validation');
const { validate } = require('../../middleware/validate.middleware');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');

const router = express.Router();

router.get('/', validate(brandValidation.queryBrandSchema, 'query'), brandController.getBrands);
router.get('/:slug', brandController.getBrandBySlug);

// Protected Admin Routes
router.post(
    '/',
    authenticate,
    authorize('admin', 'super_admin'),
    validate(brandValidation.createBrandSchema),
    brandController.createBrand
);

router.patch(
    '/:id',
    authenticate,
    authorize('admin', 'super_admin'),
    validate(brandValidation.updateBrandSchema),
    brandController.updateBrand
);

router.delete(
    '/:id',
    authenticate,
    authorize('admin', 'super_admin'),
    brandController.deleteBrand
);

module.exports = router;
