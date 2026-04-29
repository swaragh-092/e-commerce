'use strict';

const ShippingService = require('./shipping.service');
const { success } = require('../../utils/response');

const calculate = async (req, res, next) => {
    try {
        const quote = await ShippingService.createQuote(req.user.id, req.validated);
        return success(res, quote, 'Shipping calculated successfully');
    } catch (err) {
        next(err);
    }
};

const listProviders = async (req, res, next) => {
    try {
        return success(res, await ShippingService.listProviders());
    } catch (err) {
        next(err);
    }
};

const updateProvider = async (req, res, next) => {
    try {
        return success(res, await ShippingService.updateProvider(req.params.id, req.validated), 'Shipping provider updated successfully');
    } catch (err) {
        next(err);
    }
};

const listZones = async (req, res, next) => {
    try {
        return success(res, await ShippingService.listZones());
    } catch (err) {
        next(err);
    }
};

const createZone = async (req, res, next) => {
    try {
        return success(res, await ShippingService.createZone(req.validated), 'Shipping zone created successfully', 201);
    } catch (err) {
        next(err);
    }
};

const updateZone = async (req, res, next) => {
    try {
        return success(res, await ShippingService.updateZone(req.params.id, req.validated), 'Shipping zone updated successfully');
    } catch (err) {
        next(err);
    }
};

const deleteZone = async (req, res, next) => {
    try {
        return success(res, await ShippingService.deleteZone(req.params.id), 'Shipping zone deleted successfully');
    } catch (err) {
        next(err);
    }
};

const listRules = async (req, res, next) => {
    try {
        return success(res, await ShippingService.listRules());
    } catch (err) {
        next(err);
    }
};

const createRule = async (req, res, next) => {
    try {
        return success(res, await ShippingService.createRule(req.validated, req.user.id), 'Shipping rule created successfully', 201);
    } catch (err) {
        next(err);
    }
};

const updateRule = async (req, res, next) => {
    try {
        return success(res, await ShippingService.updateRule(req.params.id, req.validated, req.user.id), 'Shipping rule updated successfully');
    } catch (err) {
        next(err);
    }
};

const deleteRule = async (req, res, next) => {
    try {
        return success(res, await ShippingService.deleteRule(req.params.id, req.user.id), 'Shipping rule deleted successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = {
    calculate,
    listProviders,
    updateProvider,
    listZones,
    createZone,
    updateZone,
    deleteZone,
    listRules,
    createRule,
    updateRule,
    deleteRule,
};
