'use strict';

const { Op } = require('sequelize');
const {
    sequelize,
    Coupon,
    CouponUsage,
    Category,
    Product,
    Brand,
    Cart,
    CartItem,
    ProductVariant,
    Order,
} = require('../index');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const { getPagination } = require('../../utils/pagination');
const { ACTIONS, ENTITIES } = require('../../config/constants');
const { getEffectivePrice, getVariantUnitPrice, isSaleActive } = require('../product/product.pricing');

const ensureArray = (value) => (Array.isArray(value) ? [...new Set(value.filter(Boolean))] : []);

const normalizeStackingRules = (value = {}) => ({
    allowOrderDiscounts: Boolean(value?.allowOrderDiscounts),
    allowShippingDiscounts: value?.allowShippingDiscounts !== false,
    allowMultipleCoupons: Boolean(value?.allowMultipleCoupons),
});

const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getEvaluationRewardTypes = (evaluation) => {
    const rewardTypes = [];
    if (toNumber(evaluation.orderDiscount) > 0) rewardTypes.push('order');
    if (toNumber(evaluation.shippingDiscount) > 0) rewardTypes.push('shipping');
    return rewardTypes;
};

const canStackPair = (left, right) => {
    if (!left || !right) return false;
    if (left.coupon.id === right.coupon.id) return false;
    if (left.coupon.isExclusive || right.coupon.isExclusive) return false;
    if (!left.coupon.stackingRules.allowMultipleCoupons || !right.coupon.stackingRules.allowMultipleCoupons) {
        return false;
    }

    const leftRewards = getEvaluationRewardTypes(left);
    const rightRewards = getEvaluationRewardTypes(right);

    const leftAllowsRight = rightRewards.every((rewardType) => (
        rewardType === 'shipping'
            ? left.coupon.stackingRules.allowShippingDiscounts
            : left.coupon.stackingRules.allowOrderDiscounts
    ));
    const rightAllowsLeft = leftRewards.every((rewardType) => (
        rewardType === 'shipping'
            ? right.coupon.stackingRules.allowShippingDiscounts
            : right.coupon.stackingRules.allowOrderDiscounts
    ));

    return leftAllowsRight && rightAllowsLeft;
};

const buildCombinationResult = (evaluations, context, { source = 'manual' } = {}) => {
    const safeEvaluations = (evaluations || []).filter(Boolean);
    const orderDiscount = Math.min(
        context.cartSubtotal,
        Number(safeEvaluations.reduce((sum, evaluation) => sum + toNumber(evaluation.orderDiscount), 0).toFixed(2))
    );
    const shippingDiscount = Math.min(
        context.shippingCost,
        Number(safeEvaluations.reduce((sum, evaluation) => sum + toNumber(evaluation.shippingDiscount), 0).toFixed(2))
    );
    const totalDiscount = Number((orderDiscount + shippingDiscount).toFixed(2));

    return {
        appliedCoupons: safeEvaluations.map((evaluation) => ({
            ...evaluation.coupon,
            orderDiscount: Number(toNumber(evaluation.orderDiscount).toFixed(2)),
            shippingDiscount: Number(toNumber(evaluation.shippingDiscount).toFixed(2)),
            totalDiscount: Number(toNumber(evaluation.totalDiscount).toFixed(2)),
        })),
        primaryCoupon: safeEvaluations[0]?.coupon || null,
        orderDiscount,
        shippingDiscount,
        totalDiscount,
        freeShipping: shippingDiscount > 0,
        source,
        message: safeEvaluations.length === 0
            ? 'No eligible coupon applied'
            : safeEvaluations.length === 1
                ? safeEvaluations[0].message
                : `${safeEvaluations.length} promotions applied`,
    };
};

