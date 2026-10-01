'use strict';

const AppError = require('../../utils/AppError');
const { validatePackageProfiles } = require('./shipping.packages');

const validateShippingSetting = (key, value) => {
    const invalid = (message) => { throw new AppError('INVALID_SHIPPING_CONFIGURATION', 400, message); };
    if (key === 'pricingMode' && !['standard', 'rules', 'carrier'].includes(value)) invalid('Choose standard pricing, advanced shipping rules, or carrier-calculated delivery.');
    if (key === 'method' && !['flat_rate', 'free', 'free_above_threshold'].includes(value)) invalid('Choose a valid standard delivery pricing method.');
    if (['flatRate', 'freeThreshold'].includes(key) && (
        !['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(Number(value)) || Number(value) < 0
    )) invalid('Delivery fees and thresholds must be non-negative numbers.');
    if (['serviceablePincodes', 'blockedPincodes'].includes(key)) {
        if (!Array.isArray(value) && typeof value !== 'string') invalid('Delivery coverage must be a list of pincodes.');
        const entries = Array.isArray(value) ? value : value.trim() === '' ? [] : value.split(',');
        if (entries.some((entry) => !/^\d{6}$/.test(String(entry).trim()))) invalid('Enter 6-digit Indian delivery pincodes separated by commas.');
    }
    if (key === 'packageProfiles') validatePackageProfiles(value);
};

module.exports = { validateShippingSetting };
