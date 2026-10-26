'use strict';

const groupKey = (row) => row.attributeId || `custom:${String(row.customName || '').trim().toLowerCase()}`;
const orderedRows = (rows = []) => [...rows].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
    || new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime() || String(a.id || '').localeCompare(String(b.id || '')));

// Product assignment order overrides reusable template/value order only for this product.
const orderProductPresentation = (product) => {
    if (!Array.isArray(product.attributes)) return product;
    const attributes = orderedRows(product.attributes);
    const groups = new Map();
    attributes.forEach((row) => {
        const key = groupKey(row);
        if (!groups.has(key)) groups.set(key, { order: groups.size, values: new Map() });
        const group = groups.get(key);
        group.values.set(row.valueId, group.values.size);
    });
    const variants = product.variants?.map((variant) => ({ ...variant, options: variant.options?.map((option) => {
        const group = groups.get(option.attributeId || option.attribute?.id);
        return group ? { ...option, attributeOrder: group.order, valueOrder: group.values.get(option.valueId || option.value?.id) ?? Number.MAX_SAFE_INTEGER } : option;
    }).sort((a, b) => (a.attributeOrder ?? Number.MAX_SAFE_INTEGER) - (b.attributeOrder ?? Number.MAX_SAFE_INTEGER)) }));
    return { ...product, attributes, ...(variants ? { variants } : {}) };
};

module.exports = { groupKey, orderedRows, orderProductPresentation };