const chooseStackedEvaluations = (evaluations, context, seedEvaluations = []) => {
    const selected = [...seedEvaluations];
    const chosenIds = new Set(selected.map((evaluation) => evaluation.coupon.id));
    const sortedCandidates = [...evaluations]
        .filter((evaluation) => !chosenIds.has(evaluation.coupon.id))
        .sort((left, right) => {
            if (right.totalDiscount !== left.totalDiscount) return right.totalDiscount - left.totalDiscount;
            if ((right.coupon.priority || 0) !== (left.coupon.priority || 0)) {
                return (right.coupon.priority || 0) - (left.coupon.priority || 0);
            }
            return String(left.coupon.code || '').localeCompare(String(right.coupon.code || ''));
        });

    for (const candidate of sortedCandidates) {
        const compatibleWithAll = selected.every((existing) => canStackPair(existing, candidate));
        if (compatibleWithAll) {
            selected.push(candidate);
        }
    }

    return buildCombinationResult(selected, context, {
        source: seedEvaluations.length > 0 ? 'manual+auto' : 'auto',
    });
};

const getCouponStatus = (coupon, referenceDate = new Date()) => {
    if (coupon.campaignStatus === 'draft') return 'draft';
    if (coupon.campaignStatus === 'paused') return 'paused';
    if (coupon.campaignStatus === 'archived') return 'archived';
    if (!coupon.isActive) return 'paused';
    if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && coupon.usedCount >= coupon.usageLimit) {
        return 'usage_limit_reached';
    }

    const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    if (coupon.startDate && now < new Date(coupon.startDate)) return 'scheduled';
    if (coupon.endDate && now > new Date(coupon.endDate)) return 'expired';
    return 'active';
};

const buildCouponSummary = (coupon) => {
    const label =
        coupon.type === 'percentage'
            ? `${toNumber(coupon.value)}% off`
            : coupon.type === 'fixed_amount'
                ? `${toNumber(coupon.value).toFixed(2)} off`
                : 'Free shipping';

    const parts = [label];
    if (toNumber(coupon.minOrderAmount) > 0) {
        parts.push(`min order ${toNumber(coupon.minOrderAmount).toFixed(2)}`);
    }
    if (coupon.applicableTo !== 'all' && ensureArray(coupon.applicableIds).length > 0) {
        parts.push(`applies to selected ${coupon.applicableTo}s`);
    }
    if (coupon.customerEligibility === 'first_order') {
        parts.push('first order only');
    }
    if (coupon.excludeSaleItems) {
        parts.push('excludes sale items');
    }
    if (coupon.applicationMode === 'auto') {
        parts.push('auto-applies when eligible');
    } else if (coupon.applicationMode === 'suggest') {
        parts.push('suggested when eligible');
    }

    return parts.join(' • ');
};

const serializeCoupon = (coupon, { forPublic = false } = {}) => {
    const plain = typeof coupon.toJSON === 'function' ? coupon.toJSON() : { ...coupon };
    const serialized = {
        ...plain,
        value: toNumber(plain.value),
        minOrderAmount: toNumber(plain.minOrderAmount),
        maxDiscount: plain.maxDiscount === null || plain.maxDiscount === undefined ? null : toNumber(plain.maxDiscount),
        usedCount: Number(plain.usedCount || 0),
        usageLimit: plain.usageLimit === null || plain.usageLimit === undefined ? null : Number(plain.usageLimit),
        perUserLimit: Number(plain.perUserLimit || 1),
        applicableIds: ensureArray(plain.applicableIds),
        excludedProductIds: ensureArray(plain.excludedProductIds),
        excludedCategoryIds: ensureArray(plain.excludedCategoryIds),
        excludedBrandIds: ensureArray(plain.excludedBrandIds),
        campaignStatus: plain.campaignStatus || 'active',
        applicationMode: plain.applicationMode || 'manual',
        stackingRules: normalizeStackingRules(plain.stackingRules),
    };

    serialized.status = getCouponStatus(serialized);
    serialized.summary = buildCouponSummary(serialized);

    if (forPublic) {
        return {
            code: serialized.code,
            name: serialized.name,
            description: serialized.description,
            type: serialized.type,
            value: serialized.value,
            minOrderAmount: serialized.minOrderAmount,
            maxDiscount: serialized.maxDiscount,
            applicableTo: serialized.applicableTo,
            excludeSaleItems: serialized.excludeSaleItems,
            customerEligibility: serialized.customerEligibility,
            applicationMode: serialized.applicationMode,
            endDate: serialized.endDate,
            summary: serialized.summary,
        };
    }

    return serialized;
};

