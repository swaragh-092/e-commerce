import { PERMISSIONS } from './permissions';

export const canUseSettingsDesigner = ({ features, adminVisibility, hasPermission }, page) => {
  if (features?.themes !== true || !hasPermission?.(PERMISSIONS.SETTINGS_MANAGE)) return false;
  if (page === 'brand' && features.brands !== true) return false;
  if (page === 'blog' && features.blogs !== true) return false;
  if (page === 'cart' && adminVisibility?.cart !== true) return false;
  return true;
};

export const isSettingsSectionVisible = (requirements = {}, context = {}) => {
  if (requirements.feature && context.features?.[requirements.feature] !== true) return false;
  if (requirements.permission && !context.hasPermission?.(requirements.permission)) return false;
  if (requirements.designer && !canUseSettingsDesigner(context, requirements.page)) return false;
  if (requirements.navigation && !canUseSettingsDesigner(context)
    && !context.hasPermission?.(PERMISSIONS.MENUS_READ)) return false;
  return true;
};
