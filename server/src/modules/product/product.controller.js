'use strict';
const productService = require('./product.service');
const { success, error } = require('../../utils/response');
const { PERMISSIONS, getPermissionsForUser } = require('../../config/permissions');

const hasProductAdminView = (user) => getPermissionsForUser(user).includes(PERMISSIONS.PRODUCTS_READ);

exports.list = async (req, res, next) => {
  try {
    const { page, limit, search, brand, category, categoryId, minPrice, maxPrice, status, saleStatus, sort, sortBy, sortOrder, tags, maxQty, include } = req.query;
    const isAdmin = hasProductAdminView(req.user);
    
    let sanitizedInclude = undefined;
    if (include && typeof include === 'string') {
      const allowedIncludes = ['attributes', 'variants'];
      const tokens = include.split(',').map(s => s.trim()).filter(Boolean);
      const validTokens = tokens.filter(t => allowedIncludes.includes(t));
      
      if (validTokens.length > 0) {
        sanitizedInclude = validTokens.join(',');
      }
    }

    const filters = { search, brand, category, categoryId, minPrice, maxPrice, status, saleStatus, sort, sortBy, sortOrder, tags, maxQty, include: sanitizedInclude };
    const result = await productService.getProducts(filters, page, limit, isAdmin);
    return success(res, result.data, 'Products found', 200, {
      total: result.totalItems,
      page: result.currentPage,
      totalPages: result.totalPages,
      limit: parseInt(limit) || 20,
      priceRange: result.priceRange,
      counts: result.counts || {},
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
    const auditContext = { userId: req.user?.id, ip: req.ip, userAgent: req.get('User-Agent'), method: req.method, path: req.originalUrl };
    const product = await productService.createProduct(req.body, auditContext);
    return success(res, product, 'Product created', 201);
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const auditContext = { userId: req.user?.id, ip: req.ip, userAgent: req.get('User-Agent'), method: req.method, path: req.originalUrl };
    const product = await productService.updateProduct(req.params.id, req.body, auditContext);
    return success(res, product, 'Product updated');
  } catch (err) {
    if (err.message === 'Product not found') return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

exports.bulkSale = async (req, res, next) => {
  try {
    const auditContext = { userId: req.user?.id, ip: req.ip, userAgent: req.get('User-Agent'), method: req.method, path: req.originalUrl };
    const result = await productService.bulkUpdateSale(req.body, req.user?.id || null, auditContext);
    return success(res, result, result.action === 'clear' ? 'Sale removed from products' : 'Sale applied to products');
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const auditContext = { userId: req.user?.id, ip: req.ip, userAgent: req.get('User-Agent'), method: req.method, path: req.originalUrl };
    await productService.deleteProduct(req.params.id, auditContext);
    return success(res, null, 'Product deleted');
  } catch (err) {
    if (err.message === 'Product not found') return error(res, err.message, 404, 'NOT_FOUND');
    next(err);
  }
};

exports.bulkDelete = async (req, res, next) => {
  try {
    const { productIds } = req.body;
    const auditContext = { userId: req.user?.id, ip: req.ip, userAgent: req.get('User-Agent'), method: req.method, path: req.originalUrl };
    const result = await productService.bulkDeleteProducts(productIds, req.user?.id || null, auditContext);
    return success(res, result, `${result.deletedCount} products deleted successfully`);
  } catch (err) {
    next(err);
  }
};

exports.bulkUpdate = async (req, res, next) => {
  try {
    const { productIds, data } = req.body;
    const auditContext = { ip: req.ip, userAgent: req.get('User-Agent'), method: req.method, path: req.originalUrl };
    const result = await productService.bulkUpdateProducts(productIds, data, req.user?.id || null, auditContext);
    return success(res, result, `${result.updatedCount} products updated successfully`);
  } catch (err) {
    next(err);
  }
};

exports.getRelated = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 6, 12);
    const products = await productService.getRelatedProducts(req.params.id, limit);
    return success(res, products);
  } catch (err) {
    next(err);
  }
};

exports.getStockHistory = async (req, res, next) => {
  try {
    const { InventoryTransaction, User, Order, ProductVariant } = require('../index');
    const { Op } = require('sequelize');
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const where = { productId: req.params.id };

    if (req.query.type) where.type = req.query.type;

    const { count, rows } = await InventoryTransaction.findAndCountAll({
      where,
      include: [
        { model: User, as: 'actor', attributes: ['id', 'firstName', 'lastName', 'email'], required: false },
        { model: Order, as: 'order', attributes: ['id', 'orderNumber'], required: false },
        { model: ProductVariant, as: 'variant', attributes: ['id', 'sku'], required: false },
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return success(res, rows, 'Stock history fetched', 200, {
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
      limit,
    });
  } catch (err) {
    next(err);
  }
};