const normalizeCouponPayload = (payload, existing = {}) => {
    const merged = { ...existing, ...payload };
    const normalized = { ...payload };

    if ('campaignStatus' in payload) {
        normalized.campaignStatus = payload.campaignStatus;
        normalized.isActive = payload.campaignStatus === 'active';
    } else if ('isActive' in payload && !('campaignStatus' in existing)) {
        normalized.campaignStatus = payload.isActive ? 'active' : 'paused';
    }

    if ('applicationMode' in payload || 'applicationMode' in existing) {
        normalized.applicationMode = payload.applicationMode ?? existing.applicationMode ?? 'manual';
    }

    if ('stackingRules' in payload || 'stackingRules' in existing) {
        normalized.stackingRules = normalizeStackingRules(payload.stackingRules ?? existing.stackingRules);
    }

    if ('name' in payload || !existing.name) {
        normalized.name = String(payload.name ?? existing.name ?? merged.code ?? '').trim();
    }

    if ('description' in payload || ('description' in existing && existing.description !== undefined)) {
        const nextDescription = payload.description ?? existing.description ?? null;
        normalized.description = nextDescription ? String(nextDescription).trim() : null;
    }

    ['applicableIds', 'excludedProductIds', 'excludedCategoryIds', 'excludedBrandIds'].forEach((field) => {
        if (field in payload || field in existing) {
            normalized[field] = ensureArray(payload[field] ?? existing[field]);
        }
    });

    if ((payload.applicableTo ?? existing.applicableTo) === 'all') {
        normalized.applicableIds = [];
    }

    const nextType = payload.type ?? existing.type;
    if (nextType === 'free_shipping') {
        normalized.value = 0;
        normalized.maxDiscount = null;
    } else if ('value' in payload) {
        normalized.value = toNumber(payload.value);
    }

    if ('maxDiscount' in payload) {
        normalized.maxDiscount = payload.maxDiscount === null || payload.maxDiscount === '' ? null : toNumber(payload.maxDiscount);
    }
    if ('minOrderAmount' in payload) {
        normalized.minOrderAmount = toNumber(payload.minOrderAmount);
    }
    if ('priority' in payload) {
        normalized.priority = Number(payload.priority || 0);
    }

    return normalized;
};

const assertCouponRules = (coupon) => {
    if (!coupon.name) {
        throw new AppError('VALIDATION_ERROR', 400, 'Coupon name is required');
    }
    if (coupon.type === 'percentage' && toNumber(coupon.value) > 100) {
        throw new AppError('VALIDATION_ERROR', 400, 'Percentage cannot exceed 100');
    }
    if (coupon.type !== 'free_shipping' && toNumber(coupon.value) <= 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Coupon value must be greater than 0');
    }
    if (coupon.type === 'free_shipping' && toNumber(coupon.value) !== 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Free shipping coupons must have a value of 0');
    }
    if (coupon.startDate && coupon.endDate && new Date(coupon.endDate) <= new Date(coupon.startDate)) {
        throw new AppError('VALIDATION_ERROR', 400, 'End date must be after start date');
    }
    if (coupon.applicableTo !== 'all' && ensureArray(coupon.applicableIds).length === 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Select at least one target for this coupon');
    }
    if (!['manual', 'suggest', 'auto'].includes(coupon.applicationMode || 'manual')) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid coupon application mode');
    }
};

