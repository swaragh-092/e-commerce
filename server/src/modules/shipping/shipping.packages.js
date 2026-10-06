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
            Number(profile.maxContentsWeightGrams) <= 0 || (profile.fits != null && !Array.isArray(profile.fits))) {
            throw new AppError('INVALID_SHIPPING_PACKAGES', 400, `Package "${profile.name}" has invalid dimensions or capacity.`);
        }
        profile.fits = Array.isArray(profile.fits) ? profile.fits : [];
        const fitKeys = new Set();
        for (const fit of profile.fits) {
            const key = `${fit?.productId}:${fit?.variantId || ''}`;
            if (typeof fit?.productId !== 'string' || !fit.productId.trim() || (fit.variantId != null && typeof fit.variantId !== 'string') ||
                (fit.mixGroup != null && (typeof fit.mixGroup !== 'string' || fit.mixGroup.trim().length > 80)) ||
                !Number.isSafeInteger(Number(fit.maxQuantity)) || Number(fit.maxQuantity) < 1 || fitKeys.has(key)) {
                throw new AppError('INVALID_SHIPPING_PACKAGES', 400, `Package "${profile.name}" has an invalid or duplicate product fit rule.`);
            }
            fitKeys.add(key);
        }
    }
    return profiles;
};

const areMixGroupsCompatible = (groupA, groupB) => {
    const a = typeof groupA === 'string' && groupA.trim() ? groupA.trim().toLowerCase() : null;
    const b = typeof groupB === 'string' && groupB.trim() ? groupB.trim().toLowerCase() : null;
    if (!a && !b) return true; // Both are general goods without restrictions -> compatible!
    if (a && b && a === b) return true; // Same explicit mix group -> compatible!
    return false; // Incompatible mix groups -> must remain separate
};

