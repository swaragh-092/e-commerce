'use strict';
const { success } = require('../../utils/response');
const galleryService = require('./gallery.service');

exports.listAdmin = async (req, res, next) => { try { const { page, limit } = req.query; const result = await galleryService.listAdmin(page, limit); return success(res, result.data, 'Galleries fetched', 200, { total: result.totalItems, page: result.currentPage, totalPages: result.totalPages, limit: result.limit }); } catch (e) { next(e); } };
exports.create = async (req, res, next) => { try { const gallery = await galleryService.createGallery(req.validated); return success(res, gallery, 'Gallery created', 201); } catch (e) { next(e); } };
exports.update = async (req, res, next) => { try { const gallery = await galleryService.updateGallery(req.params.id, req.validated); return success(res, gallery, 'Gallery updated'); } catch (e) { next(e); } };
exports.remove = async (req, res, next) => { try { await galleryService.deleteGallery(req.params.id); return success(res, null, 'Gallery deleted'); } catch (e) { next(e); } };
exports.addItems = async (req, res, next) => { try { const gallery = await galleryService.addItems(req.params.id, req.validated.mediaIds); return success(res, gallery, 'Items added'); } catch (e) { next(e); } };
exports.removeItem = async (req, res, next) => { try { await galleryService.removeItem(req.params.id, req.params.itemId); return success(res, null, 'Item removed'); } catch (e) { next(e); } };
exports.reorderItems = async (req, res, next) => { try { const gallery = await galleryService.reorderItems(req.params.id, req.validated.itemIds); return success(res, gallery, 'Gallery reordered'); } catch (e) { next(e); } };
exports.publicView = async (req, res, next) => { try { const { page, limit } = req.query; const result = await galleryService.getPublicGallery(req.params.slug, page, limit); return success(res, { gallery: result.gallery, items: result.paging.data }, 'Gallery fetched', 200, { total: result.paging.totalItems, page: result.paging.currentPage, totalPages: result.paging.totalPages, limit: result.paging.limit }); } catch (e) { next(e); } };
