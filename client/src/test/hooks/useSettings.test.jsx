import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SettingsContext } from '../../context/ThemeContext';
import { useCurrency } from '../../hooks/useSettings';

const wrapperFor = (settings) =>
  function SettingsWrapper({ children }) {
    return (
      <SettingsContext.Provider value={{ settings }}>
        {children}
      </SettingsContext.Provider>
    );
  };

describe('useCurrency', () => {
  it('formats amounts using the configured currency', () => {
    const { result } = renderHook(() => useCurrency(), {
      wrapper: wrapperFor({ general: { currency: 'INR' } }),
    });

    expect(result.current.currency).toBe('INR');
    expect(result.current.formatPrice(1250)).toMatch(/1,250\.00/);
  });

  it('falls back to USD when currency settings are unavailable', () => {
    const { result } = renderHook(() => useCurrency(), {
      wrapper: wrapperFor(null),
    });

    expect(result.current.currency).toBe('USD');
    expect(result.current.formatPrice(10)).toContain('10.00');
  });
});
