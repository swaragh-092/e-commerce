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
