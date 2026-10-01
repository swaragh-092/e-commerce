'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
    sequelize,
    Cart,
    CartItem,
    Product,
    ProductVariant,
    Address,
    Setting,
    ShippingProvider,
    ShippingQuote,
    ShippingRule,
    ShippingZone,
    ShippingRuleHistory,
    Category,
    Brand,
} = require('../index');
const AppError = require('../../utils/AppError');
const { getVariantUnitPrice } = require('../product/product.pricing');
const { resolveProvider } = require('./providers');
const { validateDefaultPackage } = require('./shipping.package');

const QUOTE_TTL_MINUTES = Number(process.env.SHIPPING_QUOTE_TTL_MINUTES || 10);
const EMPTY_HASH = hashObject(null);

function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function hashObject(value) {
    return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

const normalizeCouponCodes = ({ couponCode, couponCodes = [] } = {}) => (
    [...new Set([
        ...(Array.isArray(couponCodes) ? couponCodes : []),
        couponCode,
    ].filter(Boolean).map((code) => String(code).trim().toUpperCase()))]
);

const normalizeMoney = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Number(parsed.toFixed(2));
};

const normalizeList = (value) => {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    if (typeof value === 'string') {
        return value.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return [];
};

const lower = (value) => String(value || '').trim().toLowerCase();

// ─── Volumetric weight helpers ────────────────────────────────────────────────

/**
 * Compute package dimensions using a vertical-stacking model:
 *   - Box footprint = max(L) × max(B)   (items share the same tray)
 *   - Box height    = sum(H × qty)      (items stacked on top of each other)
 * This is more realistic than L*B*H*qty per item.
 *
 * FIX 1: replaced naïve sum(L*B*H*qty) with max/max/sum stacking.
 */
const computePackageDimensions = (checkoutItems, packagingWeightGrams = 0, { strict = (process.env.NODE_ENV === 'production'), defaultPackage = null } = {}) => {
    const savedPackage = validateDefaultPackage(defaultPackage);
    if (savedPackage) {
        let contentsWeight = 0;
        let units = 0;
        for (const item of checkoutItems) {
            const product = item.product;
            if (product?.requiresShipping === false) continue;
            const weight = Number(product?.weightGrams);
            const quantity = Number(item.quantity);
            if (!Number.isFinite(weight) || weight <= 0) {
                throw new AppError('MISSING_PRODUCT_MEASUREMENTS', 400, 'Shipping is temporarily unavailable for this item. Please contact support.', { productId: product?.id, reason: 'missing_weight' });
            }
            if (!Number.isSafeInteger(quantity) || quantity < 1) {
                throw new AppError('VALIDATION_ERROR', 400, 'Shipping quantity must be a positive whole number.');
            }
            const itemSides = [product.lengthCm, product.breadthCm, product.heightCm].map(Number);
            if (itemSides.every((side) => Number.isFinite(side) && side > 0.5)) {
                const packageSides = [savedPackage.lengthCm, savedPackage.breadthCm, savedPackage.heightCm].map(Number).sort((a, b) => a - b);
                itemSides.sort((a, b) => a - b);
                if (itemSides.some((side, index) => side > packageSides[index])) {
                    throw new AppError('SHIPPING_PACKAGE_CAPACITY_EXCEEDED', 400, 'This item requires different packaging. Please contact support.');
                }
            }
            contentsWeight += weight * quantity;
            units += quantity;
        }
        if (!units) return { maxL: 0, maxB: 0, totalH: 0, totalWeightGrams: 0, volumeCm3: 0 };
        if (units > Number(savedPackage.maxItems) || contentsWeight > Number(savedPackage.maxContentsWeightGrams)) {
            throw new AppError('SHIPPING_PACKAGE_CAPACITY_EXCEEDED', 400, 'This order exceeds our available packaging capacity. Please reduce the quantity or contact support.');
        }
        const maxL = Number(savedPackage.lengthCm);
        const maxB = Number(savedPackage.breadthCm);
        const totalH = Number(savedPackage.heightCm);
        return { maxL, maxB, totalH, totalWeightGrams: contentsWeight + Number(savedPackage.emptyWeightGrams), volumeCm3: maxL * maxB * totalH };
    }
    let maxL = 0;
    let maxB = 0;
    let totalH = 0;
    let totalWeightGrams = Number(packagingWeightGrams || 0);
    let hasMissingMeasurements = false;
    const missingProducts = [];

    for (const item of checkoutItems) {
        const p = item.product;
        // Skip digital or non-shippable items
        if (!p || p.requiresShipping === false) continue;
        
        const qty = Number(item.quantity || 1);
        const weight = Number(p.weightGrams);
        const l = Number(p.lengthCm);
        const b = Number(p.breadthCm);
        const h = Number(p.heightCm);

        const isMissing = !Number.isFinite(weight) || weight <= 0 || !Number.isFinite(l) || l <= 0.5 || !Number.isFinite(b) || b <= 0.5 || !Number.isFinite(h) || h <= 0.5;
        if (isMissing) {
            hasMissingMeasurements = true;
            missingProducts.push(p.name || p.id || 'Product');
            if (strict) {
                throw new AppError('MISSING_PRODUCT_MEASUREMENTS', 400, 'Shipping is temporarily unavailable for this item. Please contact support.', { productId: p.id, reason: 'missing_weight_or_dimensions' });
            }
        }

        maxL = Math.max(maxL, Number(p.lengthCm  || 10));
        maxB = Math.max(maxB, Number(p.breadthCm || 10));
        totalH += Number(p.heightCm   || 10) * qty;
        totalWeightGrams += Number(p.weightGrams || 500) * qty;
    }

    const result = {
        maxL,
        maxB,
        totalH,
        totalWeightGrams,
        volumeCm3: maxL * maxB * totalH,
    };
    Object.defineProperties(result, {
        hasMissingMeasurements: { value: hasMissingMeasurements, enumerable: false, writable: true },
        missingProducts: { value: missingProducts, enumerable: false, writable: true },
    });
    return result;
};

/**
 * Compute chargeable weight.
 *
 * FIX 2: rounds UP to the next 500-gram carrier slab — never undercharge.
 * FIX 4: divisor comes from rateConfig.volumetricDivisor, not a hardcoded 5000.
 */
const computeChargeableWeight = (dims, divisor = 5000) => {
    const SLAB_GRAMS = 500;
    const volumetricGrams = (dims.volumeCm3 / divisor) * 1000;
    const raw = Math.max(dims.totalWeightGrams, volumetricGrams);
    // Round up to next 500-g slab (carrier billing unit)
    return Math.ceil(raw / SLAB_GRAMS) * SLAB_GRAMS;
};

/**
 * Detect a shipping zone tier from pincode proximity.
 *
 * FIX 5: kept as prefix matching for MVP — accurate for most metro codes.
 * Production upgrade: replace with India Post pincode ↔ state mapping table.
 *
 * @param {string} warehousePincode - configured in settings.warehousePincode
 * @param {string} deliveryPincode
 * @param {string[]} remotePrefixes - 2-char pin prefixes for remote zones (NE + J&K)
 * @returns {'same_city'|'same_state'|'remote'|'national'}
 */
const detectDeliveryZone = (warehousePincode, deliveryPincode, remotePrefixes = []) => {
    const w = String(warehousePincode || '').trim();
    const d = String(deliveryPincode  || '').trim();
    if (!w || !d) return 'national';

    // Remote zones: NE India (78-79, 83) + J&K (19)
    const defaultRemote = ['78', '79', '83', '19'];
    const remoteSet = [...defaultRemote, ...remotePrefixes];
    if (remoteSet.some((prefix) => d.startsWith(prefix))) return 'remote';

    // Same city: first 4 digits match (sub-district level)
    if (w.length >= 4 && d.length >= 4 && w.substring(0, 4) === d.substring(0, 4)) return 'same_city';
    // Same state: first 2 digits match
    if (w.length >= 2 && d.length >= 2 && w.substring(0, 2) === d.substring(0, 2)) return 'same_state';
    return 'national';
};

/**
 * Split a single heavy package into multiple carrier-sized packages.
 *
 * FIX 9: multi-package splitting stub.
 * When a shipment exceeds maxWeightKg, it becomes multiple packages.
 * Carriers bill per package, so we multiply the charge.
 *
 * @returns {{ packageCount: number, chargeableWeightPerPackage: number }}
 */
const splitIntoPackages = (totalWeightGrams, maxWeightGrams) => {
    if (!maxWeightGrams || maxWeightGrams <= 0) {
        return { packageCount: 1, chargeableWeightPerPackage: totalWeightGrams };
    }
    const packageCount = Math.ceil(totalWeightGrams / maxWeightGrams);
    const chargeableWeightPerPackage = Math.ceil(totalWeightGrams / packageCount);
    return { packageCount, chargeableWeightPerPackage };
};

const pincodeMatches = (patterns, pincode) => {
    const normalized = String(pincode || '').trim();
    const items = normalizeList(patterns);
    if (items.length === 0) return true;
    return items.some((item) => {
        if (item.includes('-')) {
            const [start, end] = item.split('-').map((part) => part.trim());
            // Numeric comparison if all parts are numeric
            if (/^\d+$/.test(normalized) && /^\d+$/.test(start) && /^\d+$/.test(end)) {
                const n = parseInt(normalized, 10);
                const s = parseInt(start, 10);
                const e = parseInt(end, 10);
                return n >= s && n <= e;
            }
            return normalized >= start && normalized <= end;
        }
        return item === normalized;
    });
};

const getSettingMap = async (groups = ['shipping', 'general']) => {
    const rows = await Setting.findAll({ where: { group: { [Op.in]: groups } } });
    return rows.reduce((acc, setting) => {
        acc[`${setting.group}.${setting.key}`] = setting.value;
        return acc;
    }, {});
};

/**
 * Resolve single dispatch warehouse origin across pricing, serviceability, and fulfillment.
 * Ensures checkout and fulfillment never check or dispatch from different warehouses (Edge Case 2).
 */
const resolveDispatchOrigin = async (provider, settingsMap = null) => {
    const settings = settingsMap || await getSettingMap(['shipping']);
    // If the provider has a configured pickup pincode (matching its carrier pickup location),
    // it takes precedence for that carrier; otherwise fallback to general shipping.warehousePincode.
    const originPincode = String(provider?.settings?.pickupPincode || settings['shipping.warehousePincode'] || '').trim();
    const pickupLocationName = String(provider?.settings?.pickupLocationName || 'Primary').trim();
    return {
        pincode: originPincode,
        pickupLocationName,
    };
};

const getManualProvider = async ({ transaction } = {}) => {
    const [provider] = await ShippingProvider.findOrCreate({
        where: { code: 'manual' },
        defaults: {
            name: 'Manual Shipping',
            type: 'manual',
            enabled: true,
            isDefault: false,
            mode: 'manual',
        },
        transaction,
    });
    return provider;
};

const getDefaultProvider = async ({ transaction } = {}) => {
    let provider = await ShippingProvider.findOne({
        where: { isDefault: true, enabled: true },
        transaction,
    });
    if (!provider) {
        provider = await ShippingProvider.findOne({
            where: { enabled: true },
            order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
            transaction,
        });
    }
    if (!provider) {
        provider = await getManualProvider({ transaction });
    }
    return provider;
};

const buildAddressSnapshot = (address) => ({
    id: address.id,
    fullName: address.fullName,
    phone: address.phone || '',
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2 || '',
    city: address.city,
    state: address.state || '',
    postalCode: String(address.postalCode || '').trim(),
    country: address.country,
});

const buildCartSnapshot = (items) => items.map((item) => ({
    productId: item.productId,
    variantId: item.variantId || null,
    quantity: Number(item.quantity),
    unitPrice: normalizeMoney(item.currentPrice),
})).sort((a, b) => `${a.productId}:${a.variantId || ''}`.localeCompare(`${b.productId}:${b.variantId || ''}`));

const buildCheckoutContext = async (userId, payload) => {
    let checkoutItems = [];

    if (payload.buyNowItem?.productId) {
        const product = await Product.findByPk(payload.buyNowItem.productId, {
            include: [
                { model: Category, as: 'categories' },
                { model: Brand, as: 'brand' },
            ],
        });
        if (!product) throw new AppError('NOT_FOUND', 404, 'Buy Now product not found');

        let variant = null;
        if (payload.buyNowItem.variantId) {
            variant = await ProductVariant.findOne({
                where: { id: payload.buyNowItem.variantId, productId: payload.buyNowItem.productId },
            });
            if (!variant) throw new AppError('NOT_FOUND', 404, 'Selected product variant not found');
        }

        checkoutItems = [{
            productId: product.id,
            variantId: variant?.id || null,
            quantity: Number(payload.buyNowItem.quantity || 1),
            product,
            variant,
        }];
    } else {
        const cart = await Cart.findOne({
            where: { userId, status: 'active' },
            include: [{
                model: CartItem,
                as: 'items',
                include: [
                    {
                        model: Product,
                        as: 'product',
                        include: [
                            { model: Category, as: 'categories' },
                            { model: Brand, as: 'brand' },
                        ],
                    },
                    { model: ProductVariant, as: 'variant' },
                ],
            }],
        });

        if (!cart || !cart.items || cart.items.length === 0) {
            throw new AppError('VALIDATION_ERROR', 400, 'Cart is empty');
        }
        checkoutItems = cart.items;
    }

    let subtotal = 0;
    const items = checkoutItems.map((item) => {
        if (!item.product) {
            throw new AppError('VALIDATION_ERROR', 400, 'One or more products are no longer available.');
        }
        const unitPrice = getVariantUnitPrice(item.product, item.variant || null);
        const quantity = Number(item.quantity || 1);
        subtotal += unitPrice * quantity;
        return {
            productId: item.productId,
            variantId: item.variantId || item.variant?.id || null,
            quantity,
            currentPrice: unitPrice,
        };
    });

    const address = await Address.findOne({ where: { id: payload.shippingAddressId, userId } });
    if (!address) throw new AppError('NOT_FOUND', 404, 'Shipping address not found');

    const addressSnapshot = buildAddressSnapshot(address);
    const cartSnapshot = buildCartSnapshot(items);
    const couponCodes = normalizeCouponCodes(payload);

    // Compute package dimensions from products, including packaging tare weight (Edge Case 5)
    const shippingSettings = await getSettingMap(['shipping']);
    const packagingTare = Number(shippingSettings['shipping.packagingWeightGrams'] ?? 50);
    const defaultPackage = shippingSettings['shipping.defaultPackage'] || null;
    const dims = computePackageDimensions(checkoutItems, packagingTare, { defaultPackage });

    return {
        items,
        subtotal: normalizeMoney(subtotal),
        address,
        addressSnapshot,
        cartSnapshot,
        couponCodes,
        // Volumetric shipping context
        packageDims: dims,
        defaultPackage,
        cartHash: hashObject(cartSnapshot),
        addressHash: hashObject(addressSnapshot),
        couponHash: couponCodes.length ? hashObject(couponCodes) : EMPTY_HASH,
    };
};

const calculateManualDecision = async ({ subtotal, chargeableWeightGrams = 0, addressSnapshot, paymentMethod }) => {
    const settings = await getSettingMap(['shipping', 'general']);
    const shippingMethod = settings['shipping.method'] || 'flat_rate';
    const flatRate = Number(settings['shipping.flatRate'] ?? 0);
    const freeThreshold = Number(settings['shipping.freeThreshold'] ?? 0);
    const currency = String(settings['general.currency'] || 'INR').toUpperCase();
    const allowedPincodes = normalizeList(settings['shipping.serviceablePincodes']);
    const blockedPincodes = normalizeList(settings['shipping.blockedPincodes']);

    let shippingCost = 0;
    if (shippingMethod === 'flat_rate') {
        shippingCost = flatRate;
    } else if (shippingMethod === 'free_above_threshold') {
        shippingCost = subtotal >= freeThreshold ? 0 : flatRate;
    }

    const postalCode = String(addressSnapshot.postalCode || '').trim();
    const country = lower(addressSnapshot.country || 'india');
    const isIndia = country === 'india' || country === 'in';
    const isStandardPincode = /^\d{6}$/.test(postalCode);

    const defaultProvider = await getDefaultProvider();
    const maxWeightKg = Number(defaultProvider?.maxWeightKg) || 20;
    const maxWeightGrams = maxWeightKg * 1000;
    const isOverweight = chargeableWeightGrams > 0 && chargeableWeightGrams > maxWeightGrams;

    // Intended delivery area guard (Edge Case 7): standard rule intended for domestic delivery
    const serviceable = Boolean(postalCode)
        && isIndia
        && isStandardPincode
        && !isOverweight
        && !blockedPincodes.includes(postalCode)
        && (allowedPincodes.length === 0 || allowedPincodes.includes(postalCode));

    let unavailableMessage = 'Delivery is not available for this pincode';
    if (!postalCode) {
        unavailableMessage = 'Delivery pincode is required';
    } else if (!isIndia) {
        unavailableMessage = 'Delivery is currently only available within India';
    } else if (!isStandardPincode) {
        unavailableMessage = 'Invalid 6-digit delivery pincode';
    } else if (isOverweight) {
        unavailableMessage = `Package weight (${(chargeableWeightGrams / 1000).toFixed(1)}kg) exceeds courier maximum limit (${maxWeightKg}kg). Until parcel splitting is enabled, please reduce item quantity or contact support.`;
    }

    return {
        serviceable,
        shippingCost: normalizeMoney(shippingCost),
        currency,
        taxIncluded: false,
        taxAmount: 0,
        taxBreakdown: null,
        codAvailable: serviceable && (defaultProvider.supportsCod !== false),
        estimatedMinDays: null,
        estimatedMaxDays: null,
        message: serviceable ? 'Delivery available' : unavailableMessage,
        providerId: defaultProvider.id,
        providerCode: defaultProvider.code,
        providerName: defaultProvider.name,
        paymentMethod,
    };
};

const zoneMatches = (zone, addressSnapshot) => {
    if (!zone || zone.enabled === false) return false;
    const pincode = String(addressSnapshot.postalCode || '').trim();
    if (normalizeList(zone.blockedPincodes).includes(pincode)) return false;
    if (zone.country && lower(zone.country) !== lower(addressSnapshot.country)) return false;
    if (zone.state && lower(zone.state) !== lower(addressSnapshot.state)) return false;
    if (zone.city && lower(zone.city) !== lower(addressSnapshot.city)) return false;
    return pincodeMatches(zone.pincodes, pincode);
};

const conditionsMatch = (conditions = {}, { subtotal, chargeableWeightGrams = 0, addressSnapshot, paymentMethod }) => {
    const pincode = String(addressSnapshot.postalCode || '').trim();
    if (conditions.country && lower(conditions.country) !== lower(addressSnapshot.country)) return false;
    if (conditions.state && lower(conditions.state) !== lower(addressSnapshot.state)) return false;
    if (conditions.city && lower(conditions.city) !== lower(addressSnapshot.city)) return false;
    if (conditions.pincodes && !pincodeMatches(conditions.pincodes, pincode)) return false;
    if (conditions.blockedPincodes && normalizeList(conditions.blockedPincodes).includes(pincode)) return false;
    if (conditions.subtotalGte != null && subtotal < Number(conditions.subtotalGte)) return false;
    if (conditions.subtotalLte != null && subtotal > Number(conditions.subtotalLte)) return false;
    if (conditions.paymentMethods && !normalizeList(conditions.paymentMethods).includes(paymentMethod)) return false;
    // Weight-based condition matching
    if (conditions.weightGte != null && chargeableWeightGrams < Number(conditions.weightGte)) return false;
    if (conditions.weightLte != null && chargeableWeightGrams > Number(conditions.weightLte)) return false;
    return true;
};

/**
 * Calculate the shipping rate from a matched rule.
 *
 * FIX 2: uses pre-rounded chargeableWeightGrams (caller handles rounding)
 * FIX 3: COD fee from rateConfig (percent or flat), with configurable minimum
 * FIX 4: volumetricDivisor from config
 * FIX 6: fuel surcharge on freight only — NOT applied on COD fee
 * FIX 7: minimum charge enforcement
 *
 * @returns {{ freight: number, codFee: number, total: number }}
 */
const calculateRuleRate = (rule, { subtotal, chargeableWeightGrams = 0, paymentMethod = 'razorpay', zone = 'national' }) => {
    const config = rule.rateConfig || {};

    // ── Free shortcuts ────────────────────────────────────────────────────
    if (rule.rateType === 'free') return { freight: 0, codFee: 0, total: 0 };

    if (config.freeAboveSubtotal != null && subtotal >= Number(config.freeAboveSubtotal)) {
        return { freight: 0, codFee: 0, total: 0 };
    }

    if (rule.rateType === 'free_above_threshold') {
        const thresholdFree = subtotal >= Number(config.threshold || 0);
        const freight = thresholdFree ? 0 : Number(config.amount || config.flatRate || 0);
        return { freight, codFee: 0, total: freight };
    }

    // ── Percent of order ──────────────────────────────────────────────────
    if (rule.rateType === 'percent_of_order') {
        const freight = normalizeMoney(subtotal * (Number(config.percent || 0) / 100));
        return { freight, codFee: 0, total: freight };
    }

    // ── Flat rate ─────────────────────────────────────────────────────────
    let freight = Number(config.baseCharge || config.flatRate || config.amount || 0);

    // ── Per-kg slab (most common for Indian carriers) ─────────────────────
    if (rule.rateType === 'per_kg_slab' || rule.rateType === 'volumetric') {
        const firstSlabGrams      = Number(config.firstSlabGrams      || 500);
        const additionalSlabGrams = Number(config.additionalSlabGrams || 500);
        const additionalSlabRate  = Number(config.additionalSlabRate  || 0);

        if (chargeableWeightGrams > firstSlabGrams) {
            const extraGrams = chargeableWeightGrams - firstSlabGrams;
            const extraSlabs = Math.ceil(extraGrams / additionalSlabGrams);
            freight += extraSlabs * additionalSlabRate;
        }

        // Zone multiplier on base freight
        const multipliers = config.zoneMultipliers || {};
        const multiplier = Number(multipliers[zone] || multipliers['national'] || 1);
        freight = freight * multiplier;
    }

    // FIX 6: Fuel surcharge on FREIGHT only (not COD fee)
    if (config.fuelSurchargePercent) {
        freight = freight + (freight * Number(config.fuelSurchargePercent) / 100);
    }

    // FIX 7: Minimum charge enforcement
    if (config.minCharge != null) {
        freight = Math.max(freight, Number(config.minCharge));
    }

    freight = normalizeMoney(freight);

    // FIX 3: COD fee from rateConfig (separate from freight)
    let codFee = 0;
    if (paymentMethod === 'cod') {
        if (config.codFeeType === 'percent' && config.codFeeValue) {
            const pctFee = subtotal * (Number(config.codFeeValue) / 100);
            codFee = normalizeMoney(Math.max(Number(config.codFeeMin || 0), pctFee));
        } else if (config.codFeeValue) {
            codFee = normalizeMoney(Number(config.codFeeValue));
        } else if (rule.codFee) {
            // Fallback to rule-level flat codFee column
            codFee = normalizeMoney(Number(rule.codFee));
        }
    }

    return { freight, codFee, total: normalizeMoney(freight + codFee) };
};

const providerSupportsDecision = (provider, { paymentMethod }) => {
    if (!provider || provider.enabled === false) return false;
    if (paymentMethod === 'cod' && provider.supportsCod === false) return false;
    return true;
};

const calculateRuleDecision = async ({ subtotal, chargeableWeightGrams = 0, packageCount = 1, zone = 'national', addressSnapshot, paymentMethod }) => {
    const country = lower(addressSnapshot?.country || 'india');
    const isIndia = country === 'india' || country === 'in';
    // Intended delivery area guard (Edge Case 7): store rules are intended for domestic delivery; avoid accidentally allowing delivery outside India
    if (!isIndia) {
        return null;
    }

    const settings = await getSettingMap(['general']);
    const currency = String(settings['general.currency'] || 'INR').toUpperCase();
    const rules = await ShippingRule.findAll({
        where: { enabled: true },
        include: [
            { model: ShippingZone, as: 'zone', required: false },
            { model: ShippingProvider, as: 'provider', required: false },
        ],
        order: [
            ['priority', 'DESC'],
            ['strictOverride', 'DESC'],
            ['createdAt', 'DESC'],
        ],
    });

    const defaultProvider = await getDefaultProvider();

    const matchedRule = rules.find((rule) => {
        const effectiveProvider = rule.provider || defaultProvider;
        if (effectiveProvider && effectiveProvider.maxWeightKg) {
            const maxWeightGrams = Number(effectiveProvider.maxWeightKg) * 1000;
            if (chargeableWeightGrams > maxWeightGrams * packageCount) {
                return false;
            }
        }
        return (!rule.zone || zoneMatches(rule.zone, addressSnapshot)) &&
            conditionsMatch(rule.conditions || {}, { subtotal, chargeableWeightGrams, addressSnapshot, paymentMethod }) &&
            providerSupportsDecision(effectiveProvider, { paymentMethod });
    });

    if (!matchedRule) return null;

    const provider = matchedRule.provider || defaultProvider;

    const rateBreakdown = calculateRuleRate(matchedRule, {
        subtotal,
        chargeableWeightGrams,
        paymentMethod,
        zone,
    });

    const codAvailable = matchedRule.codAllowed !== false && provider.supportsCod !== false;
    // Per-package pricing: multiply freight by package count (FIX 9)
    const totalFreight = normalizeMoney(rateBreakdown.freight * packageCount);
    const shippingCost = normalizeMoney(totalFreight + rateBreakdown.codFee);

    return {
        serviceable: true,
        shippingCost,
        currency,
        taxIncluded: false,
        taxAmount: 0,
        taxBreakdown: null,
        codAvailable,
        estimatedMinDays: matchedRule.estimatedMinDays,
        estimatedMaxDays: matchedRule.estimatedMaxDays,
        message: 'Delivery available',
        providerCode: provider.code,
        providerName: provider.name,
        providerId: provider.id,
        ruleId: matchedRule.id,
        ruleName: matchedRule.name,
        // Expose breakdown for quote snapshot
        rateBreakdown: { ...rateBreakdown, packageCount, chargeableWeightGrams, zone },
        paymentMethod,
    };
};

const serializeQuote = (quote) => {
    const decision = quote.decisionSnapshot || {};
    return {
        serviceable: quote.serviceable,
        shippingCost: normalizeMoney(quote.shippingCost),
        currency: quote.currency,
        taxIncluded: quote.taxIncluded,
        taxAmount: normalizeMoney(quote.taxAmount),
        taxBreakdown: quote.taxBreakdown,
        codAvailable: quote.codAvailable,
        estimatedMinDays: quote.estimatedMinDays,
        estimatedMaxDays: quote.estimatedMaxDays,
        estimatedDeliveryDays: quote.estimatedMinDays && quote.estimatedMaxDays
            ? `${quote.estimatedMinDays}-${quote.estimatedMaxDays}`
            : null,
        providerCode: decision.providerCode || 'manual',
        providerName: decision.providerName || 'Manual Shipping',
        message: decision.message || (quote.serviceable ? 'Delivery available' : 'Delivery unavailable'),
        quoteId: quote.id,
        checkoutSessionId: quote.checkoutSessionId,
        expiresAt: quote.expiresAt,
        defaultPackage: quote.inputSnapshot?.defaultPackage || null,
    };
};

const createQuote = async (userId, payload) => {
    const checkoutSessionId = payload.checkoutSessionId || uuidv4();
    const paymentMethod = payload.paymentMethod || 'razorpay';
    const context = await buildCheckoutContext(userId, payload);

    // ── Single warehouse origin for pricing and serviceability (Edge Case 2) ──
    const settings = await getSettingMap(['shipping']);
    const fallbackProvider = await getDefaultProvider();
    const initialOrigin = await resolveDispatchOrigin(fallbackProvider, settings);
    const deliveryPincode  = String(context.addressSnapshot.postalCode || '').trim();

    const volumetricDivisor = Number(settings['shipping.volumetricDivisor'] || 5000);
    const chargeableWeightGrams = computeChargeableWeight(context.packageDims, volumetricDivisor);
    const zone = detectDeliveryZone(initialOrigin.pincode, deliveryPincode);

    const idempotencyKey = hashObject({
        checkoutSessionId,
        cartHash: context.cartHash,
        addressHash: context.addressHash,
        paymentMethod,
        couponHash: context.couponHash,
        packageHash: hashObject({ dimensions: context.packageDims, defaultPackage: context.defaultPackage }),
    });

    const existing = await ShippingQuote.findOne({
        where: {
            userId,
            idempotencyKey,
            expiresAt: { [Op.gt]: new Date() },
        },
        order: [['createdAt', 'DESC']],
    });
    if (existing) return serializeQuote(existing);

    let decision = await calculateRuleDecision({
        subtotal:             context.subtotal,
        chargeableWeightGrams,
        packageCount:         1,
        zone,
        addressSnapshot:      context.addressSnapshot,
        paymentMethod,
    }) || await calculateManualDecision({
        subtotal:        context.subtotal,
        chargeableWeightGrams,
        addressSnapshot: context.addressSnapshot,
        paymentMethod,
    });

    const selectedProvider = decision.providerId === fallbackProvider.id
        ? fallbackProvider
        : await ShippingProvider.findByPk(decision.providerId || fallbackProvider.id);
    const selectedOrigin = await resolveDispatchOrigin(selectedProvider, settings);

    // Courier limits check on single parcel (Edge Case 6: until actual splitting is implemented, block unsupported parcels)
    const maxWeightKg = Number(selectedProvider?.maxWeightKg) || 20;
    const maxWeightGrams = maxWeightKg * 1000;
    const maxDimCm = Number(selectedProvider?.maxLengthCm) || 150;
    const dims = context.packageDims;

    if (chargeableWeightGrams > maxWeightGrams) {
        decision = {
            ...decision,
            serviceable: false,
            codAvailable: false,
            message: `Package weight (${(chargeableWeightGrams / 1000).toFixed(1)}kg) exceeds courier maximum limit (${maxWeightKg}kg). Until parcel splitting is enabled, please reduce item quantity or contact support.`,
        };
    } else if (dims.maxL > maxDimCm || dims.maxB > maxDimCm || dims.totalH > maxDimCm) {
        decision = {
            ...decision,
            serviceable: false,
            codAvailable: false,
            message: `Package dimensions exceed courier maximum allowed limit (${maxDimCm}cm). Please contact support.`,
        };
    }

    let liveProviderResponse = null;
    if (decision.serviceable && selectedProvider?.code === 'shiprocket' && selectedProvider.enabled) {
        try {
            const providerAdapter = resolveProvider(selectedProvider);
            liveProviderResponse = await providerAdapter.getServiceability({
                pincode: deliveryPincode,
                pickupPincode: selectedOrigin.pincode,
                weightGrams: chargeableWeightGrams,
                paymentMode: paymentMethod === 'cod' ? 'cod' : 'prepaid',
                lengthCm: dims.maxL,
                breadthCm: dims.maxB,
                heightCm: dims.totalH,
            });

            if (liveProviderResponse.serviceable === false) {
                decision = {
                    ...decision,
                    serviceable: false,
                    codAvailable: false,
                    message: liveProviderResponse.reason || 'Delivery is not available for this pincode.',
                    liveServiceability: liveProviderResponse,
                };
            } else {
                decision = {
                    ...decision,
                    serviceable: Boolean(decision.serviceable && liveProviderResponse.serviceable),
                    codAvailable: Boolean(decision.codAvailable && liveProviderResponse.codAvailable),
                    message: decision.serviceable && liveProviderResponse.serviceable
                        ? decision.message
                        : (liveProviderResponse.reason || 'Shiprocket cannot deliver to this address'),
                    liveServiceability: {
                        serviceable: liveProviderResponse.serviceable,
                        codAvailable: liveProviderResponse.codAvailable,
                    },
                };
            }
        } catch (error) {
            // Edge Case 1 & 3: Tell customers delivery checking is temporarily unavailable, do not leak internal errors
            throw new AppError('SHIPPING_UNAVAILABLE', 503, 'Delivery checking is temporarily unavailable. Please retry shortly.');
        }
    }

    const expiresAt = new Date(Date.now() + QUOTE_TTL_MINUTES * 60 * 1000);
    
    try {
        const quote = await ShippingQuote.create({
            userId,
            addressId: context.address.id,
            providerId: decision.providerId || fallbackProvider.id,
            ruleId: decision.ruleId || null,
            serviceable: decision.serviceable,
            shippingCost: decision.shippingCost,
            currency: decision.currency,
            taxIncluded: decision.taxIncluded,
            taxAmount: decision.taxAmount,
            taxBreakdown: decision.taxBreakdown,
            codAvailable: decision.codAvailable,
            estimatedMinDays: decision.estimatedMinDays,
            estimatedMaxDays: decision.estimatedMaxDays,
            checkoutSessionId,
            cartHash: context.cartHash,
            addressHash: context.addressHash,
            paymentMethod,
            couponHash: context.couponHash,
            idempotencyKey,
            inputSnapshot: {
                subtotal: context.subtotal,
                items: context.cartSnapshot,
                address: context.addressSnapshot,
                couponCodes: context.couponCodes,
                defaultPackage: context.defaultPackage,
            },
            decisionSnapshot: decision,
            rawResponse: liveProviderResponse,
            expiresAt,
        });

        return serializeQuote(quote);
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
            const retry = await ShippingQuote.findOne({
                where: {
                    idempotencyKey,
                    expiresAt: { [Op.gt]: new Date() },
                },
                order: [['createdAt', 'DESC']],
            });
            if (retry) return serializeQuote(retry);
        }
        throw err;
    }
};

