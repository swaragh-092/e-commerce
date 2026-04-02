'use strict';

const { sequelize, Review, Product, Order, OrderItem, User } = require('../index');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const { getPagination } = require('../../utils/pagination');
const { sanitizePlainText } = require('../../middleware/sanitize.middleware');
const { ACTIONS, ENTITIES } = require('../../config/constants');

const create = async (userId, slug, payload) => {
  return sequelize.transaction(async (t) => {
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

    const title = sanitizePlainText(payload.title);
    const body = sanitizePlainText(payload.body);

    const review = await Review.create({
      userId,
      productId,
      orderId,
      isVerifiedPurchase,
      rating: payload.rating,
      title,
      body,
      status: 'pending' // waits admin moderation
    }, { transaction: t });

    return review;
  });
};

const list = async (slug, { page, limit, status }) => {
  const product = await Product.findOne({ where: { slug } });
  if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');

  const { limit: lmt, offset } = getPagination(page, limit);
  const where = { productId: product.id };
  
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
  return sequelize.transaction(async (t) => {
    const review = await Review.findByPk(id, { transaction: t });
    if (!review) throw new AppError('NOT_FOUND', 404, 'Review not found');

    const before = review.toJSON();
    await review.update({ status }, { transaction: t });

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId: adminId,
          action: ACTIONS.UPDATE,
          entity: ENTITIES.REVIEW,
          entityId: review.id,
          changes: { before: before.status, after: status }
        }, t);
      }
    } catch(err) {}

    return review;
  });
};

const remove = async (id, adminId) => {
  return sequelize.transaction(async (t) => {
    const review = await Review.findByPk(id, { transaction: t });
    if (!review) throw new AppError('NOT_FOUND', 404, 'Review not found');

    await review.destroy({ transaction: t });

    try {
      if (AuditService && AuditService.log) {
        await AuditService.log({
          userId: adminId,
          action: ACTIONS.DELETE,
          entity: ENTITIES.REVIEW,
          entityId: review.id
        }, t);
      }
    } catch(err) {}
  });
};

module.exports = {
  create,
  list,
  moderate,
  remove
};
