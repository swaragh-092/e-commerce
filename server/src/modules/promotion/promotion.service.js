'use strict';

const { Promotion, ProductPromotion, Product, Sequelize } = require('../index');
const { getPagination, getPagingData } = require('../../utils/pagination');
const AuditService = require('../audit/audit.service');
const AppError = require('../../utils/AppError');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const { Op } = Sequelize;

exports.list = async (filters, page, limit) => {
  const { limit: queryLimit, offset } = getPagination(page, limit);
  const where = {};
  
  if (filters.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${filters.search}%` } },
      { label: { [Op.iLike]: `%${filters.search}%` } }
    ];
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive === 'true' || filters.isActive === true;
  }

  if (filters.type) {
    where.type = filters.type;
  }

  const { rows, count } = await Promotion.findAndCountAll({
    where,
    limit: queryLimit,
    offset,
    order: [['createdAt', 'DESC']],
    include: [
      {
        model: Product,
        as: 'products',
        attributes: ['id'],
        through: { attributes: [] }
      }
    ],
    distinct: true
  });

  return getPagingData(rows, count, page, queryLimit);
};

exports.findById = async (id) => {
  const promotion = await Promotion.findByPk(id, {
    include: [
      {
        model: Product,
        as: 'products',
        attributes: ['id', 'name', 'slug', 'price', 'salePrice', 'images', 'status', 'isEnabled']
      }
    ]
  });
  if (!promotion) throw new AppError('NOT_FOUND', 404, 'Promotion not found');
  return promotion;
};

exports.create = async (data, actingUserId) => {
  const promotion = await Promotion.create(data);
  try {
    await AuditService.log({
      userId: actingUserId,
      action: ACTIONS.CREATE,
      entity: 'Promotion',
      entityId: promotion.id,
      changes: { name: promotion.name, label: promotion.label },
    });
  } catch (e) {}
  return promotion;
};

exports.update = async (id, data, actingUserId) => {
  const promotion = await Promotion.findByPk(id);
  if (!promotion) throw new AppError('NOT_FOUND', 404, 'Promotion not found');

  await promotion.update(data);
  try {
    await AuditService.log({
      userId: actingUserId,
      action: ACTIONS.UPDATE,
      entity: 'Promotion',
      entityId: promotion.id,
      changes: data,
    });
  } catch (e) {}
  return promotion;
};

exports.remove = async (id, actingUserId) => {
  const promotion = await Promotion.findByPk(id);
  if (!promotion) throw new AppError('NOT_FOUND', 404, 'Promotion not found');

  const snapshot = { name: promotion.name, label: promotion.label };
  await promotion.destroy();
  try {
    await AuditService.log({
      userId: actingUserId,
      action: ACTIONS.DELETE,
      entity: 'Promotion',
      entityId: id,
      changes: snapshot,
    });
  } catch (e) {}
  return true;
};

exports.assignProducts = async (promotionId, productIds, actingUserId) => {
  const promotion = await Promotion.findByPk(promotionId);
  if (!promotion) throw new AppError('NOT_FOUND', 404, 'Promotion not found');

  const transaction = await Promotion.sequelize.transaction();
  try {
    const assignments = productIds.map(productId => ({
      promotionId,
      productId
    }));

    await ProductPromotion.bulkCreate(assignments, {
      ignoreDuplicates: true,
      transaction
    });

    await transaction.commit();

    try {
      await AuditService.log({
        userId: actingUserId,
        action: ACTIONS.UPDATE,
        entity: 'Promotion',
        entityId: promotionId,
        changes: { assignedProducts: productIds },
      });
    } catch (e) {}
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

exports.removeProducts = async (promotionId, productIds, actingUserId) => {
  const promotion = await Promotion.findByPk(promotionId);
  if (!promotion) throw new AppError('NOT_FOUND', 404, 'Promotion not found');

  const transaction = await Promotion.sequelize.transaction();
  try {
    await ProductPromotion.destroy({
      where: {
        promotionId,
        productId: productIds
      },
      transaction
    });

    await transaction.commit();

    try {
      await AuditService.log({
        userId: actingUserId,
        action: ACTIONS.UPDATE,
        entity: 'Promotion',
        entityId: promotionId,
        changes: { removedProducts: productIds },
      });
    } catch (e) {}
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};
