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
            Number(profile.maxContentsWeightGrams) <= 0) {
            throw new AppError('INVALID_SHIPPING_PACKAGES', 400, `Package "${profile.name}" has invalid dimensions or capacity.`);
        }
        const hasInner = profile.innerLengthCm != null || profile.innerBreadthCm != null || profile.innerHeightCm != null;
        if (hasInner) {
            for (const key of ['innerLengthCm', 'innerBreadthCm', 'innerHeightCm']) {
                if (!Number.isFinite(Number(profile[key])) || Number(profile[key]) <= 0.5) {
                    throw new AppError('INVALID_SHIPPING_PACKAGES', 400, `Package "${profile.name}" inner dimensions must all be numbers greater than 0.5 cm.`);
                }
            }
            if (Number(profile.innerLengthCm) > Number(profile.lengthCm) ||
                Number(profile.innerBreadthCm) > Number(profile.breadthCm) ||
                Number(profile.innerHeightCm) > Number(profile.heightCm)) {
                throw new AppError('INVALID_SHIPPING_PACKAGES', 400, `Package "${profile.name}" inner dimensions cannot exceed exterior dimensions.`);
            }
        }
        // Legacy per-product fit rules are no longer supported. Planning is
        // proven purely by measured dimensions, weight, volume and item count;
        // any stored fit matrix is dropped so it can never invent a fit,
        // bypass a missing measurement, or override grouping again.
        if (profile.fits != null) delete profile.fits;
    }
    return profiles;
};

const getUsableDimensions = (profile) => {
    const hasInner = profile.innerLengthCm != null && profile.innerBreadthCm != null && profile.innerHeightCm != null &&
        Number(profile.innerLengthCm) > 0.5 && Number(profile.innerBreadthCm) > 0.5 && Number(profile.innerHeightCm) > 0.5;
    const l = hasInner ? Number(profile.innerLengthCm) : Number(profile.lengthCm);
    const b = hasInner ? Number(profile.innerBreadthCm) : Number(profile.breadthCm);
    const h = hasInner ? Number(profile.innerHeightCm) : Number(profile.heightCm);
    return {
        lengthCm: l,
        breadthCm: b,
        heightCm: h,
        volumeCm3: l * b * h,
        sortedSides: [l, b, h].sort((x, y) => x - y),
    };
};

const getItemDimensions = (item) => {
    const rawSides = [item.lengthCm, item.breadthCm, item.heightCm].map(Number);
    const hasValidDims = rawSides.every((s) => Number.isFinite(s) && s > 0.5);
    if (!hasValidDims) {
        return { hasValidDims: false, sortedSides: [], volumeCm3: 0 };
    }
    return {
        hasValidDims: true,
        sortedSides: [...rawSides].sort((x, y) => x - y),
        volumeCm3: rawSides[0] * rawSides[1] * rawSides[2],
    };
};

const areMixGroupsCompatible = (groupA, groupB) => {
    const a = typeof groupA === 'string' && groupA.trim() ? groupA.trim().toLowerCase() : null;
    const b = typeof groupB === 'string' && groupB.trim() ? groupB.trim().toLowerCase() : null;
    if (!a && !b) return true; // Both are general goods without restrictions -> compatible
    if (a && b && a === b) return true; // Same explicit mix group -> compatible
    return false; // Incompatible mix groups -> must remain separate
};

// Sort tiebreak only: prefer the merchant default box when two candidates
// are otherwise identical. Unknown ids never match, so this is always safe.
const preferDefaultBox = (defaultPackageId) => (idA, idB) => {
    if (!defaultPackageId) return 0;
    if (idA === defaultPackageId && idB !== defaultPackageId) return -1;
    if (idB === defaultPackageId && idA !== defaultPackageId) return 1;
    return 0;
};

