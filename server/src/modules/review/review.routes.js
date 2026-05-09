'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { featureGate } = require('../../middleware/featureGate.middleware');
const { reviewLimiter } = require('../../middleware/rateLimiter.middleware');

const reviewController = require('./review.controller');
const { createReviewSchema, moderateReviewSchema } = require('./review.validation');
const { PERMISSIONS } = require('../../config/permissions');
const { idParamSchema, paginationQuerySchema, slugParamSchema } = require('../../utils/common.validation');



// Apply reviews feature gate to all routes in this module
router.use(featureGate('reviews'));

// Public read access for approved reviews
router.get('/products/:slug/reviews', validate(paginationQuerySchema, 'query'), validate(slugParamSchema, 'params'), reviewController.list);

// Admin read access for all reviews (global list)
router.get('/admin/reviews', authenticate, authorizePermissions(PERMISSIONS.REVIEWS_READ), validate(paginationQuerySchema, 'query'), reviewController.list);


// Customer post reviews
router.post('/products/:slug/reviews', authenticate, authorizePermissions(PERMISSIONS.REVIEWS_CREATE), reviewLimiter, validate(createReviewSchema), reviewController.create);

// Admin moderate reviews
router.put('/admin/reviews/:id/moderate', authenticate, authorizePermissions(PERMISSIONS.REVIEWS_MODERATE), validate(idParamSchema, 'params'), validate(moderateReviewSchema), reviewController.moderate);


// Admin delete reviews
router.delete('/admin/reviews/:id', authenticate, authorizePermissions(PERMISSIONS.REVIEWS_DELETE), validate(idParamSchema, 'params'), reviewController.remove);


module.exports = router;