const listProviders = async () => {
    const providers = await ShippingProvider.findAll({ order: [['isDefault', 'DESC'], ['name', 'ASC']] });
    return providers.map((provider) => {
        const data = typeof provider.toJSON === 'function' ? provider.toJSON() : { ...provider };
        delete data.credentialsEncrypted;
        delete data.webhookSecret;
        if (data.settings) delete data.settings.webhookHeaderValue;
        return {
            ...data,
            webhookConfigured: Boolean(provider.webhookSecret),
        };
    });
};

const cryptoUtils = require('../../utils/crypto');

const updateProvider = async (id, payload) => {
    return sequelize.transaction(async (t) => {
        const provider = await ShippingProvider.findByPk(id, { transaction: t });
        if (!provider) throw new AppError('NOT_FOUND', 404, 'Shipping provider not found');
        
        // Disallow un-defaulting directly without choosing another default
        if (payload.isDefault === false && provider.isDefault) {
            throw new AppError('BAD_REQUEST', 400, 'Cannot unset default status. Please set another provider as default instead.');
        }

        // Disallow disabling the active default provider directly
        if (payload.enabled === false && provider.isDefault && payload.isDefault !== true) {
            throw new AppError('BAD_REQUEST', 400, 'Cannot disable the default shipping provider. Please set another provider as default first.');
        }

        // Allowlist safe fields
        const permitted = ['name', 'enabled', 'isDefault', 'supportsCod', 'settings', 'webhookSecret'];
        const filtered = Object.keys(payload)
            .filter(key => permitted.includes(key))
            .reduce((obj, key) => {
                obj[key] = payload[key];
                return obj;
            }, {});

        if (payload.isDefault === true) {
            filtered.enabled = true; // Default provider must always be enabled
            await ShippingProvider.update(
                { isDefault: false },
                { where: { id: { [Op.ne]: id } }, transaction: t }
            );
        }

        if (payload.credentials) {
            filtered.credentialsEncrypted = JSON.stringify(cryptoUtils.encrypt(JSON.stringify(payload.credentials)));
        }
        if (Object.prototype.hasOwnProperty.call(payload, 'webhookSecret')) {
            filtered.webhookSecret = payload.webhookSecret
                ? JSON.stringify(cryptoUtils.encrypt(String(payload.webhookSecret)))
                : null;
        }

        const ShiprocketProvider = require('./providers/shiprocket.provider');
        if (typeof ShiprocketProvider.clearAuthCooldown === 'function') {
            ShiprocketProvider.clearAuthCooldown();
        }

        return provider.update(filtered, { transaction: t });
    });
};

