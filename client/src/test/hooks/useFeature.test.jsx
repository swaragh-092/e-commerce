import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsContext, DEFAULT_FALLBACK_FEATURES } from '../../context/ThemeContext';
import {
  useFeature,
  useFeatureMetadata,
  useFeaturesResolved,
  useIsFeatureLocked,
  useMode,
} from '../../hooks/useSettings';

const wrapperWith = (value) =>
  function SettingsWrapper({ children }) {
    return (
      <SettingsContext.Provider value={value}>
        {children}
      </SettingsContext.Provider>
    );
  };

describe('useFeature', () => {
  it('stays false while the resolved feature map is still loading', () => {
    const { result } = renderHook(() => useFeature('brands'), {
      wrapper: wrapperWith({ features: null }),
    });

    expect(result.current).toBe(false);
  });

  it('returns true only when the server resolved the feature to true', () => {
    const { result } = renderHook(() => useFeature('brands'), {
      wrapper: wrapperWith({ features: { brands: true } }),
    });

    expect(result.current).toBe(true);
  });

  it('returns false when the server resolved the feature to false', () => {
    const { result } = renderHook(() => useFeature('brands'), {
      wrapper: wrapperWith({ features: { brands: false } }),
    });

    expect(result.current).toBe(false);
  });

  it('treats missing feature keys as disabled', () => {
    const { result } = renderHook(() => useFeature('brands'), {
      wrapper: wrapperWith({ features: { wishlist: true } }),
    });

    expect(result.current).toBe(false);
  });

  it('reports whether the resolved feature map is available', () => {
    const pending = renderHook(() => useFeaturesResolved(), {
      wrapper: wrapperWith({ features: null }),
    });
    expect(pending.result.current).toBe(false);

    const resolved = renderHook(() => useFeaturesResolved(), {
      wrapper: wrapperWith({ features: {} }),
    });
    expect(resolved.result.current).toBe(true);
  });

  it('reports tier-1 mode-locked keys', () => {
    const { result } = renderHook(() => useIsFeatureLocked('cart'), {
      wrapper: wrapperWith({ lockedKeys: ['cart', 'checkout'] }),
    });

    expect(result.current).toBe(true);
  });

  it('combines enabled and locked state for settings controls', () => {
    const { result } = renderHook(() => useFeatureMetadata('brands'), {
      wrapper: wrapperWith({ features: { brands: false }, lockedKeys: [] }),
    });

    expect(result.current).toEqual({ enabled: false, locked: false });
  });

  it('defaults the store mode to ecommerce when unavailable', () => {
    const { result } = renderHook(() => useMode(), {
      wrapper: wrapperWith({ mode: null }),
    });

    expect(result.current).toBe('ecommerce');
  });

  it('supplies known defaults including brands and showPrice in fallback features', () => {
    const { result: brandsResult } = renderHook(() => useFeature('brands'), {
      wrapper: wrapperWith({ features: DEFAULT_FALLBACK_FEATURES }),
    });
    const { result: priceResult } = renderHook(() => useFeature('showPrice'), {
      wrapper: wrapperWith({ features: DEFAULT_FALLBACK_FEATURES }),
    });
    expect(brandsResult.current).toBe(true);
    expect(priceResult.current).toBe(true);
  });
});
