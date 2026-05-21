'use strict';

const blogService = require('./blog.service');
const { success, paginated } = require('../../utils/response');

exports.getPublicPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, categorySlug, search } = req.query;
    const result = await blogService.getPosts({ categorySlug, search }, page, limit, false);
    return paginated(res, result.data, result.totalItems, result.currentPage, result.limit, 'Blog posts retrieved successfully');
  } catch (err) {
    next(err);
  }
};

exports.getPublicPostBySlug = async (req, res, next) => {
  try {
    const post = await blogService.getPostBySlug(req.params.slug);
    return success(res, post, 'Blog post retrieved successfully');
  } catch (err) {
    next(err);
  }
};

exports.adminGetPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, categorySlug, search } = req.query;
    const result = await blogService.getPosts({ status, categorySlug, search }, page, limit, true);
    return paginated(res, result.data, result.totalItems, result.currentPage, result.limit, 'Blog posts retrieved successfully');
  } catch (err) {
    next(err);
  }
};

exports.adminGetPostById = async (req, res, next) => {
  try {
    const post = await blogService.getPostById(req.params.id);
    return success(res, post, 'Blog post retrieved successfully');
  } catch (err) {
    next(err);
  }
};

exports.getPublicCategories = async (req, res, next) => {
  try {
    const categories = await blogService.getCategories();
    return success(res, categories, 'Blog categories retrieved successfully');
  } catch (err) {
    next(err);
  }
};

exports.getPublicCategoryBySlug = async (req, res, next) => {
  try {
    const category = await blogService.getCategoryBySlug(req.params.slug);
    return success(res, category, 'Blog category retrieved successfully');
  } catch (err) {
    next(err);
  }
};

exports.adminCreatePost = async (req, res, next) => {
  try {
    const post = await blogService.createPost(req.body, req.user.id);
    return success(res, post, 'Blog post created successfully', 201);
  } catch (err) {
    next(err);
  }
};

exports.adminUpdatePost = async (req, res, next) => {
  try {
    const post = await blogService.updatePost(req.params.id, req.body, req.user.id);
    return success(res, post, 'Blog post updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.adminDeletePost = async (req, res, next) => {
  try {
    await blogService.deletePost(req.params.id, req.user.id);
    return success(res, null, 'Blog post deleted successfully');
  } catch (err) {
    next(err);
  }
};

exports.adminCreateCategory = async (req, res, next) => {
  try {
    const category = await blogService.createCategory(req.body, req.user.id);
    return success(res, category, 'Blog category created successfully', 201);
  } catch (err) {
    next(err);
  }
};

exports.adminUpdateCategory = async (req, res, next) => {
  try {
    const category = await blogService.updateCategory(req.params.id, req.body, req.user.id);
    return success(res, category, 'Blog category updated successfully');
  } catch (err) {
    next(err);
  }
};

exports.adminDeleteCategory = async (req, res, next) => {
  try {
    await blogService.deleteCategory(req.params.id, req.user.id);
    return success(res, null, 'Blog category deleted successfully');
  } catch (err) {
    next(err);
  }
};
