'use strict';
const productService = require('./product.service');
const { success, error } = require('../../utils/response');
const { PERMISSIONS, getPermissionsForUser } = require('../../config/permissions');

const hasProductAdminView = (user) => getPermissionsForUser(user).includes(PERMISSIONS.PRODUCTS_READ);

exports.list = async (req, res, next) => {
  try {
    const { page, limit, search, brand, category, categoryId, minPrice, maxPrice, status, saleStatus, sort, sortBy, sortOrder, tags, maxQty } = req.query;
    const isAdmin = hasProductAdminView(req.user);
    const filters = { search, brand, category, categoryId, minPrice, maxPrice, status, saleStatus, sort, sortBy, sortOrder, tags, maxQty };
    const result = await productService.getProducts(filters, page, limit, isAdmin);
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
    const isAdmin = hasProductAdminView(req.user);
    const product = await productService.getProductBySlug(req.params.slug, { adminView: isAdmin });
    return success(res, product);
  } catch (err) {
    if (err.message === 'Product not found') return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id);
    return success(res, product);
  } catch (err) {
    if (err.message === 'Product not found') return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const product = await productService.createProduct(req.body);
    return success(res, product, 'Product created', 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
    return success(res, product, 'Product updated');
  } catch (err) {
    if (err.message === 'Product not found') return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

exports.bulkSale = async (req, res, next) => {
  try {
    const result = await productService.bulkUpdateSale(req.body, req.user?.id || null);
    return success(res, result, result.action === 'clear' ? 'Sale removed from products' : 'Sale applied to products');
  } catch (err) {
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