// Uses merchant-confirmed per-product limits. Compatible products share a parcel up to box capacity.
const planParcels = (items, profiles, { volumetricDivisor = 5000, defaultPackage = null } = {}) => {
    validatePackageProfiles(profiles);
    const parcels = [];
    const shippingItems = items.filter((entry) => entry.requiresShipping !== false).map((item) => {
        const weight = Number(item.weightGrams);
        const quantity = Number(item.quantity);
        if (!Number.isFinite(weight) || weight <= 0 || !Number.isSafeInteger(quantity) || quantity < 1) {
            throw new AppError('MISSING_PRODUCT_MEASUREMENTS', 400, 'A product is missing a valid weight or quantity. Check its shipping details.');
        }
        let candidates = profiles.filter((profile) => profile.enabled !== false).flatMap((profile) => {
            const fit = profile.fits?.find((rule) => rule.productId === item.productId && (rule.variantId || null) === (item.variantId || null)) ||
                profile.fits?.find((rule) => rule.productId === item.productId && !rule.variantId);
            
            // 1. Explicit fit rule override if configured by merchant
            if (fit) {
                const capacity = Math.min(Number(profile.maxItems), Number(fit.maxQuantity), Math.floor(Number(profile.maxContentsWeightGrams) / weight));
                return capacity > 0 ? [{
                    profile,
                    fit,
                    capacity,
                    volume: Number(profile.lengthCm) * Number(profile.breadthCm) * Number(profile.heightCm),
                    mixGroup: fit.mixGroup || item.mixGroup || null,
                }] : [];
            }

            // 2. Inverted matrix (Shopify model): box presets (fits: []) auto-fit products carrying physical dimensions
            const isPresetBox = !profile.fits || profile.fits.length === 0;
            if (!isPresetBox && !fit) return [];

            const itemSides = [item.lengthCm, item.breadthCm, item.heightCm].map(Number);
            const boxSides = [profile.lengthCm, profile.breadthCm, profile.heightCm].map(Number);
            const hasValidDims = itemSides.every((side) => Number.isFinite(side) && side > 0.5);
            if (!hasValidDims) return [];

            itemSides.sort((a, b) => a - b);
            boxSides.sort((a, b) => a - b);
            const physicallyFits = itemSides.every((side, index) => side <= boxSides[index]);
            if (!physicallyFits) return [];

            const capacity = Math.min(Number(profile.maxItems), Math.floor(Number(profile.maxContentsWeightGrams) / weight));
            return capacity > 0 ? [{
                profile,
                fit: null,
                capacity,
                volume: Number(profile.lengthCm) * Number(profile.breadthCm) * Number(profile.heightCm),
                mixGroup: item.mixGroup || null,
            }] : [];
        }).sort((a, b) => a.volume - b.volume || b.capacity - a.capacity || String(a.profile.id).localeCompare(String(b.profile.id)));
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
        if (!candidates.length) {
            throw new AppError('SHIPPING_PACKAGE_CAPACITY_EXCEEDED', 400, `No configured package is confirmed to fit ${item.name || 'one of the products'} at the ordered quantity. Update its package fit rules or contact support.`, { productId: item.productId, variantId: item.variantId || null });
        }
        candidates.sort((a, b) => b.capacity - a.capacity || a.volume - b.volume || String(a.profile.id).localeCompare(String(b.profile.id)));
        return { item, weight, quantity, candidates };
    }).sort((a, b) => a.candidates.length - b.candidates.length || b.weight - a.weight || b.quantity - a.quantity || String(a.item.productId).localeCompare(String(b.item.productId)));

    const makeParcel = (profile, mixGroup = null) => ({
        packageId: profile.id,
        parcelId: '',
        packageName: profile.name,
        lengthCm: Number(profile.lengthCm),
        breadthCm: Number(profile.breadthCm),
        heightCm: Number(profile.heightCm),
        actualWeightGrams: Math.ceil(Number(profile.emptyWeightGrams)),
        volumetricWeightGrams: (Number(profile.lengthCm) * Number(profile.breadthCm) * Number(profile.heightCm) / volumetricDivisor) * 1000,
        chargeableWeightGrams: 0,
        items: [],
        _contentsWeightGrams: 0,
        _mixGroup: mixGroup,
        _maxItems: Number(profile.maxItems),
        _maxContentsWeightGrams: Number(profile.maxContentsWeightGrams),
        _profile: profile,
    });
    const addToParcel = (parcel, item, quantity, weight) => {
        const existing = parcel.items.find((entry) => entry.productId === item.productId && (entry.variantId || null) === (item.variantId || null));
        if (existing) existing.quantity += quantity;
        else parcel.items.push({ ...item, quantity });
        parcel._contentsWeightGrams += weight * quantity;
        parcel.actualWeightGrams = Math.ceil(Number(parcel._profile.emptyWeightGrams) + parcel._contentsWeightGrams);
        parcel.chargeableWeightGrams = Math.ceil(Math.max(parcel.actualWeightGrams, parcel.volumetricWeightGrams) / 500) * 500;
    };

    for (const { item, weight, quantity, candidates } of shippingItems) {
        let remaining = quantity;
        while (remaining > 0) {
            const existingCompatible = parcels.flatMap((parcel) => {
                const candidate = candidates.find((entry) =>
                    entry.profile.id === parcel.packageId &&
                    areMixGroupsCompatible(parcel._mixGroup, entry.fit?.mixGroup || entry.mixGroup)
                );
                if (!candidate) return [];
                const fit = parcel._profile.fits?.find((rule) => rule.productId === item.productId && (rule.variantId || null) === (item.variantId || null)) ||
                    parcel._profile.fits?.find((rule) => rule.productId === item.productId && !rule.variantId);
                const currentSkuQty = parcel.items
                    .filter((entry) => entry.productId === item.productId && (!fit?.variantId || (entry.variantId || null) === (fit.variantId || null)))
                    .reduce((sum, entry) => sum + Number(entry.quantity), 0);
                const fitRemaining = fit ? Number(fit.maxQuantity) - currentSkuQty : Infinity;
                const available = Math.min(
                    fitRemaining,
                    parcel._maxItems - parcel.items.reduce((sum, entry) => sum + Number(entry.quantity), 0),
                    Math.floor((parcel._maxContentsWeightGrams - parcel._contentsWeightGrams) / weight)
                );
                return available > 0 ? [{ parcel, available }] : [];
            }).sort((a, b) => b.available - a.available);

            if (existingCompatible.length) {
                const { parcel, available } = existingCompatible[0];
                const packedQuantity = Math.min(remaining, available);
                addToParcel(parcel, item, packedQuantity, weight);
                remaining -= packedQuantity;
                continue;
            }

            const singleCandidates = candidates;
            // Preserve the minimum parcel count, then use the smallest eligible
            // box. Re-evaluate the remainder instead of reusing an oversized box.
            const maxCapacity = Math.max(...singleCandidates.map((candidate) => candidate.capacity));
            const minimumParcels = Math.ceil(remaining / maxCapacity);
            const eligible = singleCandidates.filter((candidate) =>
                1 + Math.ceil(Math.max(0, remaining - candidate.capacity) / maxCapacity) === minimumParcels);
            const selectedCandidate = eligible.sort((a, b) => a.volume - b.volume ||
                Number(a.profile.emptyWeightGrams) - Number(b.profile.emptyWeightGrams) ||
                String(a.profile.id).localeCompare(String(b.profile.id)))[0];
            const packedQuantity = Math.min(remaining, selectedCandidate.capacity);
            const parcelMixGroup = selectedCandidate.fit?.mixGroup?.trim() || selectedCandidate.mixGroup?.trim() || null;
            const parcel = makeParcel(selectedCandidate.profile, parcelMixGroup);
            addToParcel(parcel, item, packedQuantity, weight);
            parcels.push(parcel);
            remaining -= packedQuantity;
        }
    }
    parcels.forEach((parcel, index) => {
        parcel.parcelId = `parcel-${index + 1}`;
        delete parcel._contentsWeightGrams;
        delete parcel._mixGroup;
        delete parcel._maxItems;
        delete parcel._maxContentsWeightGrams;
        delete parcel._profile;
    });
    return parcels;
};

module.exports = { planParcels, validatePackageProfiles };