const getProfileItemCapacity = (profile, item, weight) => {
    const usable = getUsableDimensions(profile);
    const itemDims = getItemDimensions(item);

    // No guessing: a unit without valid measured dimensions fits no preset box.
    if (!itemDims.hasValidDims) {
        return { fits: false, capacity: 0, fit: null, mixGroup: null };
    }

    const physicallyFits = itemDims.sortedSides.every((side, index) => side <= usable.sortedSides[index]);
    if (!physicallyFits) return { fits: false, capacity: 0, fit: null, mixGroup: null };

    const maxByVol = itemDims.volumeCm3 > 0
        ? Math.floor(usable.volumeCm3 / itemDims.volumeCm3)
        : Infinity;
    const maxByWeight = Math.floor(Number(profile.maxContentsWeightGrams) / weight);
    const maxByItems = Number(profile.maxItems);

    const capacity = Math.min(maxByVol, maxByWeight, maxByItems);
    if (capacity <= 0) return { fits: false, capacity: 0, fit: null, mixGroup: null };

    return {
        fits: true,
        capacity,
        fit: null,
        mixGroup: item.mixGroup || null,
        usableVolumeCm3: usable.volumeCm3,
        externalVolumeCm3: Number(profile.lengthCm) * Number(profile.breadthCm) * Number(profile.heightCm),
    };
};

const getAvailableInParcel = (parcel, item, weight, itemDims) => {
    const profile = parcel._profile;

    // Same guard as candidate selection: no valid dimensions means no
    // automatic preset-box sharing.
    if (!itemDims.hasValidDims) return 0;

    const usable = getUsableDimensions(profile);
    const physicallyFits = itemDims.sortedSides.every((side, index) => side <= usable.sortedSides[index]);
    if (!physicallyFits) return 0;

    const currentTotalQty = parcel.items.reduce((sum, entry) => sum + Number(entry.quantity), 0);
    const itemsRemaining = parcel._maxItems - currentTotalQty;

    const weightRemaining = Math.floor((parcel._maxContentsWeightGrams - parcel._contentsWeightGrams) / weight);

    const volumeRemaining = itemDims.volumeCm3 > 0
        ? Math.floor((parcel._usableVolumeCm3 - parcel._contentsVolumeCm3) / itemDims.volumeCm3)
        : Infinity;

    return Math.max(0, Math.min(itemsRemaining, weightRemaining, volumeRemaining));
};

const makeParcel = (profile, mixGroup = null, volumetricDivisor = 5000) => {
    const usable = getUsableDimensions(profile);
    return {
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
        _contentsVolumeCm3: 0,
        _usableVolumeCm3: usable.volumeCm3,
        _mixGroup: mixGroup,
        _maxItems: Number(profile.maxItems),
        _maxContentsWeightGrams: Number(profile.maxContentsWeightGrams),
        _profile: profile,
    };
};

const addToParcel = (parcel, item, quantity, weight, volumeCm3) => {
    const existing = parcel.items.find((entry) => entry.productId === item.productId && (entry.variantId || null) === (item.variantId || null));
    if (existing) existing.quantity += quantity;
    else parcel.items.push({ ...item, quantity });
    parcel._contentsWeightGrams += weight * quantity;
    parcel._contentsVolumeCm3 += (volumeCm3 || 0) * quantity;
    parcel.actualWeightGrams = Math.ceil(Number(parcel._profile.emptyWeightGrams) + parcel._contentsWeightGrams);
    parcel.chargeableWeightGrams = Math.ceil(Math.max(parcel.actualWeightGrams, parcel.volumetricWeightGrams) / 500) * 500;
};

const canProfileHoldParcelItems = (profile, parcel) => {
    const usable = getUsableDimensions(profile);
    let totalQty = 0;
    let totalWeight = 0;
    let totalVol = 0;

    for (const item of parcel.items) {
        const itemDims = getItemDimensions(item);
        // Without valid dimensions a box switch cannot be proven safe.
        if (!itemDims.hasValidDims) return false;
        const physicallyFits = itemDims.sortedSides.every((side, index) => side <= usable.sortedSides[index]);
        if (!physicallyFits) return false;
        totalVol += itemDims.volumeCm3 * item.quantity;

        totalQty += item.quantity;
        totalWeight += Number(item.weightGrams) * item.quantity;
    }

    if (totalQty > Number(profile.maxItems)) return false;
    if (totalWeight > Number(profile.maxContentsWeightGrams)) return false;
    if (totalVol > usable.volumeCm3) return false;

    return true;
};

