import { formatAttributeValue } from './attributePresentation';

export const getVariantOptionEntries = (variant) => {
  if (!Array.isArray(variant?.options)) {
    return [];
  }

  return variant.options
    .map((option) => {
      const attributeName = option?.attribute?.name;
      const attributeId = option?.attribute?.id || option?.attributeId;
      const valueLabel = option?.value?.value;
      const valueId = option?.value?.id || option?.valueId;

      if (!attributeName || !valueLabel || !attributeId || !valueId) {
        return null;
      }

      return {
        attributeId,
        attributeName,
        attribute: option?.attribute || null,
        attributeOrder: option.attributeOrder,
        valueOrder: option.valueOrder,
        valueId,
        valueLabel,
        value: option?.value || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.attributeOrder ?? Number.MAX_SAFE_INTEGER) - (b.attributeOrder ?? Number.MAX_SAFE_INTEGER));
};

export const getVariantOptionLabel = (variant) => {
  if (variant?.optionLabel) {
    return variant.optionLabel;
  }

  return getVariantOptionEntries(variant)
    .map((entry) => `${entry.attributeName}: ${formatAttributeValue(entry.value || { value: entry.valueLabel }, entry.attribute)}`)
    .join(', ');
};

export const getVariantAttributeGroups = (variants = []) => {
  const groups = new Map();

  variants.forEach((variant) => {
    getVariantOptionEntries(variant).forEach((entry) => {
      if (!groups.has(entry.attributeId)) {
        groups.set(entry.attributeId, {
          attributeId: entry.attributeId,
          attributeName: entry.attributeName,
          attribute: entry.attribute,
          sortOrder: entry.attributeOrder ?? Number.MAX_SAFE_INTEGER,
          values: [],
        });
      }

      const group = groups.get(entry.attributeId);
      if (!group.values.some((value) => value.valueId === entry.valueId)) {
        group.values.push({
          valueId: entry.valueId,
          valueLabel: entry.valueLabel,
          ...(entry.value || {}),
          sortOrder: entry.valueOrder ?? entry.value?.sortOrder ?? 0,
        });
      }
    });
  });

  return Array.from(groups.values()).sort((a, b) => a.sortOrder - b.sortOrder).map((group) => ({ ...group, values: group.values.sort((a, b) => a.sortOrder - b.sortOrder) }));
};

export const findMatchingVariant = (variants = [], selectedValues = {}) => {
  const selectedEntries = Object.entries(selectedValues).filter(([, valueId]) => Boolean(valueId));
  if (selectedEntries.length === 0) {
    return null;
  }

  return variants.find((variant) => {
    const optionEntries = getVariantOptionEntries(variant);
    if (optionEntries.length !== selectedEntries.length) {
      return false;
    }

    return selectedEntries.every(([attributeId, valueId]) => (
      optionEntries.some((entry) => entry.attributeId === attributeId && entry.valueId === valueId)
    ));
  }) || null;
};
