'use strict';
const productService = require('./product.service');
const { success, error } = require('../../utils/response');

exports.list = async (req, res, next) => {
  try {
    const { page, limit, search, category, minPrice, maxPrice, status, sort, tags } = req.query;
    // status is usually admin only
    const filters = { search, category, minPrice, maxPrice, status, sort, tags };
    const result = await productService.getProducts(filters, page, limit);
    return success(res, result.data, 'Products found', 200, {
      total: result.totalItems,
      page: result.currentPage,
      totalPages: result.totalPages,
      limit: parseInt(limit) || 20,
    });
  } catch (err) {
    next(err);
  }
};

exports.getBySlug = async (req, res, next) => {
  try {
    const product = await productService.getProductBySlug(req.params.slug);
    return success(res, { product });
  } catch (err) {
    if (err.message === 'Product not found') return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id);
    return success(res, { product });
  } catch (err) {
    if (err.message === 'Product not found') return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body);
    return success(res, { product }, 'Product created', 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    return success(res, { product }, 'Product updated');
  } catch (err) {
    if (err.message === 'Product not found') return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await productService.deleteProduct(req.params.id);
    return success(res, null, 'Product deleted');
  } catch (err) {
    if (err.message === 'Product not found') return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};
