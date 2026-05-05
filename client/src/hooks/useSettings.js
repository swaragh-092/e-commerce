import { useContext } from 'react';
import { SettingsContext } from '../context/ThemeContext';

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
 * Optimistically returns true while features are still loading.
 *
 * Usage: const cartEnabled = useFeature('cart');
 */
export const useFeature = (featureName) => {
  const { features } = useSettings();
  // features is null while loading — optimistic true so UI doesn't flash
  if (features === null) return true;
  return features[featureName] !== false;
};

/** Alias kept for backward compatibility */
export const useFeatureFlag = useFeature;

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

  const formatPrice = (amount) =>
    new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);

  return { currency, formatPrice };
};
