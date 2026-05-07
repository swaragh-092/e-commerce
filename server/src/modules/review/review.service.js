'use strict';

const { sequelize, Review, Product, Order, OrderItem, User } = require('../index');
const logger = require('../../utils/logger');
const { Op } = require('sequelize');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const { getPagination } = require('../../utils/pagination');
const { sanitizePlainText } = require('../../middleware/sanitize.middleware');
const SettingsService = require('../settings/settings.service');
const { ACTIONS, ENTITIES } = require('../../config/constants');

/**
 * F-13: Recomputes and stores avg_rating + review_count on the product row.
 * Should be called (outside any long transaction) after a review is created
 * or its status is changed.
 */
const refreshProductRatingCache = async (productId) => {
    const result = await Review.findOne({
        where: { productId, status: 'approved' },
        attributes: [
            [sequelize.fn('AVG', sequelize.col('rating')), 'avgRating'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'reviewCount'],
        ],
        raw: true,
    });
    const avgRating = result && result.avgRating ? parseFloat(parseFloat(result.avgRating).toFixed(2)) : null;
    const reviewCount = result ? parseInt(result.reviewCount, 10) : 0;
    await Product.update({ avgRating, reviewCount }, { where: { id: productId } });
};

const create = async (userId, slug, payload) => {
  const review = await sequelize.transaction(async (t) => {
    const product = await Product.findOne({ where: { slug }, transaction: t });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    const productId = product.id;

    const existing = await Review.findOne({ where: { userId, productId }, transaction: t });
    if (existing) throw new AppError('DUPLICATE_ENTRY', 409, 'You have already reviewed this product');

    // Check if verified purchase
    let isVerifiedPurchase = false;
    let orderId = payload.orderId || null;

    if (!orderId) {
        // Auto-detect order if not provided
        const orders = await Order.findAll({
        where: { userId, status: 'delivered' },
        include: [{
            model: OrderItem,
            as: 'items',
            where: { productId }
        }],
        transaction: t
        });

        if (orders && orders.length > 0) {
           orderId = orders[0].id;
        }
    }
    
    if (orderId) {
        // Validate it really exists and belongs to user
        const order = await Order.findOne({ where: { id: orderId, userId, status: 'delivered' }, transaction: t });
        if (order) {
            isVerifiedPurchase = true;
        } else {
            orderId = null; // invalid order id given
        }
    }

    // Enforce purchase requirement if enabled
    const { features } = await SettingsService.getFeatures();
    if (features.requirePurchaseForReview && !isVerifiedPurchase) {
        throw new AppError('FORBIDDEN', 403, 'You must purchase this product and have it delivered before leaving a review');
    }

    const title = sanitizePlainText(payload.title);
    const body = sanitizePlainText(payload.body);

    return Review.create({
      userId,
      productId,
      orderId,
      isVerifiedPurchase,
      rating: payload.rating,
      title,
      body,
      status: 'pending' // waits admin moderation
    }, { transaction: t });
  });

  // Audit log outside transaction
  try {
    if (AuditService && AuditService.log) {
      await AuditService.log({
        userId,
        action: ACTIONS.CREATE,
        entity: ENTITIES.REVIEW,
        entityId: review.id,
        details: { productId: review.productId, rating: payload.rating }
      });
    }
  } catch (err) {
    logger.error('Review audit log failed', {
      userId,
      action: ACTIONS.CREATE,
      entity: ENTITIES.REVIEW,
      entityId: review.id,
      error: err.message,
      stack: err.stack
    });
  }

  return review;
};

const list = async (slug, { page, limit, status }) => {
  let where = {};
  
  if (slug) {
    const product = await Product.findOne({ where: { slug } });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    where.productId = product.id;
  }

  const { limit: lmt, offset } = getPagination(page, limit);
  
  if (status) where.status = status;

  return Review.findAndCountAll({
    where,
    limit: lmt,
    offset,
    include: [{ model: User, attributes: ['id', 'firstName', 'lastName'] }],
    order: [['createdAt', 'DESC']]
  });
};

const moderate = async (id, status, adminId) => {
  const { productId, beforeStatus } = await sequelize.transaction(async (t) => {
    const review = await Review.findByPk(id, { transaction: t });
    if (!review) throw new AppError('NOT_FOUND', 404, 'Review not found');

    const before = review.toJSON();
    await review.update({ status }, { transaction: t });

    return { productId: review.productId, beforeStatus: before.status };
  });

  // Refresh the cached avg/count outside the transaction
  await refreshProductRatingCache(productId);

  // Audit log outside transaction
  try {
    if (AuditService && AuditService.log) {
      await AuditService.log({
        userId: adminId,
        action: ACTIONS.UPDATE,
        entity: ENTITIES.REVIEW,
        entityId: id,
        changes: { before: beforeStatus, after: status }
      });
    }
  } catch (err) {
    logger.error('Review moderate audit log failed', {
      userId: adminId,
      action: ACTIONS.UPDATE,
      entity: ENTITIES.REVIEW,
      entityId: id,
      error: err.message,
      stack: err.stack
    });
  }

  return Review.findByPk(id);
};

const remove = async (id, adminId) => {
  const productId = await sequelize.transaction(async (t) => {
    const review = await Review.findByPk(id, { transaction: t });
    if (!review) throw new AppError('NOT_FOUND', 404, 'Review not found');

    const pid = review.productId;
    await review.destroy({ transaction: t });

    return pid;
  });

  // Refresh the cached avg/count outside the transaction
  await refreshProductRatingCache(productId);

  // Audit log outside transaction
  try {
    if (AuditService && AuditService.log) {
      await AuditService.log({
        userId: adminId,
        action: ACTIONS.DELETE,
        entity: ENTITIES.REVIEW,
        entityId: id
      });
    }
  } catch (err) {
    logger.error('Review delete audit log failed', {
      userId: adminId,
      action: ACTIONS.DELETE,
      entity: ENTITIES.REVIEW,
      entityId: id,
      error: err.message,
      stack: err.stack
    });
  }
};

module.exports = {
  create,
  list,
  moderate,
  remove
};
