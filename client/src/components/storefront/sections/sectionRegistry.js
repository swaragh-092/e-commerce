import productRow from '../../../../../shared/product-row.json';

import themeSections from '../../../../../shared/theme-sections.json';

const entries = Object.entries(themeSections.sections);
export const SECTION_TYPES = Object.freeze(Object.fromEntries(entries.map(([key, { type }]) => [key, type])));
export const SECTION_VARIANTS = Object.freeze(Object.fromEntries(entries.filter(([, definition]) => definition.variants).map(([, { type, variants }]) => [type, variants]).concat([[productRow.type, productRow.variants]])));
export const SECTION_BLOCK_SCHEMAS = Object.freeze(Object.fromEntries(entries.filter(([, definition]) => definition.blocks).map(([, { type, blocks }]) => [type, blocks])));
export const SECTION_DEFINITIONS = Object.freeze(Object.fromEntries(entries.map(([, definition]) => [
  definition.type,
  definition.type === productRow.type ? { ...definition, defaultVariant: productRow.defaults.variant } : definition,
])));
export const BLOCK_FIELD_PRESETS = Object.freeze(Object.fromEntries(entries.filter(([, definition]) => definition.itemEditor).map(([, { type, itemEditor }]) => [
  type,
  {
    ...itemEditor,
    label: (item, index) => itemEditor.labelKeys.map((key) => item?.[key]).find(Boolean) || `${itemEditor.fallbackLabel} ${index + 1}`,
    create: () => structuredClone(itemEditor.defaultItem),
  },
])));

export const SECTION_LABELS = Object.freeze(
  Object.fromEntries(Object.entries(SECTION_DEFINITIONS).map(([type, definition]) => [type, definition.label]))
);

const knownSectionTypes = new Set(Object.values(SECTION_TYPES));
const heroSectionTypes = new Set([SECTION_TYPES.HERO_CAROUSEL]);
const productDataSectionTypes = new Set([SECTION_TYPES.PRODUCT_ROW]);
const categoryDataSectionTypes = new Set([SECTION_TYPES.CATEGORY_SHORTCUTS, SECTION_TYPES.FEATURED_COLLECTION_GRID]);

export const getSectionType = (section) => String(section?.type || '').trim();

export const isKnownSectionType = (sectionOrType) => knownSectionTypes.has(
  typeof sectionOrType === 'string' ? sectionOrType : getSectionType(sectionOrType)
);

export const getSectionLabel = (sectionOrType) => {
  const type = typeof sectionOrType === 'string' ? sectionOrType : getSectionType(sectionOrType);
  return SECTION_LABELS[type] || type || 'Unknown section';
};

export const isHeroSection = (section) => heroSectionTypes.has(getSectionType(section));

export const needsProductData = (section, { pricingEnabled = true } = {}) => (
  productDataSectionTypes.has(getSectionType(section)) && (pricingEnabled || section?.source !== 'sale')
);

export const needsCategoryData = (section, { hasConfiguredTiles = false } = {}) => (
  categoryDataSectionTypes.has(getSectionType(section)) && !hasConfiguredTiles
);

export const getSectionDefinition = (sectionOrType) => {
  const type = typeof sectionOrType === 'string' ? sectionOrType : getSectionType(sectionOrType);
  return SECTION_DEFINITIONS[type] || null;
};

export const getSectionSupportSummary = (sections = []) => sections.reduce((summary, section) => {
  const definition = getSectionDefinition(section);
  if (!definition) {
    summary.unknown += 1;
    return summary;
  }
  if (definition.live) summary.live += 1;
  if (definition.preview) summary.preview += 1;
  summary.byFamily[definition.family] = (summary.byFamily[definition.family] || 0) + 1;
  summary.byData[definition.data] = (summary.byData[definition.data] || 0) + 1;
  return summary;
}, { live: 0, preview: 0, unknown: 0, byFamily: {}, byData: {} });

export const getRegisteredSectionTypes = () => [...knownSectionTypes];

export const getSectionVariants = (sectionOrType) => {
  const type = typeof sectionOrType === 'string' ? sectionOrType : getSectionType(sectionOrType);
  return SECTION_VARIANTS[type] || [];
};

export const getDefaultVariant = (sectionOrType) => {
  const def = getSectionDefinition(sectionOrType);
  return def?.defaultVariant || null;
};

export const resolveSectionVariant = (section) => {
  const type = getSectionType(section);
  const explicit = section?.variant || section?.layout;
  const variants = SECTION_VARIANTS[type];
  if (explicit && variants?.includes(explicit)) return explicit;
  return SECTION_DEFINITIONS[type]?.defaultVariant || null;
};

export const getSectionBlockSchema = (sectionOrType) => {
  const type = typeof sectionOrType === 'string' ? sectionOrType : getSectionType(sectionOrType);
  return SECTION_BLOCK_SCHEMAS[type] || [];
};
