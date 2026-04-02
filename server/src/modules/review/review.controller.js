'use strict';

const ReviewService = require('./review.service');
const { success, paginated } = require('../../utils/response');

const create = async (req, res, next) => {
  try {
    const review = await ReviewService.create(req.user.id, req.params.slug, req.validated);
    return success(res, review, 'Review submitted successfully and is pending approval', 201);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return next(Object.assign(err, { code: 'DUPLICATE_ENTRY', statusCode: 409, message: 'You have already reviewed this product' }));
    }
    next(err);
  }
};

const list = async (req, res, next) => {
  try {
    const { page, limit, status } = req.query;
    const slug = req.params.slug;
    
    // If slug exists, it's a public product view (only show approved)
    // If no slug, it's an admin view (use status from query)
    const effectiveStatus = slug ? 'approved' : (status || 'approved');
    
    const result = await ReviewService.list(slug, { page, limit, status: effectiveStatus });
    return paginated(res, result.rows, { page, limit, total: result.count });
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
  remove
};
