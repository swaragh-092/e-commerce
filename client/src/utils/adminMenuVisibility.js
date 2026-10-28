import { TIER1_UI_FEATURES } from '../hooks/useSettings';

/**
 * Pure visibility check for an admin sidebar entry.
 * Tier 1 features require both the resolved capability and the admin surface
 * presentation switch. Optional features only require the capability.
 */
export const isAdminMenuItemVisible = (item, {
  mode,
  features,
  visibility,
  hasPermission = () => true,
  hasAnyPermission = () => true,
  hasRole = () => true,
} = {}) => {
  if (!item) return false;
  if (item.mode && item.mode !== mode) return false;
  if (item.feature) {
    if (!features || features[item.feature] !== true) return false;
    if (TIER1_UI_FEATURES.includes(item.feature) && visibility?.admin?.[item.feature] !== true) {
      return false;
    }
  }
  if (item.permission && !hasPermission(item.permission)) return false;
  if (item.permissions && !(item.requireAllPermissions
    ? item.permissions.every(hasPermission)
    : hasAnyPermission(item.permissions))) return false;
  if (item.role && !hasRole(item.role)) return false;
  return true;
};
