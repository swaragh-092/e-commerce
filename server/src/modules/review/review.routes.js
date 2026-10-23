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

// This router is mounted at /api: gate matched review routes only, so
// disabling reviews does not block unrelated APIs registered after it.
const reviewsFeature = featureGate('reviews');

// Get current user's review for a product (must be before /:slug/reviews to avoid param conflict)
// validate slugParamSchema here for consistency — malformed slugs are rejected before hitting the controller
router.get('/products/:slug/reviews/mine', reviewsFeature, authenticate, validate(slugParamSchema, 'params'), reviewController.getMyReview);

// Public read access for approved reviews
router.get('/products/:slug/reviews', reviewsFeature, validate(paginationQuerySchema, 'query'), validate(slugParamSchema, 'params'), reviewController.list);

// Customer post reviews
router.post('/products/:slug/reviews', reviewsFeature, authenticate, authorizePermissions(PERMISSIONS.REVIEWS_CREATE), reviewLimiter, validate(createReviewSchema), reviewController.create);

module.exports = router;
