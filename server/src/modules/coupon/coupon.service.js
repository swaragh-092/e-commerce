'use strict';
const { sequelize } = require('../../config/database');
const { Coupon, CouponUsage } = require('../../models');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const { getPagination } = require('../../utils/pagination');

const list = async ({ page, limit }) => {
  const { limit: lmt, offset } = getPagination(page, limit);
  return Coupon.findAndCountAll({
    limit: lmt,
    offset,
    order: [['createdAt', 'DESC']],
  });
};

const findById = async (id) => {
  const item = await Coupon.findByPk(id);
  if (!item) throw new AppError('NOT_FOUND', 404, 'Coupon not found');
  return item;
};

const create = async (payload, actingUserId) => {
  return sequelize.transaction(async (t) => {
    if (payload.type === 'percentage' && payload.value > 100) {
        throw new AppError('VALIDATION_ERROR', 400, 'Percentage cannot exceed 100');
    }
    const item = await Coupon.create(payload, { transaction: t });
    
    try {
        if (AuditService && AuditService.log) {
            await AuditService.log({
                userId: actingUserId, action: 'CREATE',
                entity: 'Coupon', entityId: item.id,
            }, t);
        }
    } catch(err) {}

    return item;
  });
};

const update = async (id, payload, actingUserId) => {
  return sequelize.transaction(async (t) => {
    const item = await Coupon.findByPk(id, { transaction: t });
    if (!item) throw new AppError('NOT_FOUND', 404, 'Coupon not found');
    
    if ((payload.type === 'percentage' || (item.type === 'percentage' && payload.type === undefined)) && 
        (payload.value > 100 || (payload.value === undefined && item.value > 100))) {
        throw new AppError('VALIDATION_ERROR', 400, 'Percentage cannot exceed 100');
    }

    const before = item.toJSON();
    await item.update(payload, { transaction: t });
    
    try {
        if (AuditService && AuditService.log) {
            await AuditService.log({
            userId: actingUserId, action: 'UPDATE',
            entity: 'Coupon', entityId: id,
            changes: { before, after: item.toJSON() },
            }, t);
        }
    } catch(err) {}

    return item;
  });
};

const remove = async (id, actingUserId) => {
  return sequelize.transaction(async (t) => {
    const item = await Coupon.findByPk(id, { transaction: t });
    if (!item) throw new AppError('NOT_FOUND', 404, 'Coupon not found');
    await item.destroy({ transaction: t });
    
    try {
        if (AuditService && AuditService.log) {
            await AuditService.log({
            userId: actingUserId, action: 'DELETE',
            entity: 'Coupon', entityId: id,
            }, t);
        }
    } catch(err) {}
  });
};

const validateCoupon = async (code, userId, cartSubtotal) => {
    const coupon = await Coupon.findOne({ where: { code: code.toUpperCase() } });
    if (!coupon) throw new AppError('NOT_FOUND', 404, 'Coupon not found');

    if (!coupon.isActive) throw new AppError('VALIDATION_ERROR', 400, 'Coupon is not active');
    
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) {
        throw new AppError('VALIDATION_ERROR', 400, 'Coupon is expired or not yet valid');
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
        throw new AppError('VALIDATION_ERROR', 400, 'Coupon usage limit reached');
    }

    const userCount = await CouponUsage.count({ where: { couponId: coupon.id, userId } });
    if (userCount >= coupon.perUserLimit) {
        throw new AppError('VALIDATION_ERROR', 400, 'You have exceeded the usage limit for this coupon');
    }

    if (cartSubtotal < coupon.minOrderAmount) {
        throw new AppError('VALIDATION_ERROR', 400, `Minimum order amount of ${coupon.minOrderAmount} required`);
    }

    let discount = 0;
    if (coupon.type === 'fixed_amount') {
        discount = Number(coupon.value);
        if (discount > cartSubtotal) discount = cartSubtotal; 
    } else if (coupon.type === 'percentage') {
        discount = (Number(coupon.value) / 100) * cartSubtotal;
        if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
            discount = Number(coupon.maxDiscount);
        }
    }

    return {
        coupon: {
            id: coupon.id,
            code: coupon.code,
            type: coupon.type,
            value: Number(coupon.value)
        },
        discount: Number(discount.toFixed(2)),
        message: `Coupon applied: ${coupon.type === 'percentage' ? Number(coupon.value) + '% off' : 'Fixed amount off'}`
    };
};

module.exports = { list, findById, create, update, remove, validateCoupon };
