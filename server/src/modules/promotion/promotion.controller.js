'use strict';
const PromotionService = require('./promotion.service');
const { success, paginated } = require('../../utils/response');

const list = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, ...filters } = req.query;
    const result = await PromotionService.list(filters, page, limit);
    return paginated(res, result.rows, result.count, page, limit);
  } catch (err) {
    next(err);
  }
};

const getOne = async (req, res, next) => {
  try {
    const item = await PromotionService.findById(req.params.id);
    return success(res, item);
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const item = await PromotionService.create(req.validated, req.user.id);
    return success(res, item, 'Promotion created successfully', 201);
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const item = await PromotionService.update(req.params.id, req.validated, req.user.id);
    return success(res, item, 'Promotion updated successfully');
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    await PromotionService.remove(req.params.id, req.user.id);
    return success(res, null, 'Promotion deleted successfully');
  } catch (err) {
    next(err);
  }
};

const assignProducts = async (req, res, next) => {
  try {
    const { productIds } = req.validated;
    await PromotionService.assignProducts(req.params.id, productIds, req.user.id);
    return success(res, null, 'Products assigned to promotion');
  } catch (err) {
    next(err);
  }
};

const removeProducts = async (req, res, next) => {
  try {
    const { productIds } = req.validated;
    await PromotionService.removeProducts(req.params.id, productIds, req.user.id);
    return success(res, null, 'Products removed from promotion');
  } catch (err) {
    next(err);
  }
};

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  assignProducts,
  removeProducts,
};
