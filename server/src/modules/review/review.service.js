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

const activeRefreshes = new Map();

/**
 * F-13: Recomputes and stores avg_rating + review_count on the product row.
 * Uses a debounce/batching mechanism to prevent redundant queries during bulk moderation.
 */
const refreshProductRatingCache = async (productId) => {
    if (activeRefreshes.has(productId)) {
        return activeRefreshes.get(productId);
    }

    const promise = new Promise((resolve) => {
        setTimeout(async () => {
            activeRefreshes.delete(productId);
            try {
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
            } catch (err) {
                logger.error('Error refreshing product rating cache', { productId, error: err.message });
            } finally {
                resolve();
            }
        }, 500); // 500ms batching window
    });

    activeRefreshes.set(productId, promise);
    return promise;
};

const create = async (userId, slug, payload) => {
  const { features } = await SettingsService.getFeatures();
  
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
        where: { 
            userId, 
            [Op.or]: [
                { orderShippingStatus: { [Op.in]: ['delivered', 'partially_delivered'] } },
                { status: 'closed' },
            ],
            status: { [Op.notIn]: ['cancelled', 'refunded'] },
            putBackStatus: { [Op.or]: [{ [Op.is]: null }, { [Op.notIn]: ['full_return'] }] }
        },
        include: [{
            model: OrderItem,
            as: 'items',
            where: { productId }
        }],
        transaction: t,
        limit: 1
        });

        if (orders && orders.length > 0) {
           orderId = orders[0].id;
        }
    }
    
    if (orderId) {
        // Validate it really exists, belongs to user, and contains this product
        const order = await Order.findOne({ 
            where: { 
                id: orderId, 
                userId, 
                [Op.or]: [
                    { orderShippingStatus: { [Op.in]: ['delivered', 'partially_delivered'] } },
                    { status: 'closed' },
                ],
                status: { [Op.notIn]: ['cancelled', 'refunded'] },
                putBackStatus: { [Op.or]: [{ [Op.is]: null }, { [Op.notIn]: ['full_return'] }] }
            },
            include: [{
                model: OrderItem,
                as: 'items',
                where: { productId }
            }],
            transaction: t 
        });

        if (order) {
            isVerifiedPurchase = true;
        } else {
            orderId = null; // invalid order id given or product not in order
        }
    }

    // Enforce purchase requirement if enabled
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

const list = async (slug, { page, limit, status, search }) => {
  let where = {};
  
  if (slug) {
    const product = await Product.findOne({ where: { slug } });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    where.productId = product.id;
  }

  const { limit: lmt, offset } = getPagination(page, limit);
  
  if (status) where.status = status;

  let include = [
    { model: User, attributes: ['id', 'firstName', 'lastName'] },
    { model: Product, attributes: ['id', 'name'] }
  ];

  if (search && !slug) {
    const searchEscaped = search.replace(/[%_]/g, '\\$&');
    where = {
      ...where,
      [Op.or]: [
        { '$User.firstName$': { [Op.iLike]: `%${searchEscaped}%` } },
        { '$User.lastName$': { [Op.iLike]: `%${searchEscaped}%` } },
        { '$Product.name$': { [Op.iLike]: `%${searchEscaped}%` } },
        { title: { [Op.iLike]: `%${searchEscaped}%` } },
      ]
    };
  }

  const result = await Review.findAndCountAll({
    where,
    limit: lmt,
    offset,
    include,
    subQuery: false,
    order: [['createdAt', 'DESC']]
  });

  // If no slug, it's likely an admin list, so let's provide status counts
  let counts = {};
  if (!slug) {
    const countWhere = { ...where };
    delete countWhere.status;

    const statusCounts = await Review.findAll({
      where: countWhere,
      include: (search && !slug) ? include.map(inc => ({ ...inc, attributes: [] })) : [],
      attributes: [
        [sequelize.col('Review.status'), 'status'],
        [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('Review.id'))), 'count']
      ],
      group: [sequelize.col('Review.status')],
      raw: true
    });
    counts = statusCounts.reduce((acc, curr) => {
      acc[curr.status] = parseInt(curr.count, 10);
      return acc;
    }, { pending: 0, approved: 0, rejected: 0 });
    counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
  }

  return {
    rows: result.rows,
    count: result.count,
    counts
  };
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

const getUserReviewForProduct = async (userId, slug) => {
  const product = await Product.findOne({ where: { slug } });
  if (!product) return null;
  return Review.findOne({
    where: { userId, productId: product.id },
    include: [
      { model: User, attributes: ['id', 'firstName', 'lastName'] },
      { model: Product, attributes: ['id', 'name'] }
    ]
  });
};

module.exports = {
  create,
  list,
  moderate,
  remove,
  getUserReviewForProduct
};
