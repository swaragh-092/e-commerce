'use strict';

const PageService = require('./page.service');
const { success, paginated } = require('../../utils/response');
const AppError = require('../../utils/AppError');

/**
 * Public: Get all published pages filtered by link position
 */
exports.getPublicPages = async (req, res, next) => {
    try {
        const { linkPosition } = req.query;
        // Public view only sees published pages
        const result = await PageService.getPages({ linkPosition }, 1, 100, false);
        // getPages returns { totalItems, data, totalPages, currentPage } for paginated data
        // For public pages, we just return the array of data directly
        return success(res, result.data, 'Pages retrieved successfully');
    } catch (err) {
        next(err);
    }
};

/**
 * Public: Get a single page by slug
 */
exports.getPageBySlug = async (req, res, next) => {
    try {
        const { slug } = req.params;
        const page = await PageService.getPageBySlug(slug, { adminView: false });
        return success(res, page, 'Page retrieved successfully');
    } catch (err) {
        next(err);
    }
};

/**
 * Admin: Get all pages with filters
 */
exports.adminGetPages = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, search, linkPosition } = req.query;
        const result = await PageService.getPages({ status, search, linkPosition }, page, limit, true);
        // result assumes it has: data, totalItems, currentPage. Let's look at getPagingData struct.
        // getPagingData returns { totalItems, data, totalPages, currentPage }
        return paginated(res, result.data, result.totalItems, result.currentPage, limit, 'Pages retrieved successfully');
    } catch (err) {
        next(err);
    }
};

/**
 * Admin: Create a new page
 */
exports.adminCreatePage = async (req, res, next) => {
    try {
        const data = { ...req.body, createdBy: req.user.id };
        const page = await PageService.createPage(data);
        return success(res, page, 'Page created successfully', 201);
    } catch (err) {
        next(err);
    }
};

/**
 * Admin: Get page by ID
 */
exports.adminGetPageById = async (req, res, next) => {
    try {
        const page = await PageService.getPageById(req.params.id);
        return success(res, page, 'Page retrieved successfully');
    } catch (err) {
        next(err);
    }
};

/**
 * Admin: Update a page
 */
exports.adminUpdatePage = async (req, res, next) => {
    try {
        const data = { ...req.body, updatedBy: req.user.id };
        const page = await PageService.updatePage(req.params.id, data);
        return success(res, page, 'Page updated successfully');
    } catch (err) {
        next(err);
    }
};

/**
 * Admin: Delete a page
 */
exports.adminDeletePage = async (req, res, next) => {
    try {
        await PageService.deletePage(req.params.id, req.user.id);
        return success(res, null, 'Page deleted successfully');
    } catch (err) {
        next(err);
    }
};
