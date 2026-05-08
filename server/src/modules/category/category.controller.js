'use strict';

const categoryService = require('./category.service');
const { success, error } = require('../../utils/response');

exports.getTree = async (req, res, next) => {
    try {
        const tree = await categoryService.getCategoryTree();
        return success(res, tree);
    } catch (err) {
        next(err);
    }
};

exports.getBySlug = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const result = await categoryService.getCategoryWithProducts(req.params.slug, page, limit);
        return success(res, result);
    } catch (err) {
        if (err.statusCode === 404) return error(res, err.message, 404, 'NOT_FOUND');
        next(err);
    }
};

exports.create = async (req, res, next) => {
    try {
        const category = await categoryService.createCategory(req.body);
        return success(res, category, 'Category created', 201);
    } catch (err) {
        next(err);
    }
};

exports.reorder = async (req, res, next) => {
    try {
        await categoryService.reorderCategory(req.params.id, req.body.direction);
        return success(res, null, 'Category reordered');
    } catch (err) {
        if (err.message === 'Already at the top' || err.message === 'Already at the bottom') {
            return error(res, err.message, 400, 'VALIDATION_ERROR');
        }
        next(err);
    }
};

exports.update = async (req, res, next) => {
    try {
        const category = await categoryService.updateCategory(req.params.id, req.body);
        return success(res, category, 'Category updated');
    } catch (err) {
        if (err.message === 'Category not found') return error(res, err.message, 404, 'NOT_FOUND');
        if (err.message === 'Category cannot be its own parent') return error(res, err.message, 400, 'BAD_REQUEST');
        next(err);
    }
};

exports.delete = async (req, res, next) => {
    try {
        await categoryService.deleteCategory(req.params.id);
        return success(res, null, 'Category deleted');
    } catch (err) {
        if (err.message === 'Category not found') return error(res, err.message, 404, 'NOT_FOUND');
        if (err.message === 'Cannot delete category with subcategories') return error(res, err.message, 400, 'BAD_REQUEST');
        next(err);
    }
};

exports.reorderProducts = async (req, res, next) => {
    try {
        const { productIds } = req.body;
        if (!Array.isArray(productIds)) {
            return error(res, 'productIds must be an array', 400, 'VALIDATION_ERROR');
        }
        await categoryService.reorderProducts(req.params.id, productIds);
        return success(res, null, 'Product order updated');
    } catch (err) {
        next(err);
    }
};