const testProviderConnection = async (id) => {
    const provider = await ShippingProvider.findByPk(id);
    if (!provider) {
        throw new AppError('NOT_FOUND', 404, 'Shipping provider not found');
    }
    const adapter = resolveProvider(provider);
    if (typeof adapter.testConnection !== 'function') {
        return {
            success: true,
            message: `Provider "${provider.name}" does not require remote API credentials check.`,
        };
    }
    return adapter.testConnection();
};

const testCalculation = async ({ pincode, subtotal = 0, paymentMethod = 'razorpay', weightGrams = 500, country = 'India' }) => {
    const addressSnapshot = {
        postalCode: String(pincode || '').trim(),
        country: country || 'India',
    };
    const rawMethod = String(paymentMethod || 'razorpay').toLowerCase();
    const normalizedPaymentMethod = rawMethod === 'prepaid' ? 'razorpay' : rawMethod;
    const settings = await getSettingMap(['shipping', 'general']);
    const defaultProvider = await getDefaultProvider();
    const origin = await resolveDispatchOrigin(defaultProvider, settings);
    const warehousePincode = origin.pincode;
    const chargeableWeightGrams = Number(weightGrams || 500);
    const zone = detectDeliveryZone(warehousePincode, addressSnapshot.postalCode);
    const packageCount = 1;

    const decision = await calculateRuleDecision({
        subtotal: Number(subtotal || 0),
        chargeableWeightGrams,
        packageCount,
        zone,
        addressSnapshot,
        paymentMethod: normalizedPaymentMethod,
    }) || await calculateManualDecision({
        subtotal: Number(subtotal || 0),
        chargeableWeightGrams,
        addressSnapshot,
        paymentMethod: normalizedPaymentMethod,
    });

    const selectedProvider = decision.providerId === defaultProvider.id
        ? defaultProvider
        : await ShippingProvider.findByPk(decision.providerId || defaultProvider.id);
    const maxWeightKg = Number(selectedProvider?.maxWeightKg) || 20;
    const maxWeightGrams = maxWeightKg * 1000;
    if (chargeableWeightGrams > maxWeightGrams) {
        decision.serviceable = false;
        decision.codAvailable = false;
        decision.message = `Package weight (${(chargeableWeightGrams / 1000).toFixed(1)}kg) exceeds courier maximum limit (${maxWeightKg}kg). Until parcel splitting is enabled, please reduce item quantity or contact support.`;
    }

    return {
        zone,
        warehousePincode,
        deliveryPincode: addressSnapshot.postalCode,
        packageCount,
        chargeableWeightGrams,
        defaultProvider: {
            id: defaultProvider.id,
            code: defaultProvider.code,
            name: defaultProvider.name,
        },
        decision,
    };
};

