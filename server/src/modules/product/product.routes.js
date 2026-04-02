'use strict';
const express = require('express');
const router = express.Router();
const productController = require('./product.controller');
const { createProductSchema, updateProductSchema } = require('./product.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { auditLog } = require('../audit/audit.middleware');

router.get('/', productController.list);
router.get('/:slug', productController.getBySlug);

router.post('/',
    authenticate,
    authorize('admin', 'super_admin'),
    validate(createProductSchema),
    auditLog('Product'),
    productController.create
);

router.put('/:id',
    authenticate,
    authorize('admin', 'super_admin'),
    validate(updateProductSchema),
    auditLog('Product'),
    productController.update
);

router.delete('/:id',
    authenticate,
    authorize('admin', 'super_admin'),
    auditLog('Product'),
    productController.delete
);

module.exports = router;
