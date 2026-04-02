'use strict';

const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');
const { createCategorySchema, updateCategorySchema } = require('./category.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorize } = require('../../middleware/role.middleware');
const validate = require('../../middleware/validate.middleware');
const { auditLog } = require('../audit/audit.middleware');

router.get('/', categoryController.getTree);
router.get('/:slug', categoryController.getBySlug);

router.post('/',
    authenticate,
    authorize('admin', 'super_admin'),
    validate(createCategorySchema),
    auditLog('Category'),
    categoryController.create
);

router.put('/:id',
    authenticate,
    authorize('admin', 'super_admin'),
    validate(updateCategorySchema),
    auditLog('Category'),
    categoryController.update
);

router.delete('/:id',
    authenticate,
    authorize('admin', 'super_admin'),
    auditLog('Category'),
    categoryController.delete
);

module.exports = router;
