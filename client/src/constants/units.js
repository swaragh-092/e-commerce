import standardUnits from '../../../shared/units.json';

export const getAttributeUnitCategory = (attribute, units) => attribute.unitCategory || units.find((unit) =>
  [unit.value, unit.label].some((value) => value.toLowerCase() === String(attribute.unit || '').trim().toLowerCase())
)?.category || '';

export const STANDARD_UNITS = standardUnits;

export const normalizeUnitCategoryName = (name) => String(name || '').trim().replace(/\s+/g, ' ');

export const getUnitCategories = (units, registered) => {
  const names = new Map();
  [...(Array.isArray(registered) ? registered : []), ...units.filter((unit) => !unit.deleted).map((unit) => unit.category)].forEach((name) => {
    if (typeof name !== 'string') return;
    const normalized = normalizeUnitCategoryName(name);
    if (normalized && !names.has(normalized.toLowerCase())) names.set(normalized.toLowerCase(), normalized);
  });
  return [...names.values()].sort((a, b) => a.localeCompare(b));
};

// Settings contain overrides and custom units. Missing definitions retain their
// built-in defaults. Deletion markers keep removed built-ins from reappearing;
// neither hiding nor deleting a definition changes saved attribute values.
export const mergeUnitCatalog = (definitions, { includeDeleted = false } = {}) => {
  const catalog = new Map(STANDARD_UNITS.map((unit) => [unit.value.toLowerCase(), { ...unit, enabled: true }]));
  if (Array.isArray(definitions)) {
    definitions.forEach((unit) => {
      if (!unit || typeof unit.value !== 'string' || !unit.value.trim() ||
          typeof unit.label !== 'string' || !unit.label.trim() ||
          typeof unit.category !== 'string' || !unit.category.trim()) return;
      const key = unit.value.trim().toLowerCase();
      catalog.set(key, {
        value: catalog.get(key)?.value || unit.value.trim(),
        label: unit.label.trim(),
        category: normalizeUnitCategoryName(unit.category),
        enabled: unit.deleted ? false : unit.enabled !== false,
        ...(unit.deleted ? { deleted: true } : {}),
      });
    });
  }
  return [...catalog.values()].filter((unit) => includeDeleted || !unit.deleted);
};

/**
 * Returns formatted label for unit or custom string fallback.
 */
export const getUnitLabel = (unitValue) => {
  if (!unitValue) return '';
  const trimmed = String(unitValue).trim();
  const found = STANDARD_UNITS.find(
    (u) => u.value.toLowerCase() === trimmed.toLowerCase() || u.label.toLowerCase() === trimmed.toLowerCase()
  );
  return found ? found.label : trimmed;
};

/**
 * Normalizes user input or selected option to canonical unit value string.
 */
export const normalizeUnitValue = (unitValue) => {
  if (!unitValue) return '';
  const trimmed = String(unitValue).trim();
  const found = STANDARD_UNITS.find(
    (u) => u.value.toLowerCase() === trimmed.toLowerCase() || u.label.toLowerCase() === trimmed.toLowerCase()
  );
  return found ? found.value : trimmed;
};
