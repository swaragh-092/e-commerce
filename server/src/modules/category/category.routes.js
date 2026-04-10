'use strict';

const express = require('express');
const router = express.Router();
const categoryController = require('./category.controller');
const { createCategorySchema, updateCategorySchema } = require('./category.validation');
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { auditLog } = require('../audit/audit.middleware');
const { PERMISSIONS } = require('../../config/permissions');

router.get('/', categoryController.getTree);
router.get('/:slug', categoryController.getBySlug);

router.post('/',
    authenticate,
    authorizePermissions(PERMISSIONS.CATEGORIES_MANAGE),
    validate(createCategorySchema),
    auditLog('Category'),
    categoryController.create
);

router.put('/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.CATEGORIES_MANAGE),
    validate(updateCategorySchema),
    auditLog('Category'),
    categoryController.update
);

router.delete('/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.CATEGORIES_MANAGE),
    auditLog('Category'),
    categoryController.delete
);

module.exports = router;
