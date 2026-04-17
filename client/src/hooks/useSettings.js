import { useContext } from 'react';
import { SettingsContext } from '../context/ThemeContext';

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

// Returns true unless the feature is explicitly disabled in settings.
// Optimistically returns true while settings are still loading.
export const useFeature = (featureName) => {
  const { settings } = useSettings();
  return settings?.features?.[featureName] !== false;
};

export const useFeatureFlag = useFeature;

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
