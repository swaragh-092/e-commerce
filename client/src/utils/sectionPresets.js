import { SECTION_TYPES, SECTION_DEFINITIONS, getDefaultVariant } from '../components/storefront/sections/sectionRegistry';
import productRow from '../../../shared/product-row.json';
import themeSections from '../../../shared/theme-sections.json';

const compact = (obj) => Object.fromEntries(
  Object.entries(obj).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

export const SECTION_PRESET_GOALS = Object.freeze([
  { value: 'all', label: 'All' },
  { value: 'hero', label: 'Hero' },
  { value: 'merchandising', label: 'Merchandising' },
  { value: 'trust', label: 'Trust' },
  { value: 'conversion', label: 'Conversion' },
  { value: 'content', label: 'Content' },
  { value: 'campaign', label: 'Campaign' },
]);

const SECTION_PRESETS = Object.fromEntries(themeSections.presetOrder.map((type) => [
  type,
  type === productRow.type ? productRow.defaults : SECTION_DEFINITIONS[type].preset,
]));

export const getSectionPreset = (type) => SECTION_PRESETS[type] || {};

export const getInstalledSectionPreset = (sectionPresets = {}, type) => {
  if (!sectionPresets || typeof sectionPresets !== 'object') return {};
  if (sectionPresets[type]?.type === type || sectionPresets[type]?.variant) return sectionPresets[type];
  return Object.values(sectionPresets).find((preset) => preset?.type === type) || {};
};

export const getSectionPresetGallery = (sectionPresets = {}) => {
  const byType = new Map();

  Object.keys(SECTION_PRESETS).forEach((type) => {
    const preset = { ...SECTION_PRESETS[type], ...getInstalledSectionPreset(sectionPresets, type) };
    const meta = SECTION_DEFINITIONS[type]?.gallery || {};
    byType.set(type, {
      type,
      label: SECTION_DEFINITIONS[type]?.label || type,
      goal: meta.goal || SECTION_DEFINITIONS[type]?.family || 'content',
      description: meta.description || preset.subtitle || 'Add a reusable storefront section.',
      title: preset.title,
      variant: preset.variant || getDefaultVariant(type),
      installed: Boolean(getInstalledSectionPreset(sectionPresets, type)?.type || getInstalledSectionPreset(sectionPresets, type)?.variant),
    });
  });

  Object.entries(sectionPresets || {}).forEach(([key, preset]) => {
    if (!preset?.type || byType.has(preset.type)) return;
    const type = preset.type;
    const meta = SECTION_DEFINITIONS[type]?.gallery || {};
    byType.set(type, {
      type,
      label: SECTION_DEFINITIONS[type]?.label || key,
      goal: meta.goal || SECTION_DEFINITIONS[type]?.family || 'content',
      description: meta.description || preset.subtitle || 'Imported template section preset.',
      title: preset.title,
      variant: preset.variant || getDefaultVariant(type),
      installed: true,
    });
  });

  return [...byType.values()];
};

export const createDefaultSection = (type, { id, variant, title, sectionPresets } = {}) => {
  const preset = { ...getSectionPreset(type), ...getInstalledSectionPreset(sectionPresets, type) };
  const resolvedVariant = variant || preset.variant || getDefaultVariant(type);
  return compact({
    id,
    type,
    enabled: true,
    ...preset,
    variant: resolvedVariant,
    layout: type === SECTION_TYPES.PRODUCT_ROW ? (resolvedVariant || preset.layout || 'carousel') : preset.layout,
    title: title || preset.title,
  });
};

export default { createDefaultSection, getInstalledSectionPreset, getSectionPreset, getSectionPresetGallery };
