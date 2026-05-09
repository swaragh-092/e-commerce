'use strict';
const mediaService = require('./media.service');
const { success } = require('../../utils/response');

exports.upload = async (req, res, next) => {
    try {
        const media = await mediaService.uploadMedia(req.file);
        return success(res, { media }, 'File uploaded successfully', 201);
    } catch (err) {
        next(err);
    }
};

exports.list = async (req, res, next) => {
    try {
        const { page, limit, sortBy, sortDir } = req.query;
        const result = await mediaService.listMedia(page, limit, sortBy, sortDir);
        return success(res, result.data, 'Media found', 200, {
            total: result.totalItems,
            page: result.currentPage,
            totalPages: result.totalPages,
            limit: result.limit
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
        next(err);
    }
};

exports.update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const media = await mediaService.updateMedia(id, req.validated);
        
        // Prepare audit changes
        req._auditChanges = {
            id,
            alt: req.validated.alt,
            description: req.validated.description,
            caption: req.validated.caption,
            originalName: req.validated.originalName
        };

        return success(res, { media }, 'Media updated successfully');
    } catch (err) {
        next(err);
    }
};
