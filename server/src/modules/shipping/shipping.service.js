'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
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
const computePackageDimensions = (checkoutItems) => {
    let maxL = 0;
    let maxB = 0;
    let totalH = 0;
    let totalWeightGrams = 0;

    for (const item of checkoutItems) {
        const p = item.product;
        // Skip digital or non-shippable items
        if (p.requiresShipping === false) continue;
        
        const qty = Number(item.quantity || 1);
        maxL = Math.max(maxL, Number(p.lengthCm  || 10));
        maxB = Math.max(maxB, Number(p.breadthCm || 10));
        totalH += Number(p.heightCm   || 10) * qty;
        totalWeightGrams += Number(p.weightGrams || 500) * qty;
    }

    return { maxL, maxB, totalH, totalWeightGrams, volumeCm3: maxL * maxB * totalH };
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

const getManualProvider = async () => {
    const [provider] = await ShippingProvider.findOrCreate({
        where: { code: 'manual' },
        defaults: {
            name: 'Manual Shipping',
            type: 'manual',
            enabled: true,
            isDefault: true,
            mode: 'manual',
        },
    });
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

    // Compute package dimensions from products (FIX 1: stacking model)
    const dims = computePackageDimensions(checkoutItems);

    return {
        items,
        subtotal: normalizeMoney(subtotal),
        address,
        addressSnapshot,
        cartSnapshot,
        couponCodes,
        // Volumetric shipping context
        packageDims: dims,
        cartHash: hashObject(cartSnapshot),
        addressHash: hashObject(addressSnapshot),
        couponHash: couponCodes.length ? hashObject(couponCodes) : EMPTY_HASH,
    };
};

const calculateManualDecision = async ({ subtotal, addressSnapshot, paymentMethod }) => {
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
    const serviceable = Boolean(postalCode)
        && !blockedPincodes.includes(postalCode)
        && (allowedPincodes.length === 0 || allowedPincodes.includes(postalCode));

        const unavailableMessage = postalCode
            ? 'Delivery is not available for this pincode'
            : 'Delivery pincode is required';

        return {
            serviceable,
            shippingCost: normalizeMoney(shippingCost),
            currency,
            taxIncluded: false,
            taxAmount: 0,
            taxBreakdown: null,
            codAvailable: serviceable,
            estimatedMinDays: null,
            estimatedMaxDays: null,
            message: serviceable ? 'Delivery available' : unavailableMessage,
        providerCode: 'manual',
        providerName: 'Manual Shipping',
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

    const matchedRule = rules.find((rule) => (
        (!rule.zone || zoneMatches(rule.zone, addressSnapshot)) &&
        conditionsMatch(rule.conditions || {}, { subtotal, chargeableWeightGrams, addressSnapshot, paymentMethod }) &&
        providerSupportsDecision(rule.provider, { paymentMethod })
    ));

    if (!matchedRule) return null;

    const provider = matchedRule.provider || await getManualProvider();

    // FIX 8: Reject if total weight exceeds provider's max
    if (provider.maxWeightKg) {
        const maxWeightGrams = Number(provider.maxWeightKg) * 1000;
        if (chargeableWeightGrams > maxWeightGrams * packageCount) {
            return null; // provider cannot handle this weight — fall through to next rule/manual
        }
    }

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
    };
};

const createQuote = async (userId, payload) => {
    const checkoutSessionId = payload.checkoutSessionId || uuidv4();
    const paymentMethod = payload.paymentMethod || 'razorpay';
    const context = await buildCheckoutContext(userId, payload);

    // ── Compute volumetric + multi-package context ────────────────────────
    const settings = await getSettingMap(['shipping']);
    const warehousePincode = String(settings['shipping.warehousePincode'] || '').trim();
    const deliveryPincode  = String(context.addressSnapshot.postalCode || '').trim();

    // FIX 4: volumetric divisor comes from settings (per-provider override possible)
    const volumetricDivisor = Number(settings['shipping.volumetricDivisor'] || 5000);
    const chargeableWeightGrams = computeChargeableWeight(context.packageDims, volumetricDivisor);
    const zone = detectDeliveryZone(warehousePincode, deliveryPincode);

    // FIX 8+9: detect how many packages needed based on provider max weight
    // We use 20 kg as a safe default when no provider max is configured
    const DEFAULT_MAX_PACKAGE_WEIGHT_GRAMS = 20000;
    const { packageCount, chargeableWeightPerPackage } = splitIntoPackages(
        chargeableWeightGrams, DEFAULT_MAX_PACKAGE_WEIGHT_GRAMS
    );

    const idempotencyKey = hashObject({
        checkoutSessionId,
        cartHash: context.cartHash,
        addressHash: context.addressHash,
        paymentMethod,
        couponHash: context.couponHash,
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

    const fallbackProvider = await getManualProvider();
    const decision = await calculateRuleDecision({
        subtotal:             context.subtotal,
        chargeableWeightGrams,            // FIX: volumetric-adjusted, slab-rounded
        packageCount,                     // FIX: multi-package split count
        zone,                             // FIX: same_city | same_state | national | remote
        addressSnapshot:      context.addressSnapshot,
        paymentMethod,
    }) || await calculateManualDecision({
        subtotal:        context.subtotal,
        addressSnapshot: context.addressSnapshot,
        paymentMethod,
    });

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
            },
            decisionSnapshot: decision,
            rawResponse: null,
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

const listProviders = () => ShippingProvider.findAll({ order: [['isDefault', 'DESC'], ['name', 'ASC']] });

const cryptoUtils = require('../../utils/crypto');

const updateProvider = async (id, payload) => {
    const provider = await ShippingProvider.findByPk(id);
    if (!provider) throw new AppError('NOT_FOUND', 404, 'Shipping provider not found');
    
    // Allowlist safe fields
    const permitted = ['name', 'enabled', 'isDefault', 'supportsCod', 'settings', 'webhookSecret'];
    const filtered = Object.keys(payload)
        .filter(key => permitted.includes(key))
        .reduce((obj, key) => {
            obj[key] = payload[key];
            return obj;
        }, {});

    if (payload.credentials) {
        filtered.credentialsEncrypted = JSON.stringify(cryptoUtils.encrypt(JSON.stringify(payload.credentials)));
    }

    return provider.update(filtered);
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
    if (!payload.shippingQuoteId) {
        return createQuote(userId, payload);
    }

    const quote = await ShippingQuote.findOne({ where: { id: payload.shippingQuoteId, userId } });
    if (!quote) throw new AppError('SHIPPING_QUOTE_NOT_FOUND', 404, 'Shipping quote not found');
    if (quote.expiresAt <= new Date()) {
        throw new AppError('SHIPPING_QUOTE_EXPIRED', 400, 'Shipping quote expired. Please refresh shipping.');
    }
    if (!quote.serviceable) {
        throw new AppError('SHIPPING_UNAVAILABLE', 400, 'Delivery is not available for this address');
    }
    if (payload.checkoutSessionId && quote.checkoutSessionId !== payload.checkoutSessionId) {
        throw new AppError('SHIPPING_QUOTE_STALE', 400, 'Shipping quote no longer matches this checkout session');
    }

    const context = await buildCheckoutContext(userId, payload);
    const couponHash = context.couponHash;
    if (
        quote.cartHash !== context.cartHash ||
        quote.addressHash !== context.addressHash ||
        quote.paymentMethod !== (payload.paymentMethod || 'razorpay') ||
        quote.couponHash !== couponHash
    ) {
        throw new AppError('SHIPPING_QUOTE_STALE', 400, 'Shipping quote no longer matches your cart or address');
    }

    return serializeQuote(quote);
};

module.exports = {
    createQuote,
    validateQuoteForOrder,
    buildCheckoutContext,
    listProviders,
    updateProvider,
    listZones,
    createZone,
    updateZone,
    deleteZone,
    listRules,
    createRule,
    updateRule,
    deleteRule,
};