const list = async ({ page, limit }) => {
    const { limit: lmt, offset } = getPagination(page, limit);
    const result = await Coupon.findAndCountAll({
        limit: lmt,
        offset,
        order: [
            ['priority', 'DESC'],
            ['createdAt', 'DESC'],
        ],
    });

    return {
        count: result.count,
        rows: result.rows.map((row) => serializeCoupon(row)),
    };
};

const findById = async (id) => {
    const item = await Coupon.findByPk(id);
    if (!item) throw new AppError('NOT_FOUND', 404, 'Coupon not found');
    return serializeCoupon(item);
};

const create = async (payload, actingUserId) => {
    return sequelize.transaction(async (t) => {
        const normalizedPayload = normalizeCouponPayload(payload);
        assertCouponRules(normalizedPayload);

        const item = await Coupon.create(normalizedPayload, { transaction: t });

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: ACTIONS.CREATE,
                    entity: ENTITIES.COUPON,
                    entityId: item.id,
                }, t);
            }
        } catch (err) {}

        return serializeCoupon(item);
    });
};

const update = async (id, payload, actingUserId) => {
    return sequelize.transaction(async (t) => {
        const item = await Coupon.findByPk(id, { transaction: t });
        if (!item) throw new AppError('NOT_FOUND', 404, 'Coupon not found');

        const before = serializeCoupon(item);
        const normalizedPayload = normalizeCouponPayload(payload, before);
        const mergedCoupon = { ...before, ...normalizedPayload };
        assertCouponRules(mergedCoupon);

        await item.update(normalizedPayload, { transaction: t });

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: ACTIONS.UPDATE,
                    entity: ENTITIES.COUPON,
                    entityId: id,
                    changes: { before, after: serializeCoupon(item) },
                }, t);
            }
        } catch (err) {}

        return serializeCoupon(item);
    });
};

const remove = async (id, actingUserId) => {
    return sequelize.transaction(async (t) => {
        const item = await Coupon.findByPk(id, { transaction: t });
        if (!item) throw new AppError('NOT_FOUND', 404, 'Coupon not found');
        await item.destroy({ transaction: t });

        try {
            if (AuditService && AuditService.log) {
                await AuditService.log({
                    userId: actingUserId,
                    action: ACTIONS.DELETE,
                    entity: ENTITIES.COUPON,
                    entityId: id,
                }, t);
            }
        } catch (err) {}
    });
};

const mapCartLine = (item) => {
    const product = item.currentProduct || item.product;
    if (!product) return null;

    const unitPrice = getVariantUnitPrice(product, item.variant);
    const quantity = Number(item.quantity || 0);

    return {
        productId: product.id,
        productName: product.name,
        brandId: product.brandId || product.brand?.id || null,
        categoryIds: Array.isArray(product.categories) ? product.categories.map((category) => category.id) : [],
        quantity,
        unitPrice,
        lineSubtotal: Number((unitPrice * quantity).toFixed(2)),
        isSaleItem: product.isSaleActive !== undefined ? Boolean(product.isSaleActive) : isSaleActive(product),
    };
};

const loadActiveCartLines = async (userId) => {
    if (!userId) return [];

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
                { model: ProductVariant, as: 'variant', required: false },
            ],
        }],
    });

    if (!cart?.items?.length) return [];
    return cart.items.map(mapCartLine).filter(Boolean);
};

const buildValidationContext = async (userId, rawContext = {}) => {
    const legacyContext = typeof rawContext === 'number' ? { cartSubtotal: rawContext } : (rawContext || {});
    let cartItems = Array.isArray(legacyContext.cartItems)
        ? legacyContext.cartItems.map(mapCartLine).filter(Boolean)
        : [];

    if (!cartItems.length) {
        cartItems = await loadActiveCartLines(userId);
    }

    const cartSubtotal = Number.isFinite(Number(legacyContext.cartSubtotal))
        ? Number(legacyContext.cartSubtotal)
        : cartItems.reduce((sum, item) => sum + item.lineSubtotal, 0);

    return {
        cartItems,
        cartSubtotal: Number(cartSubtotal.toFixed(2)),
        shippingCost: Number(toNumber(legacyContext.shippingCost).toFixed(2)),
    };
};

