import { formatAttributeValue } from './attributePresentation';

export const validGroupPrice = (value) => value !== '' && value != null
  && /^\d+(\.\d{0,2})?$/.test(String(value)) && Number(value) <= 99999999.99;

export const priceOption = (option) => ({
  ...option,
  attributeId: option.attributeId || option.attribute?.id,
  valueId: option.valueId || option.value?.id,
});

export const getPriceAttributes = (rows, entries) => {
  const attributes = new Map();
  const rowMap = new Map(rows.map((row) => [JSON.stringify([row.attributeId, row.valueId]), row]));
  for (const entry of entries) {
    for (const raw of entry.options || []) {
      const option = priceOption(raw);
      if (!option.attributeId || !option.valueId) continue;
      const row = rowMap.get(JSON.stringify([option.attributeId, option.valueId]));
      if (!attributes.has(option.attributeId)) attributes.set(option.attributeId, {
        id: option.attributeId, name: row?.attribute?.name || option.attribute?.name || 'Attribute', values: new Map(),
      });
      attributes.get(option.attributeId).values.set(option.valueId,
        formatAttributeValue(row?.value || option.value || { value: option.valueId }, row?.attribute || option.attribute));
    }
  }
  return [...attributes.values()];
};

export const groupVariantPrices = (entries, attributes, selectedIds) => {
  const selected = attributes.filter((attribute) => selectedIds.includes(attribute.id));
  const groups = new Map();
  for (const entry of entries) {
    const options = (entry.options || []).map(priceOption);
    const values = selected.map((attribute) => options.find((option) => option.attributeId === attribute.id)?.valueId || null);
    const key = JSON.stringify(values);
    if (!groups.has(key)) groups.set(key, {
      key,
      label: selected.length ? selected.map((attribute, index) => `${attribute.name}: ${attribute.values.get(values[index]) || 'Not specified'}`).join(' / ') : 'All variants',
      entries: [],
    });
    groups.get(key).entries.push(entry);
  }
  return [...groups.values()].map((group) => {
    const prices = new Set(group.entries.map((entry) => validGroupPrice(entry.price) ? Number(entry.price) : null));
    return { ...group, price: prices.size === 1 && !prices.has(null) ? String([...prices][0]) : '' };
  });
};
