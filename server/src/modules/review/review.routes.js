'use strict';

const router = require('express').Router();
const { authenticate } = require('../../middleware/auth.middleware');
const { authorizePermissions } = require('../../middleware/role.middleware');
const { validate } = require('../../middleware/validate.middleware');
const { featureGate } = require('../../middleware/featureGate.middleware');
const { reviewLimiter } = require('../../middleware/rateLimiter.middleware');

const reviewController = require('./review.controller');
const { createReviewSchema } = require('./review.validation');
const { PERMISSIONS } = require('../../config/permissions');
const { paginationQuerySchema, slugParamSchema } = require('../../utils/common.validation');

// Apply reviews feature gate to all routes in this module
router.use(featureGate('reviews'));

// Public read access for approved reviews
router.get('/products/:slug/reviews', validate(paginationQuerySchema, 'query'), validate(slugParamSchema, 'params'), reviewController.list);

// Customer post reviews
router.post('/products/:slug/reviews', authenticate, authorizePermissions(PERMISSIONS.REVIEWS_CREATE), reviewLimiter, validate(createReviewSchema), reviewController.create);

module.exports = router;
