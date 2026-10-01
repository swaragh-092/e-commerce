'use strict';

const AppError = require('../../utils/AppError');

const validatePackageProfiles = (profiles) => {
    if (!Array.isArray(profiles)) throw new AppError('INVALID_SHIPPING_PACKAGES', 400, 'Shipping packages must be a list.');
    if (profiles.length > 50) throw new AppError('INVALID_SHIPPING_PACKAGES', 400, 'A maximum of 50 package types can be configured.');
    const ids = new Set();
    for (const profile of profiles) {
        if (!profile || typeof profile !== 'object' || typeof profile.id !== 'string' || !profile.id.trim() || profile.id.length > 100 || !String(profile.name || '').trim() || String(profile.name).trim().length > 100) {
            throw new AppError('INVALID_SHIPPING_PACKAGES', 400, 'Each package needs an id and name.');
        }
        if (ids.has(profile.id)) throw new AppError('INVALID_SHIPPING_PACKAGES', 400, 'Package ids must be unique.');
        ids.add(profile.id);
        for (const key of ['lengthCm', 'breadthCm', 'heightCm', 'emptyWeightGrams', 'maxItems', 'maxContentsWeightGrams']) {
            if (!Number.isFinite(Number(profile[key]))) throw new AppError('INVALID_SHIPPING_PACKAGES', 400, `Package "${profile.name}" needs a valid ${key}.`);
        }
        if (['lengthCm', 'breadthCm', 'heightCm'].some((key) => Number(profile[key]) <= 0.5) ||
            Number(profile.emptyWeightGrams) < 0 || !Number.isSafeInteger(Number(profile.maxItems)) || Number(profile.maxItems) < 1 ||
            Number(profile.maxContentsWeightGrams) <= 0 || !Array.isArray(profile.fits)) {
            throw new AppError('INVALID_SHIPPING_PACKAGES', 400, `Package "${profile.name}" has invalid dimensions or capacity.`);
        }
        const fitKeys = new Set();
        for (const fit of profile.fits) {
            const key = `${fit?.productId}:${fit?.variantId || ''}`;
            if (typeof fit?.productId !== 'string' || !fit.productId.trim() || (fit.variantId != null && typeof fit.variantId !== 'string') || !Number.isSafeInteger(Number(fit.maxQuantity)) || Number(fit.maxQuantity) < 1 || fitKeys.has(key)) {
                throw new AppError('INVALID_SHIPPING_PACKAGES', 400, `Package "${profile.name}" has an invalid or duplicate product fit rule.`);
            }
            fitKeys.add(key);
        }
    }
    return profiles;
};

// Conservative planner: only uses merchant-confirmed per-product fit limits.
// It keeps different products in separate parcels until the merchant can state
// which combinations fit together; this never guesses mixed-item packing.
const planParcels = (items, profiles, { volumetricDivisor = 5000, defaultPackage = null } = {}) => {
    validatePackageProfiles(profiles);
    const parcels = [];
    for (const item of items.filter((entry) => entry.requiresShipping !== false)) {
        const weight = Number(item.weightGrams);
        const quantity = Number(item.quantity);
        if (!Number.isFinite(weight) || weight <= 0 || !Number.isSafeInteger(quantity) || quantity < 1) {
            throw new AppError('MISSING_PRODUCT_MEASUREMENTS', 400, 'A product is missing a valid weight or quantity. Check its shipping details.');
        }
        const candidates = profiles.filter((profile) => profile.enabled !== false).flatMap((profile) => {
            const fit = profile.fits.find((rule) => rule.productId === item.productId && (rule.variantId || null) === (item.variantId || null)) ||
                profile.fits.find((rule) => rule.productId === item.productId && !rule.variantId);
            if (!fit) return [];
            const capacity = Math.min(Number(profile.maxItems), Number(fit.maxQuantity), Math.floor(Number(profile.maxContentsWeightGrams) / weight));
            return capacity > 0 ? [{ profile, capacity, volume: Number(profile.lengthCm) * Number(profile.breadthCm) * Number(profile.heightCm) }] : [];
        }).sort((a, b) => b.capacity - a.capacity || a.volume - b.volume || String(a.profile.id).localeCompare(String(b.profile.id)));
        if (!candidates.length && defaultPackage?.enabled) {
            const sides = [item.lengthCm, item.breadthCm, item.heightCm].map(Number);
            const boxSides = [defaultPackage.lengthCm, defaultPackage.breadthCm, defaultPackage.heightCm].map(Number);
            if (sides.every((side) => Number.isFinite(side) && side > 0.5)) {
                sides.sort((a, b) => a - b);
                boxSides.sort((a, b) => a - b);
                if (sides.some((side, index) => side > boxSides[index])) {
                    throw new AppError('SHIPPING_PACKAGE_CAPACITY_EXCEEDED', 400, `${item.name || 'A product'} does not fit the saved default package. Add a measured package fit rule.`);
                }
            }
            const capacity = Math.min(Number(defaultPackage.maxItems), Math.floor(Number(defaultPackage.maxContentsWeightGrams) / weight));
            if (capacity > 0) {
                const fallback = { ...defaultPackage, id: defaultPackage.id || 'legacy-default-package', name: defaultPackage.name || 'Default package' };
                candidates.push({ profile: fallback, capacity, volume: Number(fallback.lengthCm) * Number(fallback.breadthCm) * Number(fallback.heightCm) });
                candidates.sort((a, b) => b.capacity - a.capacity || a.volume - b.volume || String(a.profile.id).localeCompare(String(b.profile.id)));
            }
        }
        const selectedCandidate = candidates[0];
        if (!selectedCandidate) {
            throw new AppError('SHIPPING_PACKAGE_CAPACITY_EXCEEDED', 400, `No configured package is confirmed to fit ${item.name || 'one of the products'} at the ordered quantity. Update its package fit rules or contact support.`, { productId: item.productId, variantId: item.variantId || null });
        }
        let remaining = quantity;
        while (remaining > 0) {
            const packedQuantity = Math.min(remaining, selectedCandidate.capacity);
            const profile = selectedCandidate.profile;
            const actualWeightGrams = Math.ceil(Number(profile.emptyWeightGrams) + weight * packedQuantity);
            const volumeCm3 = Number(profile.lengthCm) * Number(profile.breadthCm) * Number(profile.heightCm);
            const volumetricWeightGrams = (volumeCm3 / volumetricDivisor) * 1000;
            parcels.push({
                packageId: profile.id,
                parcelId: `parcel-${parcels.length + 1}`,
                packageName: profile.name,
                lengthCm: Number(profile.lengthCm),
                breadthCm: Number(profile.breadthCm),
                heightCm: Number(profile.heightCm),
                actualWeightGrams,
                volumetricWeightGrams,
                chargeableWeightGrams: Math.ceil(Math.max(actualWeightGrams, volumetricWeightGrams) / 500) * 500,
                items: [{ ...item, quantity: packedQuantity }],
            });
            remaining -= packedQuantity;
        }
    }
    return parcels;
};

module.exports = { planParcels, validatePackageProfiles };
