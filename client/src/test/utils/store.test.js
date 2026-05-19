import { describe, expect, it } from 'vitest';
import { DEFAULT_STORE_NAME, getStoreName } from '../../utils/store';

describe('store utilities', () => {
  it('uses the configured store name when available', () => {
    expect(getStoreName({ general: { storeName: 'Northwind' } })).toBe('Northwind');
  });

  it('falls back to the shared default store name', () => {
    expect(getStoreName(null)).toBe(DEFAULT_STORE_NAME);
  });
});