const listZones = () => ShippingZone.findAll({ order: [['createdAt', 'DESC']] });

const createZone = (payload) => ShippingZone.create(payload);

const updateZone = async (id, payload) => {
    const zone = await ShippingZone.findByPk(id);
    if (!zone) throw new AppError('NOT_FOUND', 404, 'Shipping zone not found');
    return zone.update(payload);
};

const deleteZone = async (id) => {
    const zone = await ShippingZone.findByPk(id);
    if (!zone) throw new AppError('NOT_FOUND', 404, 'Shipping zone not found');
    
    // Check for associated rules
    const rulesCount = await ShippingRule.count({ where: { zoneId: id } });
    if (rulesCount > 0) {
        throw new AppError('CONFLICT', 409, 'Cannot delete shipping zone with associated rules');
    }

    await zone.destroy();
    return { id };
};

const listRules = () => ShippingRule.findAll({
    include: [
        { model: ShippingZone, as: 'zone', required: false },
        { model: ShippingProvider, as: 'provider', required: false },
    ],
    order: [['priority', 'DESC'], ['createdAt', 'DESC']],
});

const createRule = async (payload, userId) => {
    const rule = await ShippingRule.create(payload);
    await ShippingRuleHistory.create({
        ruleId: rule.id,
        changedBy: userId,
        changeType: 'create',
        oldValue: null,
        newValue: rule.toJSON(),
    });
    return rule;
};

