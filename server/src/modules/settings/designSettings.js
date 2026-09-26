'use strict';

// Only these groups participate in Store Designer source/reset metadata. Keep
// operational settings outside this list so a design reset cannot affect
// shipping, payments, catalog, or other store behavior.
const DESIGN_SETTINGS_GROUPS = Object.freeze([
  'theme',
  'componentStyles',
  'nav',
  'footer',
  'announcement',
]);

const isDesignSettingsGroup = (group) => DESIGN_SETTINGS_GROUPS.includes(group);

const isDesignSettingTarget = (group, key) => (
  isDesignSettingsGroup(group)
  || (group === 'advanced' && key === 'customCSS')
);

module.exports = {
  DESIGN_SETTINGS_GROUPS,
  isDesignSettingsGroup,
  isDesignSettingTarget,
};