const matchesCouponTarget = (coupon, line) => {
    const applicableIds = ensureArray(coupon.applicableIds);
    const excludedProductIds = ensureArray(coupon.excludedProductIds);
    const excludedCategoryIds = ensureArray(coupon.excludedCategoryIds);
    const excludedBrandIds = ensureArray(coupon.excludedBrandIds);

    let included = true;
    if (coupon.applicableTo === 'product') {
        included = applicableIds.includes(line.productId);
    } else if (coupon.applicableTo === 'category') {
        included = line.categoryIds.some((categoryId) => applicableIds.includes(categoryId));
    } else if (coupon.applicableTo === 'brand') {
        included = Boolean(line.brandId) && applicableIds.includes(line.brandId);
    }

    if (!included) return false;
    if (excludedProductIds.includes(line.productId)) return false;
    if (line.categoryIds.some((categoryId) => excludedCategoryIds.includes(categoryId))) return false;
    if (line.brandId && excludedBrandIds.includes(line.brandId)) return false;
    if (coupon.excludeSaleItems && line.isSaleItem) return false;

    return true;
};

const assertCouponIsUsable = async (coupon, userId, cartSubtotal) => {
    const status = getCouponStatus(coupon);
    if (status === 'draft') throw new AppError('VALIDATION_ERROR', 400, 'Coupon is still in draft');
    if (status === 'paused') throw new AppError('VALIDATION_ERROR', 400, 'Coupon is paused');
    if (status === 'archived') throw new AppError('VALIDATION_ERROR', 400, 'Coupon is archived');
    if (status === 'scheduled' || status === 'expired') {
        throw new AppError('VALIDATION_ERROR', 400, 'Coupon is expired or not yet valid');
    }
    if (status === 'usage_limit_reached') {
        throw new AppError('VALIDATION_ERROR', 400, 'Coupon usage limit reached');
    }

    if (coupon.customerEligibility === 'authenticated' && !userId) {
        throw new AppError('VALIDATION_ERROR', 400, 'You must be signed in to use this coupon');
    }

    if (coupon.customerEligibility === 'first_order') {
        if (!userId) {
            throw new AppError('VALIDATION_ERROR', 400, 'This coupon is only available for first-time customers');
        }

        const completedOrderCount = await Order.count({
            where: {
                userId,
                status: { [Op.notIn]: ['cancelled'] },
            },
        });

        if (completedOrderCount > 0) {
            throw new AppError('VALIDATION_ERROR', 400, 'This coupon is only available on your first order');
        }
    }

    const userCount = await CouponUsage.count({ where: { couponId: coupon.id, userId } });
    if (userCount >= coupon.perUserLimit) {
        throw new AppError('VALIDATION_ERROR', 400, 'You have exceeded the usage limit for this coupon');
    }

    if (cartSubtotal < coupon.minOrderAmount) {
        throw new AppError('VALIDATION_ERROR', 400, `Minimum order amount of ${coupon.minOrderAmount} required`);
    }
};

