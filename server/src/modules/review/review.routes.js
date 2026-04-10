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

// Public read access for approved reviews
router.get('/products/:slug/reviews', featureGate('reviews'), reviewController.list);

// Admin read access for all reviews (global list)
router.get('/reviews', authenticate, authorizePermissions(PERMISSIONS.REVIEWS_READ), reviewController.list);

// Customer post reviews
router.post('/products/:slug/reviews', authenticate, featureGate('reviews'), reviewLimiter, validate(createReviewSchema), reviewController.create);

// Admin moderate reviews
router.put('/admin/reviews/:id/moderate', authenticate, authorizePermissions(PERMISSIONS.REVIEWS_MODERATE), validate(moderateReviewSchema), reviewController.moderate);

// Admin delete reviews
router.delete('/admin/reviews/:id', authenticate, authorizePermissions(PERMISSIONS.REVIEWS_DELETE), reviewController.remove);

module.exports = router;
