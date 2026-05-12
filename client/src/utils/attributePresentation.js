const COLOR_NAME_MAP = {
  black: '#111827',
  white: '#ffffff',
  red: '#dc2626',
  blue: '#2563eb',
  green: '#16a34a',
  yellow: '#facc15',
  orange: '#f97316',
  purple: '#7c3aed',
  pink: '#ec4899',
  grey: '#6b7280',
  gray: '#6b7280',
  silver: '#c0c0c0',
  gold: '#d4af37',
  brown: '#92400e',
  beige: '#d6c3a5',
  navy: '#1e3a8a',
  maroon: '#7f1d1d',
};

const COMPACT_UNITS = new Set([
  'g', 'kg', 'mg', 'mm', 'cm', 'm', 'in', '"', 'ft', "'", 'gb', 'tb', 'mb', 'kb', 'ml', 'l',
]);

const normalizeText = (value = '') => String(value).trim().toLowerCase();

const getAttributeText = (attribute = {}) => normalizeText(`${attribute.name || ''} ${attribute.slug || ''}`);

const inferValueType = (attribute = {}) => {
  if (attribute.valueType && attribute.valueType !== 'auto') return attribute.valueType;

  const text = getAttributeText(attribute);
  if (/(colou?r|shade)/.test(text)) return 'color';
  if (/(pattern|print)/.test(text)) return 'pattern';
  if (/(size|shoe|waist)/.test(text)) return 'size';
  if (/(weight|pack weight|net weight)/.test(text)) return 'weight';
  if (/(length|width|height|dimension|diameter|thickness)/.test(text)) return 'length';
  if (/(storage|memory|ram|rom|ssd|hdd|capacity)/.test(text)) return 'storage';
  if (/(volume|quantity|bottle|liquid)/.test(text)) return 'volume';
  if (/(material|fabric)/.test(text)) return 'material';
  return 'text';
};

export const getSwatchColor = (value = {}) => {
  if (!value) return null;
  if (value.swatchColor) return value.swatchColor;
  const raw = normalizeText(value.displayLabel || value.value);
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(raw)) return raw;
  return COLOR_NAME_MAP[raw] || null;
};

export const formatAttributeValue = (value = {}, attribute = {}) => {
  if (!value) return '';
  const rawLabel = String(value.displayLabel || value.value || '').trim();
  const unit = String(value.unitLabel || attribute.unit || '').trim();
  if (!rawLabel || !unit) return rawLabel;

  const lowerLabel = rawLabel.toLowerCase();
  const lowerUnit = unit.toLowerCase();
  if (lowerLabel.endsWith(lowerUnit) || lowerLabel.includes(` ${lowerUnit}`)) return rawLabel;

  return COMPACT_UNITS.has(lowerUnit) ? `${rawLabel}${unit}` : `${rawLabel} ${unit}`;
};

export const resolveAttributePresentation = (group = {}) => {
  const attribute = group.attribute || {};
  const values = group.values || [];
  const explicitType = attribute.displayType && attribute.displayType !== 'auto' ? attribute.displayType : null;
  const valueType = inferValueType(attribute);

  if (explicitType) return { displayType: explicitType, valueType };
  if (values.some((value) => value.imageUrl)) return { displayType: 'image', valueType };
  if (valueType === 'color' || valueType === 'pattern') return { displayType: 'swatch', valueType };
  if (['size', 'weight', 'length', 'storage', 'volume'].includes(valueType)) return { displayType: 'button', valueType };
  if (values.length > 8) return { displayType: 'dropdown', valueType };
  return { displayType: 'chip', valueType };
};

export const getAttributeValueA11yLabel = (group, value, selected, disabled) => {
  const label = formatAttributeValue(value, group.attribute);
  const parts = [group.attributeName, label];
  if (selected) parts.push('selected');
  if (disabled) parts.push('unavailable');
  return parts.filter(Boolean).join(', ');
};
