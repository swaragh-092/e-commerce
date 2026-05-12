'use strict';

const ReviewService = require('./review.service');
const { success, paginated } = require('../../utils/response');

const create = async (req, res, next) => {
  try {
    const review = await ReviewService.create(req.user.id, req.params.slug, req.validated);
    return success(res, review, 'Review submitted successfully and is pending approval', 201);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return next(
        Object.assign(err, {
          code: 'DUPLICATE_ENTRY',
          statusCode: 409,
          message: 'You have already reviewed this product',
        })
      );
    }
    next(err);
  }
};

const list = async (req, res, next) => {
  try {
    const { page, limit, status, search } = req.query;
    const slug = req.params.slug;

    // If slug exists, it's a public product view (only show approved)
    // If no slug, it's an admin view (use status from query)
    const effectiveStatus = slug ? 'approved' : status || 'approved';

    const result = await ReviewService.list(slug, { page, limit, status: effectiveStatus, search });
    
    // If authenticated and viewing a specific product, also try to fetch the current user's review
    // if it's pending, so they can see it even before approval.
    if (slug && req.user && result.rows) {
      const userReview = await ReviewService.getUserReviewForProduct(req.user.id, slug);
      if (userReview && userReview.status === 'pending') {
        // Prevent duplicate if it somehow was already included (shouldn't be due to effectiveStatus)
        if (!result.rows.find(r => r.id === userReview.id)) {
          result.rows = [userReview, ...result.rows];
          result.count = (result.count || 0) + 1;
        }
      }
    }

    return paginated(res, result.rows, result.count, page, limit, 'Success', { counts: result.counts || {} });
  } catch (err) {
    next(err);
  }
};

const moderate = async (req, res, next) => {
  try {
    const review = await ReviewService.moderate(req.params.id, req.validated.status, req.user.id);
    return success(res, review, 'Review moderated successfully');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await ReviewService.remove(req.params.id, req.user.id);
    return success(res, null, 'Review deleted successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  create,
  list,
  moderate,
  remove,
};
