'use strict';
const mediaService = require('./media.service');
const { success, error } = require('../../utils/response');

exports.upload = async (req, res, next) => {
    try {
        if (!req.file) return error(res, 'No file uploaded', 400, 'BAD_REQUEST');
        const media = await mediaService.uploadMedia(req.file);
        return success(res, { media }, 'File uploaded successfully', 201);
    } catch (err) {
        if (err.message.includes('Invalid file type')) return error(res, err.message, 400, 'BAD_REQUEST');
        next(err);
    }
};

exports.list = async (req, res, next) => {
    try {
        const { page, limit } = req.query;
        const result = await mediaService.listMedia(page, limit);
        return success(res, result.data, 'Media found', 200, {
            total: result.totalItems,
            page: result.currentPage,
            totalPages: result.totalPages,
            limit: parseInt(limit) || 20
        });
    } catch (err) {
        next(err);
    }
};

exports.delete = async (req, res, next) => {
    try {
        await mediaService.deleteMedia(req.params.id);
        return success(res, null, 'Media deleted');
    } catch (err) {
        if (err.message === 'Media not found') return error(res, err.message, 404, 'NOT_FOUND');
        next(err);
    }
};
