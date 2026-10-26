'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const reviewController = require('./review.controller');
const { moderateReviewSchema } = require('./review.validation');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema, paginationQuerySchema } = require('../../utils/common.validation');

// Admin read access for all reviews (global list) - allows staff to manage existing reviews even when feature is disabled

// Admin read access for all reviews (global list)
router.get('/', authenticate, authorizePermissions(PERMISSIONS.REVIEWS_READ), validate(paginationQuerySchema, 'query'), reviewController.list);

// Admin moderate reviews
router.put('/:id/moderate', authenticate, authorizePermissions(PERMISSIONS.REVIEWS_MODERATE), validate(idParamSchema, 'params'), validate(moderateReviewSchema), reviewController.moderate);

// Admin delete reviews
router.delete('/:id', authenticate, authorizePermissions(PERMISSIONS.REVIEWS_DELETE), validate(idParamSchema, 'params'), reviewController.remove);

module.exports = router;
