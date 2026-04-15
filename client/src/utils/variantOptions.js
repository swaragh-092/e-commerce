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
        valueId,
        valueLabel,
      };
    })
    .filter(Boolean);
};

export const getVariantOptionLabel = (variant) => {
  if (variant?.optionLabel) {
    return variant.optionLabel;
  }

  return getVariantOptionEntries(variant)
    .map((entry) => `${entry.attributeName}: ${entry.valueLabel}`)
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
          values: [],
        });
      }

      const group = groups.get(entry.attributeId);
      if (!group.values.some((value) => value.valueId === entry.valueId)) {
        group.values.push({
          valueId: entry.valueId,
          valueLabel: entry.valueLabel,
        });
      }
    });
  });

  return Array.from(groups.values());
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