const evaluateCouponAgainstContext = async (coupon, userId, context) => {
    await assertCouponIsUsable(coupon, userId, context.cartSubtotal);

    const eligibleItems = context.cartItems.filter((line) => matchesCouponTarget(coupon, line));
    const eligibleSubtotal = context.cartItems.length
        ? Number(eligibleItems.reduce((sum, item) => sum + item.lineSubtotal, 0).toFixed(2))
        : context.cartSubtotal;

    const needsItemMatching = coupon.applicableTo !== 'all'
        || coupon.excludeSaleItems
        || coupon.excludedProductIds.length > 0
        || coupon.excludedCategoryIds.length > 0
        || coupon.excludedBrandIds.length > 0;

    if (needsItemMatching && context.cartItems.length === 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Coupon eligibility could not be verified for your cart');
    }
    if (needsItemMatching && eligibleSubtotal <= 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Coupon does not apply to items in your cart');
    }

    let orderDiscount = 0;
    const baseAmount = eligibleSubtotal || context.cartSubtotal;
    if (coupon.type === 'fixed_amount') {
        orderDiscount = Math.min(coupon.value, baseAmount);
    } else if (coupon.type === 'percentage') {
        orderDiscount = (coupon.value / 100) * baseAmount;
        if (coupon.maxDiscount && orderDiscount > coupon.maxDiscount) {
            orderDiscount = coupon.maxDiscount;
        }
    }

    const freeShipping = coupon.type === 'free_shipping';
    const shippingDiscount = freeShipping ? context.shippingCost : 0;
    const totalDiscount = Number((orderDiscount + shippingDiscount).toFixed(2));

    return {
        coupon: {
            id: coupon.id,
            code: coupon.code,
            name: coupon.name,
            description: coupon.description,
            type: coupon.type,
            value: coupon.value,
            applicableTo: coupon.applicableTo,
            visibility: coupon.visibility,
            customerEligibility: coupon.customerEligibility,
            isExclusive: coupon.isExclusive,
            priority: coupon.priority,
            applicationMode: coupon.applicationMode,
            stackingRules: coupon.stackingRules,
            campaignStatus: coupon.campaignStatus,
            summary: coupon.summary,
        },
        eligibleSubtotal,
        orderDiscount: Number(orderDiscount.toFixed(2)),
        shippingDiscount: Number(shippingDiscount.toFixed(2)),
        totalDiscount,
        freeShipping,
        message: freeShipping
            ? 'Coupon applied: Free shipping'
            : `Coupon applied: ${coupon.type === 'percentage' ? `${coupon.value}% off` : 'Fixed amount off'}`,
    };
};

const validateCoupon = async (code, userId, rawContext = {}) => {
    const couponRecord = await Coupon.findOne({ where: { code: code.toUpperCase() } });
    if (!couponRecord) throw new AppError('NOT_FOUND', 404, 'Coupon not found');

    const coupon = serializeCoupon(couponRecord);
    const context = await buildValidationContext(userId, rawContext);
    const primaryEvaluation = await evaluateCouponAgainstContext(coupon, userId, context);

    const autoCouponRecords = await Coupon.findAll({
        where: {
            visibility: 'public',
            applicationMode: 'auto',
        },
        order: [
            ['priority', 'DESC'],
            ['createdAt', 'DESC'],
        ],
    });

    const autoEvaluations = [];
    for (const couponRecordItem of autoCouponRecords) {
        const autoCoupon = serializeCoupon(couponRecordItem);
        if (autoCoupon.id === coupon.id) continue;

        try {
            const evaluation = await evaluateCouponAgainstContext(autoCoupon, userId, context);
            autoEvaluations.push(evaluation);
        } catch (error) {
            // Ignore ineligible auto coupons during manual validation.
        }
    }

    const combination = chooseStackedEvaluations(autoEvaluations, context, [primaryEvaluation]);

    return {
        ...combination,
        coupon: combination.primaryCoupon,
        eligibleSubtotal: primaryEvaluation.eligibleSubtotal,
        autoAppliedCoupon: combination.appliedCoupons.find((item) => item.applicationMode === 'auto') || null,
    };
};

