import { useContext, useMemo } from 'react';
import { SettingsContext } from '../context/ThemeContext';
import { getComponentStyle } from '../utils/componentStyles';

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

/**
 * Returns the resolved boolean for a single feature flag.
 * Reads from the mode-resolved features map (mode core + DB overrides).
 * Stays false until the server has resolved the feature map, and for keys the
 * server did not return, so disabled UI never flashes on and unknown features
 * are never rendered.
 *
 * Usage: const cartEnabled = useFeature('cart');
 */
export const useFeature = (featureName) => {
  const { features } = useSettings();
  if (!features) return false;
  return features[featureName] === true;
};

export const TIER1_UI_FEATURES = Object.freeze([
  'pricing', 'cart', 'checkout', 'orders', 'payments', 'shipping',
]);

/**
 * Returns whether a feature should be rendered on a given surface.
 *
 * Optional (Tier 2) features follow the resolved capability flag. Tier 1
 * features additionally require the presentation switch for that surface.
 * Visibility can never enable a capability the store mode disabled, and it
 * stays false until the server has resolved both maps.
 *
 * Usage: const showPrices = useFeatureVisible('pricing', 'storefront');
 */
export const useFeatureVisible = (featureName, surface = 'storefront') => {
  const { features, visibility } = useSettings();
  if (!features || features[featureName] !== true) return false;
  if (!TIER1_UI_FEATURES.includes(featureName)) return true;
  return visibility?.[surface]?.[featureName] === true;
};

/**
 * Returns true once the server has resolved the feature map. Use this to defer
 * redirects and fetches that depend on a feature flag until state is known,
 * instead of acting on the temporary "disabled" value while loading.
 */
export const useFeaturesResolved = () => {
  const { features } = useSettings();
  return features != null;
};

/**
 * Returns true if the feature is Tier 1 (mode-locked).
 * Tier 1 features cannot be toggled by the admin — they are controlled
 * entirely by APP_MODE on the server.
 *
 * Usage: const isLocked = useIsFeatureLocked('cart');
 */
export const useIsFeatureLocked = (featureName) => {
  const { lockedKeys } = useSettings();
  return Array.isArray(lockedKeys) && lockedKeys.includes(featureName);
};

/**
 * Returns both the current value and the locked state for a feature.
 * Useful in Settings UI components that need to render a locked toggle.
 *
 * Usage: const { enabled, locked } = useFeatureMetadata('cart');
 */
export const useFeatureMetadata = (featureName) => {
  const enabled = useFeature(featureName);
  const locked  = useIsFeatureLocked(featureName);
  return { enabled, locked };
};

/**
 * Returns the current APP_MODE: 'ecommerce' | 'catalog'.
 * Use this when you need to render completely different layouts per mode.
 *
 * Usage: const mode = useMode(); // 'catalog'
 */
export const useMode = () => {
  const { mode } = useSettings();
  return mode || 'ecommerce';
};

/**
 * Returns a formatPrice(amount) function that formats using the currency
 * saved in settings.general.currency (e.g. "INR", "USD", "EUR").
 * Falls back to USD when settings are still loading or unset.
 */
export const useCurrency = () => {
  const { settings } = useSettings();
  const currency = settings?.general?.currency || 'USD';

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [currency]
  );

  const formatPrice = useMemo(
    () => (amount) => formatter.format(Number(amount) || 0),
    [formatter]
  );

  const symbol = formatter.formatToParts(0).find(part => part.type === 'currency')?.value || currency;

  return { currency, symbol, formatPrice };
};


/**
 * Returns merged component style settings for storefront building blocks.
 * Example: const productCardStyle = useComponentStyles('productCard');
 */
export const useComponentStyles = (componentName) => {
  const { settings } = useSettings();
  return useMemo(
    () => getComponentStyle(settings, componentName),
    [settings, componentName]
  );
};
