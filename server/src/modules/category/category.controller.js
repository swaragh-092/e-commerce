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
        const category = await categoryService.getCategoryWithProducts(req.params.slug);
        return success(res, category);
    } catch (err) {
        if (err.message === 'Category not found') return error(res, err.message, 404, 'NOT_FOUND');
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