const planParcels = (items, profiles, { volumetricDivisor = 5000, defaultPackageId = null } = {}) => {
    validatePackageProfiles(profiles);

    const physicalItems = (items || []).filter((entry) => entry.requiresShipping !== false);
    if (!physicalItems.length) return [];

    const shippingLines = [];
    for (const entry of physicalItems) {
        const weight = Number(entry.weightGrams);
        const quantity = Number(entry.quantity);
        if (!Number.isFinite(weight) || weight <= 0 || !Number.isSafeInteger(quantity) || quantity < 1) {
            throw new AppError('MISSING_PRODUCT_MEASUREMENTS', 400, 'A product is missing a valid weight or quantity. Check its shipping details.');
        }

        const isSeparate = entry.packingMode === 'separate' || entry.product?.packingMode === 'separate';
        const itemDims = getItemDimensions(entry);

        if (isSeparate) {
            for (let i = 0; i < quantity; i++) {
                shippingLines.push({
                    item: { ...entry, quantity: 1 },
                    weight,
                    quantity: 1,
                    itemDims,
                    mixGroup: `__separate_${entry.productId}_${entry.variantId || 'novar'}_unit${i + 1}`,
                });
            }
        } else {
            shippingLines.push({
                item: { ...entry },
                weight,
                quantity,
                itemDims,
                mixGroup: entry.mixGroup || null,
            });
        }
    }

    // Sort lines by unit volume descending, then weight descending, then productId
    shippingLines.sort((a, b) =>
        b.itemDims.volumeCm3 - a.itemDims.volumeCm3 ||
        b.weight - a.weight ||
        b.quantity - a.quantity ||
        String(a.item.productId).localeCompare(String(b.item.productId))
    );

    const activeProfiles = profiles.filter((profile) => profile.enabled !== false);
    if (!activeProfiles.length) {
        throw new AppError('SHIPPING_PACKAGE_CATALOG_MISSING', 400, 'No active package types are configured. Enable a measured preset in Shipping → Packaging.');
    }
    const preferDefault = preferDefaultBox(defaultPackageId);

    const runTrial = (targetProfileId = null, fallbackSmallest = true) => {
        const trialParcels = [];
        for (const line of shippingLines) {
            let remaining = line.quantity;
            while (remaining > 0) {
                // 1. Try to fit into existing compatible open parcels
                const existingCompatible = trialParcels.flatMap((parcel) => {
                    if (!areMixGroupsCompatible(parcel._mixGroup, line.mixGroup)) return [];
                    const available = getAvailableInParcel(parcel, line.item, line.weight, line.itemDims);
                    return available > 0 ? [{ parcel, available }] : [];
                }).sort((a, b) => b.available - a.available);

                if (existingCompatible.length) {
                    const { parcel, available } = existingCompatible[0];
                    const packedQuantity = Math.min(remaining, available);
                    addToParcel(parcel, line.item, packedQuantity, line.weight, line.itemDims.volumeCm3);
                    remaining -= packedQuantity;
                    continue;
                }

                // 2. Open a new parcel from the measured preset catalog.
                // There is no legacy single-box fallback: every candidate is
                // a merchant-measured preset, so the plan never invents a fit.
                const candidateProfiles = activeProfiles.flatMap((p) => {
                    const res = getProfileItemCapacity(p, line.item, line.weight);
                    return res.fits ? [{ profile: p, ...res }] : [];
                });

                if (!candidateProfiles.length) {
                    return null; // Cannot pack this line in this trial
                }

                let selectedCandidate = null;
                if (targetProfileId) {
                    selectedCandidate = candidateProfiles.find((c) => c.profile.id === targetProfileId);
                }

                if (!selectedCandidate) {
                    if (fallbackSmallest) {
                        // Smallest volume first; the merchant default box wins
                        // exact ties so the warehouse sees a familiar box.
                        candidateProfiles.sort((a, b) =>
                            a.usableVolumeCm3 - b.usableVolumeCm3 ||
                            Number(a.profile.emptyWeightGrams) - Number(b.profile.emptyWeightGrams) ||
                            preferDefault(a.profile.id, b.profile.id) ||
                            String(a.profile.id).localeCompare(String(b.profile.id))
                        );
                    } else {
                        // Largest volume first
                        candidateProfiles.sort((a, b) =>
                            b.usableVolumeCm3 - a.usableVolumeCm3 ||
                            b.capacity - a.capacity ||
                            preferDefault(a.profile.id, b.profile.id) ||
                            String(a.profile.id).localeCompare(String(b.profile.id))
                        );
                    }
                    selectedCandidate = candidateProfiles[0];
                }

                const packedQuantity = Math.min(remaining, selectedCandidate.capacity);
                const parcelMixGroup = line.mixGroup?.trim() || null;
                const parcel = makeParcel(selectedCandidate.profile, parcelMixGroup, volumetricDivisor);
                addToParcel(parcel, line.item, packedQuantity, line.weight, line.itemDims.volumeCm3);
                trialParcels.push(parcel);
                remaining -= packedQuantity;
            }
        }

        // 3. Shrink finished parcels to the smallest eligible preset without increasing parcel count
        for (const parcel of trialParcels) {
            const smallerCandidates = activeProfiles.filter((p) => {
                const curVol = getUsableDimensions(parcel._profile).volumeCm3;
                const candVol = getUsableDimensions(p).volumeCm3;
                return candVol < curVol && canProfileHoldParcelItems(p, parcel);
            }).sort((a, b) =>
                getUsableDimensions(a).volumeCm3 - getUsableDimensions(b).volumeCm3 ||
                Number(a.emptyWeightGrams) - Number(b.emptyWeightGrams) ||
                String(a.id).localeCompare(String(b.id))
            );

            if (smallerCandidates.length) {
                const smaller = smallerCandidates[0];
                const usable = getUsableDimensions(smaller);
                parcel.packageId = smaller.id;
                parcel.packageName = smaller.name;
                parcel.lengthCm = Number(smaller.lengthCm);
                parcel.breadthCm = Number(smaller.breadthCm);
                parcel.heightCm = Number(smaller.heightCm);
                parcel._usableVolumeCm3 = usable.volumeCm3;
                parcel._maxItems = Number(smaller.maxItems);
                parcel._maxContentsWeightGrams = Number(smaller.maxContentsWeightGrams);
                parcel._profile = smaller;
                parcel.actualWeightGrams = Math.ceil(Number(smaller.emptyWeightGrams) + parcel._contentsWeightGrams);
                parcel.volumetricWeightGrams = (Number(smaller.lengthCm) * Number(smaller.breadthCm) * Number(smaller.heightCm) / volumetricDivisor) * 1000;
                parcel.chargeableWeightGrams = Math.ceil(Math.max(parcel.actualWeightGrams, parcel.volumetricWeightGrams) / 500) * 500;
            }
        }

        return trialParcels;
    };

    // Run trial evaluations:
    // Trial 1: Smallest box first
    // Trial 2: Largest box first
    // Trial 3+: Try each available preset as target preference
    const trials = [];
    const trialSmall = runTrial(null, true);
    if (trialSmall) trials.push(trialSmall);

    const trialLarge = runTrial(null, false);
    if (trialLarge) trials.push(trialLarge);

    for (const profile of activeProfiles) {
        const trialProfile = runTrial(profile.id, true);
        if (trialProfile) trials.push(trialProfile);
    }

    if (!trials.length) {
        const firstItem = shippingLines[0]?.item;
        throw new AppError('SHIPPING_PACKAGE_CAPACITY_EXCEEDED', 400, `No configured package is confirmed to fit ${firstItem?.name || 'one of the products'} at the ordered quantity. Update its package fit rules or contact support.`, { productId: firstItem?.productId, variantId: firstItem?.variantId || null });
    }

    // Score trials:
    // Primary: parcel count (fewer boxes always wins)
    // Secondary: total external volume
    // Tertiary: total tare weight
    const scorePlan = (parcels) => {
        const count = parcels.length;
        const totalExternalVol = parcels.reduce((sum, p) => sum + (p.lengthCm * p.breadthCm * p.heightCm), 0);
        const totalTare = parcels.reduce((sum, p) => sum + Number(p._profile?.emptyWeightGrams || 0), 0);
        return (count * 10_000_000) + totalExternalVol + (totalTare / 1000);
    };

    trials.sort((a, b) => scorePlan(a) - scorePlan(b));
    const bestParcels = trials[0];

    bestParcels.forEach((parcel, index) => {
        parcel.parcelId = `parcel-${index + 1}`;
        delete parcel._contentsWeightGrams;
        delete parcel._contentsVolumeCm3;
        delete parcel._usableVolumeCm3;
        delete parcel._mixGroup;
        delete parcel._maxItems;
        delete parcel._maxContentsWeightGrams;
        delete parcel._profile;
    });

    return bestParcels;
};

module.exports = { planParcels, validatePackageProfiles };

