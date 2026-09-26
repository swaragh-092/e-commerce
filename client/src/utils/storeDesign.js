import {
  DESIGNER_OWNED_GROUPS,
  DESIGNER_OWNED_KEYS,
  DESIGNER_TARGETS,
} from './designRegistry';

export {
  DESIGNER_OWNED_GROUPS,
  DESIGNER_OWNED_KEYS,
  DESIGNER_TARGETS,
} from './designRegistry';

/**
 * Custom CSS is visual too, but scripts and integrations remain in Settings.
 * Keep this check at the individual key level because both live in the
 * `advanced` settings group.
 */
export const isDesignerOwnedSetting = (group, key) => (
  DESIGNER_OWNED_GROUPS.includes(group)
  || DESIGNER_OWNED_KEYS[group]?.includes(key)
  || (group === 'advanced' && key === 'customCSS')
);

const isEnabled = (value, fallback = true) => (
  value === undefined || value === null
    ? fallback
    : value !== false && value !== 'false' && value !== 0 && value !== '0'
);

export const getStoreDesignSummary = (form = {}, homepageSections = []) => {
  const productCard = form['componentStyles.productCard'] || {};
  const categoryCard = form['componentStyles.categoryCard'] || {};

  return {
    theme: {
      mode: form['theme.mode'] || 'light',
      font: form['theme.fontFamily'] || 'Default font',
      headingFont: form['theme.headingFont'] || form['theme.fontFamily'] || 'Default font',
      primaryColor: form['theme.primaryColor'] || '#0f766e',
      secondaryColor: form['theme.secondaryColor'] || '#f97316',
    },
    cards: {
      product: productCard.variant || 'Classic',
      category: categoryCard.variant || 'Image tile',
    },
    structure: {
      header: isEnabled(form['nav.sticky']) ? 'Sticky header' : 'Static header',
      announcement: isEnabled(form['announcement.enabled'], false) ? 'Visible' : 'Hidden',
      footer: isEnabled(form['footer.enabled']) ? 'Visible' : 'Hidden',
    },
    homepage: {
      sections: Array.isArray(homepageSections) ? homepageSections.length : 0,
    },
  };
};
