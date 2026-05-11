'use strict';

const productTabService = require('./productTab.service');
const { success, error } = require('../../utils/response');

// GET /api/products/:id/tabs
exports.list = async (req, res, next) => {
    try {
        const tabs = await productTabService.getTabsForProduct(req.params.id);
        return success(res, tabs, 'Tabs retrieved');
    } catch (err) {
        if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
            return error(res, err.message, 404, 'NOT_FOUND');
        }
        next(err);
    }
};

// POST /api/products/:id/tabs
exports.create = async (req, res, next) => {
    try {
        const tab = await productTabService.createTab(req.params.id, req.body);
        return success(res, tab, 'Tab created', 201);
    } catch (err) {
        if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
            return error(res, err.message, 404, 'NOT_FOUND');
        }
        next(err);
    }
};

// PUT /api/products/:id/tabs/:tabId
exports.update = async (req, res, next) => {
    try {
        const tab = await productTabService.updateTab(req.params.id, req.params.tabId, req.body);
        return success(res, tab, 'Tab updated');
    } catch (err) {
        if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
            return error(res, err.message, 404, 'NOT_FOUND');
        }
        next(err);
    }
};

// DELETE /api/products/:id/tabs/:tabId
exports.remove = async (req, res, next) => {
    try {
        await productTabService.deleteTab(req.params.id, req.params.tabId);
        return success(res, null, 'Tab deleted');
    } catch (err) {
        if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
            return error(res, err.message, 404, 'NOT_FOUND');
        }
        next(err);
    }
};

// PUT /api/products/:id/tabs/reorder
exports.reorder = async (req, res, next) => {
    try {
        const tabs = await productTabService.reorderTabs(req.params.id, req.body.order);
        return success(res, tabs, 'Tabs reordered');
    } catch (err) {
        if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
            return error(res, err.message, 404, 'NOT_FOUND');
        }
        next(err);
    }
};

// PUT /api/products/:id/tabs  (full sync)
exports.sync = async (req, res, next) => {
    try {
        const tabs = await productTabService.syncTabs(req.params.id, req.body.tabs);
        return success(res, tabs, 'Tabs saved');
    } catch (err) {
        if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
            return error(res, err.message, 404, 'NOT_FOUND');
        }
        next(err);
    }
};
