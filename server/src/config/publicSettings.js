'use strict';

// Storefront-safe settings. Privileged, credential, and internal-ops groups are
// deliberately excluded. Keep this list as the single source of truth for both
// the public settings endpoint and API Builder.
const PUBLIC_SETTING_GROUPS = Object.freeze([
  'general',
  'theme',
  'componentStyles',
  'sectionPresets',
  'features',
  'visibility',
  'payments',
  'sales',
  'seo',
  'orders',
  'shipping',
  'tax',
  'sku',
  'logo',
  'hero',
  'auth',
  'footer',
  'announcement',
  'nav',
  'catalog',
  'homepage',
  'productPage',
  'categoryPage',
  'blogPage',
  'brandsPage',
  'cartPage',
  'accountPage',
  'checkoutPage',
  'wishlistPage',
  'searchPage',
  'notFoundPage',
  'ordersPage',
  'invoice',
]);

const PUBLIC_SETTING_KEYS = Object.freeze({
  advanced: Object.freeze(['customCSS', 'headScripts', 'bodyScripts']),
});

const PUBLIC_SETTING_GROUP_NAMES = Object.freeze([
  ...PUBLIC_SETTING_GROUPS,
  ...Object.keys(PUBLIC_SETTING_KEYS),
]);

const isPublicSetting = (group, key) => (
  PUBLIC_SETTING_GROUPS.includes(group)
  || (PUBLIC_SETTING_KEYS[group] || []).includes(key)
);

const pickPublicSettings = (allSettings = {}) => {
  const result = {};
  for (const group of PUBLIC_SETTING_GROUP_NAMES) {
    const values = allSettings?.[group];
    if (!values || typeof values !== 'object' || Array.isArray(values)) continue;

    if (PUBLIC_SETTING_GROUPS.includes(group)) {
      result[group] = { ...values };
      continue;
    }

    const allowedKeys = PUBLIC_SETTING_KEYS[group] || [];
    const picked = {};
    for (const key of allowedKeys) {
      if (Object.prototype.hasOwnProperty.call(values, key)) picked[key] = values[key];
    }
    if (Object.keys(picked).length > 0) result[group] = picked;
  }
  return result;
};

const pickPublicGroup = (group, values = {}) => {
  if (!PUBLIC_SETTING_GROUP_NAMES.includes(group)) {
    return null;
  }
  if (PUBLIC_SETTING_GROUPS.includes(group)) {
    return { ...(values || {}) };
  }
  const picked = {};
  for (const key of PUBLIC_SETTING_KEYS[group] || []) {
    if (Object.prototype.hasOwnProperty.call(values || {}, key)) picked[key] = values[key];
  }
  return picked;
};

module.exports = {
  PUBLIC_SETTING_GROUPS,
  PUBLIC_SETTING_KEYS,
  PUBLIC_SETTING_GROUP_NAMES,
  isPublicSetting,
  pickPublicSettings,
  pickPublicGroup,
};