const resolveCoupons = async (codes = [], userId, rawContext = {}) => {
    const normalizedCodes = [...new Set((codes || [])
        .map((code) => String(code || '').trim().toUpperCase())
        .filter(Boolean))];
    const context = await buildValidationContext(userId, rawContext);

    const manualEvaluations = [];
    for (const code of normalizedCodes) {
        const couponRecord = await Coupon.findOne({ where: { code } });
        if (!couponRecord) {
            throw new AppError('NOT_FOUND', 404, `Coupon ${code} not found`);
        }

        const coupon = serializeCoupon(couponRecord);
        const evaluation = await evaluateCouponAgainstContext(coupon, userId, context);

        const incompatibleCoupon = manualEvaluations.find((existing) => !canStackPair(existing, evaluation));
        if (incompatibleCoupon) {
            throw new AppError(
                'VALIDATION_ERROR',
                400,
                `Coupons ${incompatibleCoupon.coupon.code} and ${evaluation.coupon.code} cannot be combined`
            );
        }

        manualEvaluations.push(evaluation);
    }

    const autoCouponRecords = await Coupon.findAll({
        where: {
            visibility: 'public',
            applicationMode: 'auto',
        },
        order: [
            ['priority', 'DESC'],
            ['createdAt', 'DESC'],
        ],
    });

    const autoEvaluations = [];
    const selectedIds = new Set(manualEvaluations.map((evaluation) => evaluation.coupon.id));
    for (const couponRecord of autoCouponRecords) {
        const autoCoupon = serializeCoupon(couponRecord);
        if (selectedIds.has(autoCoupon.id)) continue;

        try {
            const evaluation = await evaluateCouponAgainstContext(autoCoupon, userId, context);
            autoEvaluations.push(evaluation);
        } catch (error) {
            // Ignore ineligible auto coupons.
        }
    }

    const combination = chooseStackedEvaluations(autoEvaluations, context, manualEvaluations);

    return {
        ...combination,
        coupon: combination.primaryCoupon,
        couponCodes: combination.appliedCoupons.map((coupon) => coupon.code),
        autoAppliedCoupon: combination.appliedCoupons.find((item) => item.applicationMode === 'auto') || null,
    };
};

const getEligibleCoupons = async (userId, rawContext = {}) => {
    const context = await buildValidationContext(userId, rawContext);
    const candidateCoupons = await Coupon.findAll({
        where: {
            visibility: 'public',
        },
        order: [
            ['priority', 'DESC'],
            ['createdAt', 'DESC'],
        ],
    });

    const evaluations = await Promise.all(candidateCoupons.map(async (couponRecord) => {
        const coupon = serializeCoupon(couponRecord);
        try {
            return await evaluateCouponAgainstContext(coupon, userId, context);
        } catch (error) {
            return null;
        }
    }));

    const eligibleCoupons = evaluations
        .filter(Boolean)
        .sort((left, right) => {
            if (right.totalDiscount !== left.totalDiscount) return right.totalDiscount - left.totalDiscount;
            if ((right.coupon?.priority || 0) !== (left.coupon?.priority || 0)) {
                return (right.coupon?.priority || 0) - (left.coupon?.priority || 0);
            }
            return String(left.coupon?.code || '').localeCompare(String(right.coupon?.code || ''));
        });

    const suggestedCoupons = eligibleCoupons.filter((item) => ['suggest', 'auto'].includes(item.coupon.applicationMode));
    const autoSeed = eligibleCoupons.find((item) => item.coupon.applicationMode === 'auto');
    const autoAppliedCoupon = autoSeed || null;
    const bestCombination = chooseStackedEvaluations(
        eligibleCoupons,
        context,
        autoSeed ? [autoSeed] : []
    );

    return {
        eligibleCoupons,
        suggestedCoupons,
        bestCoupon: eligibleCoupons[0] || null,
        autoAppliedCoupon,
        bestCombination,
        autoAppliedCoupons: bestCombination.appliedCoupons.filter((item) => item.applicationMode === 'auto'),
    };
};

const listPublic = async () => {
    const activeCoupons = await Coupon.findAll({
        where: {
            visibility: 'public',
            isActive: true,
        },
        order: [
            ['priority', 'DESC'],
            ['value', 'DESC'],
            ['createdAt', 'DESC'],
        ],
    });

    return activeCoupons
        .map((coupon) => serializeCoupon(coupon))
        .filter((coupon) => coupon.status === 'active')
        .map((coupon) => serializeCoupon(coupon, { forPublic: true }));
};

module.exports = { list, findById, create, update, remove, validateCoupon, resolveCoupons, listPublic, getEligibleCoupons };
