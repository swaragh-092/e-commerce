'use strict';

const AppError = require('../../utils/AppError');

// Capacity is declared by the merchant after checking that products fit.
// No box dimensions, tare weight, or capacity are inferred from the catalog.
const validateDefaultPackage = (value) => {
    if (value == null) return null;
    if (typeof value !== 'object' || Array.isArray(value) || typeof value.enabled !== 'boolean') {
        throw new AppError('INVALID_SHIPPING_PACKAGE', 400, 'Default package must specify whether it is enabled.');
    }
    if (!value.enabled) return null;
    for (const key of ['lengthCm', 'breadthCm', 'heightCm', 'emptyWeightGrams', 'maxItems', 'maxContentsWeightGrams']) {
        if (!['number', 'string'].includes(typeof value[key]) || String(value[key]).trim() === '' || !Number.isFinite(Number(value[key]))) {
            throw new AppError('INVALID_SHIPPING_PACKAGE', 400, `Default package requires a valid ${key}.`);
        }
    }
    if (['lengthCm', 'breadthCm', 'heightCm'].some((key) => Number(value[key]) <= 0.5) ||
        Number(value.emptyWeightGrams) < 0 || Number(value.maxContentsWeightGrams) <= 0 ||
        !Number.isSafeInteger(Number(value.maxItems)) || Number(value.maxItems) < 1) {
        throw new AppError('INVALID_SHIPPING_PACKAGE', 400, 'Package dimensions must exceed 0.5 cm; enter a nonnegative empty weight, a positive capacity weight, and a whole item capacity.');
    }
    return value;
};

module.exports = { validateDefaultPackage };
