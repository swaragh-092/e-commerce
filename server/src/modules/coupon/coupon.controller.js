'use strict';
const CouponService = require('./coupon.service');
const { success, paginated } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const result = await CouponService.list({ page, limit });
    return paginated(res, result.rows, result.count, page, limit);

  } catch (err) {
    next(err);
  }

};

const getOne = async (req, res, next) => {
  try {
    const item = await CouponService.findById(req.params.id);
    return success(res, item);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const item = await CouponService.create(req.validated, req.user.id);
    return success(res, item, 'Coupon created', 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const item = await CouponService.update(req.params.id, req.validated, req.user.id);
    return success(res, item, 'Coupon updated');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await CouponService.remove(req.params.id, req.user.id);
    return success(res, null, 'Coupon deleted');
  } catch (err) {
    next(err);
  }
};

const validateCoupon = async (req, res, next) => {
  try {
    const { code, subtotal } = req.validated;
    const userId = req.user.id;
    const result = await CouponService.validateCoupon(code, userId, subtotal);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};

module.exports = { list, getOne, create, update, remove, validateCoupon };
