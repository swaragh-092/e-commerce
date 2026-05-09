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
const { idParamSchema, paginationQuerySchema } = require('../../utils/common.validation');



router.get('/', categoryController.getTree);
router.get('/:slug', validate(paginationQuerySchema, 'query'), categoryController.getBySlug);


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
    validate(idParamSchema, 'params'),
    validate(updateCategorySchema),
    auditLog('Category'),
    categoryController.update
);


router.post('/:id/reorder',
    authenticate,
    authorizePermissions(PERMISSIONS.CATEGORIES_MANAGE),
    validate(idParamSchema, 'params'),
    auditLog('Category'),
    categoryController.reorder
);


router.post('/:id/products/reorder',
    authenticate,
    authorizePermissions(PERMISSIONS.CATEGORIES_MANAGE),
    validate(idParamSchema, 'params'),
    auditLog('Category'),
    categoryController.reorderProducts
);


router.delete('/:id',
    authenticate,
    authorizePermissions(PERMISSIONS.CATEGORIES_MANAGE),
    validate(idParamSchema, 'params'),
    auditLog('Category'),
    categoryController.delete
);


module.exports = router;
