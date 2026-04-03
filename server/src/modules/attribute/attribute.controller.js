'use strict';

const attributeService = require('./attribute.service');
const { success, error } = require('../../utils/response');

// --- Attribute Template CRUD ---

exports.createAttribute = async (req, res, next) => {
    try {
        const result = await attributeService.createAttribute(req.body);
        return success(res, result, 'Attribute created', 201);
    } catch (err) {
        next(err);
    }
};

exports.getAllAttributes = async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const result = await attributeService.getAllAttributes(page, limit);
        return success(res, result, 'Attributes retrieved');
    } catch (err) {
        next(err);
    }
};

exports.getAttributeById = async (req, res, next) => {
    try {
        const result = await attributeService.getAttributeById(req.params.id);
        return success(res, result, 'Attribute retrieved');
    } catch (err) {
        next(err);
    }
};

exports.updateAttribute = async (req, res, next) => {
    try {
        const result = await attributeService.updateAttribute(req.params.id, req.body);
        return success(res, result, 'Attribute updated');
    } catch (err) {
        next(err);
    }
};

exports.deleteAttribute = async (req, res, next) => {
    try {
        await attributeService.deleteAttribute(req.params.id);
        return success(res, null, 'Attribute deleted');
    } catch (err) {
        next(err);
    }
};

// --- Attribute Value CRUD ---

exports.addValue = async (req, res, next) => {
    try {
        const result = await attributeService.addValue(req.params.id, req.body);
        return success(res, result, 'Value added', 201);
    } catch (err) {
        next(err);
    }
};

exports.removeValue = async (req, res, next) => {
    try {
        await attributeService.removeValue(req.params.attrId, req.params.valueId);
        return success(res, null, 'Value removed');
    } catch (err) {
        next(err);
    }
};

// --- Category-Attribute linking ---

exports.getCategoryAttributes = async (req, res, next) => {
    try {
        const inherit = req.query.inherit === 'true';
        const result = await attributeService.getCategoryAttributes(req.params.id, inherit);
        return success(res, result, 'Category attributes retrieved');
    } catch (err) {
        next(err);
    }
};

exports.linkAttributeToCategory = async (req, res, next) => {
    try {
        const result = await attributeService.linkAttributeToCategory(req.params.id, req.body.attributeId);
        return success(res, result, 'Attribute linked to category', 201);
    } catch (err) {
        next(err);
    }
};

exports.unlinkAttributeFromCategory = async (req, res, next) => {
    try {
        await attributeService.unlinkAttributeFromCategory(req.params.id, req.params.attrId);
        return success(res, null, 'Attribute unlinked from category');
    } catch (err) {
        next(err);
    }
};

// --- Bulk Variant Generator ---

exports.bulkGenerateVariants = async (req, res, next) => {
    try {
        const result = await attributeService.bulkGenerateVariants(req.params.id, req.body.attributes);
        return success(res, result, 'Variants generated', 201);
    } catch (err) {
        next(err);
    }
};

// --- Clone Variants ---

exports.cloneVariants = async (req, res, next) => {
    try {
        const result = await attributeService.cloneVariants(req.params.id, req.body.sourceProductId);
        return success(res, result, 'Variants cloned', 201);
    } catch (err) {
        next(err);
    }
};
