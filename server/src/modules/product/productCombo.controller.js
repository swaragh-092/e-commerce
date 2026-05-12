'use strict';

const productComboService = require('./productCombo.service');
const { success, error } = require('../../utils/response');

// GET /api/products/:id/combo-items
exports.getComboItems = async (req, res, next) => {
    try {
        const items = await productComboService.getComboItems(req.params.id);
        return success(res, items, 'Combo items retrieved');
    } catch (err) {
        if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
            return error(res, err.message, 404, 'NOT_FOUND');
        }
        next(err);
    }
};

// PUT /api/products/:id/combo-items  (full sync)
exports.syncComboItems = async (req, res, next) => {
    try {
        if (!req.body || !Array.isArray(req.body.items)) {
            return error(res, 'Items array is required in request body', 400, 'VALIDATION_ERROR');
        }
        const items = await productComboService.syncComboItems(req.params.id, req.body.items);
        return success(res, items, 'Combo items saved');
    } catch (err) {
        if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
            return error(res, err.message, 404, 'NOT_FOUND');
        }
        if (err.code === 'VALIDATION_ERROR' || err.statusCode === 400) {
            return error(res, err.message, 400, 'VALIDATION_ERROR');
        }
        next(err);
    }
};

// GET /api/products/:id/combo-items/stock
exports.getVirtualStock = async (req, res, next) => {
    try {
        const stock = await productComboService.getVirtualStock(req.params.id);
        return success(res, { stock }, 'Virtual stock calculated');
    } catch (err) {
        if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
            return error(res, err.message, 404, 'NOT_FOUND');
        }
        next(err);
    }
};

// GET /api/products/:id/combo-items/suggested-price
exports.getSuggestedPrice = async (req, res, next) => {
    try {
        const price = await productComboService.getSuggestedPrice(req.params.id);
        return success(res, { suggestedPrice: price }, 'Suggested price calculated');
    } catch (err) {
        if (err.code === 'NOT_FOUND' || err.statusCode === 404) {
            return error(res, err.message, 404, 'NOT_FOUND');
        }
        next(err);
    }
};