const updateRule = async (id, payload, userId) => {
    const rule = await ShippingRule.findByPk(id);
    if (!rule) throw new AppError('NOT_FOUND', 404, 'Shipping rule not found');
    const oldValue = rule.toJSON();
    await rule.update(payload);
    await ShippingRuleHistory.create({
        ruleId: rule.id,
        changedBy: userId,
        changeType: 'update',
        oldValue,
        newValue: rule.toJSON(),
    });
    return rule;
};

const deleteRule = async (id, userId) => {
    const rule = await ShippingRule.findByPk(id);
    if (!rule) throw new AppError('NOT_FOUND', 404, 'Shipping rule not found');
    const oldValue = rule.toJSON();
    await ShippingRuleHistory.create({
        ruleId: rule.id,
        changedBy: userId,
        changeType: 'delete',
        oldValue,
        newValue: null,
    });
    await rule.destroy();
    return { id };
};

const validateQuoteForOrder = async (userId, payload) => {
    let quote;
    if (!payload.shippingQuoteId) {
        quote = await createQuote(userId, payload);
    } else {
        const found = await ShippingQuote.findOne({ where: { id: payload.shippingQuoteId, userId } });
        if (!found) throw new AppError('SHIPPING_QUOTE_NOT_FOUND', 404, 'Shipping quote not found');
        if (found.expiresAt <= new Date()) {
            throw new AppError('SHIPPING_QUOTE_EXPIRED', 400, 'Shipping quote expired. Please refresh shipping.');
        }
        if (!found.serviceable) {
            throw new AppError('SHIPPING_UNAVAILABLE', 400, 'Delivery is not available for this address');
        }
        if (payload.paymentMethod === 'cod' && found.codAvailable === false) {
            throw new AppError('COD_UNAVAILABLE', 400, 'Cash on delivery is not available for this delivery address or order.');
        }
        if (payload.checkoutSessionId && found.checkoutSessionId !== payload.checkoutSessionId) {
            throw new AppError('SHIPPING_QUOTE_STALE', 400, 'Shipping quote no longer matches this checkout session');
        }

        const context = await buildCheckoutContext(userId, payload);
        const couponHash = context.couponHash;
        if (
            found.cartHash !== context.cartHash ||
            found.addressHash !== context.addressHash ||
            found.paymentMethod !== (payload.paymentMethod || 'razorpay') ||
            found.couponHash !== couponHash
        ) {
            throw new AppError('SHIPPING_QUOTE_STALE', 400, 'Shipping quote no longer matches your cart or address');
        }

        quote = serializeQuote(found);
    }

    if (payload.paymentMethod === 'cod' && quote.codAvailable === false) {
        throw new AppError('COD_UNAVAILABLE', 400, 'Cash on delivery is not available for this delivery address or order.');
    }

    return quote;
};

module.exports = {
    computePackageDimensions,
    computeChargeableWeight,
    resolveDispatchOrigin,
    createQuote,
    validateQuoteForOrder,
    buildCheckoutContext,
    listProviders,
    updateProvider,
    testProviderConnection,
    getDefaultProvider,
    getManualProvider,
    testCalculation,
    listZones,
    createZone,
    updateZone,
    deleteZone,
    listRules,
    createRule,
    updateRule,
    deleteRule,
};
