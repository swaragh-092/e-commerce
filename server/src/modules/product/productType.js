'use strict';
const AppError = require('../../utils/AppError');

const assertVariableProduct = (product) => {
    if (product.type !== 'variable') throw new AppError('VALIDATION_ERROR', 400, 'Save the product as Variable Product before adding variants.');
};

const validateProductTypeChange = (product, data, { hasVariants = false, hasComboItems = false } = {}) => {
    const nextType = data.type || product.type || 'simple';
    // Older products may be labelled Simple despite having variants. Allow
    // ordinary edits without forcing an inventory type change.
    const keepsLegacySimple = product.type === 'simple' && nextType === 'simple';
    if (nextType !== 'variable' && ((hasVariants && !keepsLegacySimple) || data.variants !== undefined)) {
        throw new AppError('VALIDATION_ERROR', 400, 'This product has variants. Keep Variable Product, or remove all variants before changing its type.');
    }
    if (nextType !== 'combo' && hasComboItems) {
        throw new AppError('VALIDATION_ERROR', 400, 'Clear the bundle items before changing this product type.');
    }
    if (nextType !== product.type && Number(product.reservedQty || 0) > 0) {
        throw new AppError('CONFLICT', 409, 'Finish or cancel orders reserving this product before changing its type.');
    }
    const resetInventory = product.type === 'simple' && nextType !== 'simple' && !hasVariants && Number(product.quantity || 0) > 0;
    if (resetInventory && !data.confirmInventoryReset) {
        throw new AppError('VALIDATION_ERROR', 400, 'Confirm clearing the standalone stock before switching to variant or bundle inventory. Stock is not automatically distributed to variants.');
    }
    return { nextType, resetInventory };
};

module.exports = { assertVariableProduct, validateProductTypeChange };
