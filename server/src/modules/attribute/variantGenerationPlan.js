'use strict';

const { createHash } = require('crypto');
const AppError = require('../../utils/AppError');

const MAX_VARIANTS = 500;
const signature = (options) => options.map((option) => option.valueId).sort().join(',');
const valueLabel = (value, attribute) => {
    const label = String(value.displayLabel || value.value || '').trim();
    const unit = String(value.unitLabel || attribute.unit || '').trim();
    return unit && !label.toLowerCase().endsWith(unit.toLowerCase()) ? `${label} ${unit}` : label;
};

// This same plan powers the review screen and the transactional write.
const buildVariantGenerationPlan = (rows, variants) => {
    const byAttribute = new Map();
    for (const row of rows) {
        // Legacy product-only specifications remain display-only.
        if (!row.isVariantAttr || !row.attributeId || !row.valueId || !row.attribute || !row.value) continue;
        if (!byAttribute.has(row.attributeId)) byAttribute.set(row.attributeId, {
            id: row.attributeId, name: row.attribute.name, values: [],
        });
        const group = byAttribute.get(row.attributeId);
        if (!group.values.some((value) => value.valueId === row.valueId)) group.values.push({
            attributeId: row.attributeId, valueId: row.valueId, label: valueLabel(row.value, row.attribute),
        });
    }
    const groups = [...byAttribute.values()];
    if (!groups.length) throw new AppError('VALIDATION_ERROR', 400, 'Choose at least one attribute with “Use for variants” turned on.');
    const total = groups.reduce((count, group) => count * group.values.length, 1);
    if (total > MAX_VARIANTS) throw new AppError('VALIDATION_ERROR', 400, `These options create ${total} combinations. Choose fewer values to keep this product within ${MAX_VARIANTS} variants.`);

    const combinations = groups.reduce((combos, group) => combos.flatMap((combo) => group.values.map((value) => [...combo, value])), [[]]);
    const existingSignatures = new Set(variants.map((variant) => signature(variant.options || [])));
    const wantedSignatures = new Set(combinations.map(signature));
    const added = combinations.filter((combo) => !existingSignatures.has(signature(combo)));
    const removed = variants.filter((variant) => !wantedSignatures.has(signature(variant.options || [])));
    const keptCount = variants.length - removed.length;
    // Detect a stale review, including edits to prices, stock or reservations.
    const token = createHash('sha256').update(JSON.stringify({
        selected: combinations.map(signature).sort(),
        variants: variants.map((variant) => [variant.id, signature(variant.options || []), variant.updatedAt,
            String(variant.price), Number(variant.stockQty || 0), Number(variant.reservedQty || 0), variant.sku, variant.isActive])
            .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    })).digest('hex');
    const removalRows = removed.map((variant) => ({
        id: variant.id,
        label: (variant.options || []).map((option) => option.value ? valueLabel(option.value, option.attribute || {}) : '').filter(Boolean).join(' / ') || variant.sku || 'Variant',
        stockQty: Number(variant.stockQty || 0), reservedQty: Number(variant.reservedQty || 0),
    }));
    return {
        added, removed,
        keptStock: variants.filter((variant) => wantedSignatures.has(signature(variant.options || [])) && variant.isActive !== false)
            .reduce((sum, variant) => sum + Number(variant.stockQty || 0), 0),
        review: {
            token, groups, total, addedCount: added.length, keptCount, removedCount: removed.length,
            blockedRemovalCount: removalRows.filter((variant) => variant.reservedQty > 0).length,
            combinations: combinations.slice(0, 12).map((combo) => ({ label: combo.map((value) => value.label).join(' / '), isNew: !existingSignatures.has(signature(combo)) })),
            removals: removalRows,
        },
    };
};

module.exports = { buildVariantGenerationPlan, MAX_VARIANTS };
