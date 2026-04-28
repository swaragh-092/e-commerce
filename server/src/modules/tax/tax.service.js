'use strict';

const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

// Settings and product tax configs are stored as decimal factors in the admin UI
// (0.09 = 9%). This also tolerates legacy percentage values (9 = 9%).
const normalizeRate = (value) => {
    const number = toNumber(value, 0);
    if (Math.abs(number) <= 1) return number;
    return number / 100;
};

const formatRatePercent = (rate) => Number((normalizeRate(rate) * 100).toFixed(4));

/**
 * Resolves the effective tax rates for a product based on its custom config
 * and the global store settings.
 * 
 * @param {Object} product - Product model instance with taxConfig
 * @param {Object} settingsMap - Map of global settings
 * @returns {Object} Normalized tax configuration
 */
const getEffectiveTax = (product, settingsMap) => {
    const taxConfig = product.taxConfig;

    if (taxConfig && taxConfig.isCustom) {
        return {
            isCustom: true,
            sgst: normalizeRate(taxConfig.sgst || 0),
            cgst: normalizeRate(taxConfig.cgst || 0),
            igst: normalizeRate(taxConfig.igst || 0),
            flatRate: normalizeRate(taxConfig.flatRate || taxConfig.rate || 0),
            inclusive: !!taxConfig.inclusive,
            useGST: !!(taxConfig.sgst || taxConfig.cgst || taxConfig.igst)
        };
    }

    // Global Fallback
    const enableCGST = settingsMap['tax.enableCGST'] === true || settingsMap['tax.enableCGST'] === 'true';
    const enableSGST = settingsMap['tax.enableSGST'] === true || settingsMap['tax.enableSGST'] === 'true';
    const enableIGST = settingsMap['tax.enableIGST'] === true || settingsMap['tax.enableIGST'] === 'true';
    const useGST = enableCGST || enableSGST || enableIGST;
    
    // Inclusive only applies if not using GST components (Global logic)
    const inclusive = !useGST && (settingsMap['tax.inclusive'] === true || settingsMap['tax.inclusive'] === 'true');

    return {
        isCustom: false,
        sgst: enableSGST ? normalizeRate(settingsMap['tax.sgstRate'] || 0) : 0,
        cgst: enableCGST ? normalizeRate(settingsMap['tax.cgstRate'] || 0) : 0,
        igst: enableIGST ? normalizeRate(settingsMap['tax.igstRate'] || 0) : 0,
        flatRate: !useGST ? normalizeRate(settingsMap['tax.rate'] || 0) : 0,
        inclusive,
        useGST
    };
};

/**
 * Computes the tax breakdown for a specific item subtotal based on location.
 * 
 * @param {Object} effectiveTax - Output from getEffectiveTax
 * @param {Number} itemSubtotal - Price * Quantity
 * @param {String} destinationState - Shipping address state
 * @param {String} originState - Store origin state from settings
 * @returns {Object} Breakdown with individual tax components
 */
const computeItemTax = (effectiveTax, itemSubtotal, destinationState = '', originState = '') => {
    const isIntraState = !destinationState || !originState || 
        destinationState.trim().toLowerCase() === originState.trim().toLowerCase();

    let sgst = 0;
    let cgst = 0;
    let igst = 0;
    let flatTax = 0;

    if (effectiveTax.inclusive) {
        // Amount is already inclusive of tax. Calculate back if needed for reporting.
        // But for checkout total, we add nothing.
        // For simplicity in this implementation, we focus on the total addition.
        return {
            sgst: 0,
            cgst: 0,
            igst: 0,
            flatTax: 0,
            totalTax: 0,
            isInclusive: true,
            rates: {
                sgst: formatRatePercent(effectiveTax.sgst),
                cgst: formatRatePercent(effectiveTax.cgst),
                igst: formatRatePercent(effectiveTax.igst),
                flatTax: formatRatePercent(effectiveTax.flatRate),
            }
        };
    }

    if (effectiveTax.useGST) {
        if (isIntraState) {
            sgst = itemSubtotal * effectiveTax.sgst;
            cgst = itemSubtotal * effectiveTax.cgst;
        } else {
            igst = itemSubtotal * effectiveTax.igst;
        }
    } else {
        flatTax = itemSubtotal * (effectiveTax.flatRate || 0);
    }

    // Round components first to ensure consistency between individual values and total
    const roundedSgst = Number(sgst.toFixed(2));
    const roundedCgst = Number(cgst.toFixed(2));
    const roundedIgst = Number(igst.toFixed(2));
    const roundedFlatTax = Number(flatTax.toFixed(2));

    // Total must be the sum of rounded components to avoid off-by-one discrepancies
    const totalTax = Number((roundedSgst + roundedCgst + roundedIgst + roundedFlatTax).toFixed(2));

    return {
        sgst: roundedSgst,
        cgst: roundedCgst,
        igst: roundedIgst,
        flatTax: roundedFlatTax,
        totalTax,
        isInclusive: false,
        rates: {
            sgst: formatRatePercent(effectiveTax.sgst),
            cgst: formatRatePercent(effectiveTax.cgst),
            igst: formatRatePercent(effectiveTax.igst),
            flatTax: formatRatePercent(effectiveTax.flatRate),
        }
    };
};

const summarizeTaxBreakdown = (itemBreakdowns = [], metadata = {}) => {
    const totals = itemBreakdowns.reduce((acc, breakdown) => {
        acc.sgst += toNumber(breakdown?.sgst);
        acc.cgst += toNumber(breakdown?.cgst);
        acc.igst += toNumber(breakdown?.igst);
        acc.flatTax += toNumber(breakdown?.flatTax);
        acc.totalTax += toNumber(breakdown?.totalTax);
        acc.isInclusive = acc.isInclusive || Boolean(breakdown?.isInclusive);
        return acc;
    }, { sgst: 0, cgst: 0, igst: 0, flatTax: 0, totalTax: 0, isInclusive: false });

    const round = (value) => Number(value.toFixed(2));

    return {
        cgst: round(totals.cgst),
        sgst: round(totals.sgst),
        igst: round(totals.igst),
        flatTax: round(totals.flatTax),
        totalTax: round(totals.totalTax),
        isInclusive: totals.isInclusive,
        originState: metadata.originState || '',
        destinationState: metadata.destinationState || '',
        components: itemBreakdowns,
    };
};

module.exports = {
    getEffectiveTax,
    computeItemTax,
    summarizeTaxBreakdown,
    normalizeRate,
};
