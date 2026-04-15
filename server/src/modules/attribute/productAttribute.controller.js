'use strict';

const productAttributeService = require('./productAttribute.service');
const { success } = require('../../utils/response');

exports.getProductAttributes = async (req, res, next) => {
    try {
        const result = await productAttributeService.getProductAttributes(req.params.id);
        return success(res, result, 'Product attributes retrieved');
    } catch (err) {
        next(err);
    }
};

exports.addProductAttribute = async (req, res, next) => {
    try {
        const result = await productAttributeService.addProductAttribute(req.params.id, req.body);
        return success(res, result, 'Product attribute added', 201);
    } catch (err) {
        next(err);
    }
};

exports.updateProductAttribute = async (req, res, next) => {
    try {
        const result = await productAttributeService.updateProductAttribute(
            req.params.id,
            req.params.attrId,
            req.body
        );
        return success(res, result, 'Product attribute updated');
    } catch (err) {
        next(err);
    }
};

exports.deleteProductAttribute = async (req, res, next) => {
    try {
        await productAttributeService.deleteProductAttribute(req.params.id, req.params.attrId);
        return success(res, null, 'Product attribute removed');
    } catch (err) {
        next(err);
    }
};
