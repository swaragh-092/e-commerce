import { describe, it, expect } from 'vitest';
import {
  getDiscountPercent,
  getSavingsAmount,
  formatSaleDateTime,
  getSaleTimingMessage,
  isEndingSoon,
  formatPriceWithUnit,
} from '../../utils/pricing';

describe('Pricing Utilities', () => {
  describe('getDiscountPercent', () => {
    it('calculates the correct percentage discount', () => {
      expect(getDiscountPercent({ price: 10, salePrice: 5 })).toBe(50);
      expect(getDiscountPercent({ price: 100, salePrice: 75 })).toBe(25);
      expect(getDiscountPercent({ price: '100', salePrice: '80' })).toBe(20);
    });

    it('returns 0 when sale price is equal to or greater than regular price', () => {
      expect(getDiscountPercent({ price: 100, salePrice: 100 })).toBe(0);
      expect(getDiscountPercent({ price: 100, salePrice: 120 })).toBe(0);
    });

    it('returns 0 when price or salePrice is invalid', () => {
      expect(getDiscountPercent(null)).toBe(0);
      expect(getDiscountPercent({})).toBe(0);
      expect(getDiscountPercent({ price: 0, salePrice: 5 })).toBe(0);
      expect(getDiscountPercent({ price: -10, salePrice: 5 })).toBe(0);
      expect(getDiscountPercent({ price: 10, salePrice: 'abc' })).toBe(0);
    });
  });

  describe('getSavingsAmount', () => {
    it('calculates the correct savings amount', () => {
      expect(getSavingsAmount({ price: 10, salePrice: 5 })).toBe(5);
      expect(getSavingsAmount({ price: 100, salePrice: 75 })).toBe(25);
      expect(getSavingsAmount({ price: '50.50', salePrice: '40.25' })).toBeCloseTo(10.25);
    });

    it('returns 0 when sale price is equal to or greater than regular price', () => {
      expect(getSavingsAmount({ price: 50, salePrice: 50 })).toBe(0);
      expect(getSavingsAmount({ price: 50, salePrice: 60 })).toBe(0);
    });
  });

  describe('formatPriceWithUnit', () => {
    it('formats price with unit when unit is present', () => {
      expect(formatPriceWithUnit('₹10.00', 'kg')).toBe('₹10.00 / kg');
      expect(formatPriceWithUnit('₹10.00', 'piece')).toBe('₹10.00 / piece');
    });

    it('returns formatted price unchanged when unit is absent or blank', () => {
      expect(formatPriceWithUnit('₹10.00', '')).toBe('₹10.00');
      expect(formatPriceWithUnit('₹10.00', null)).toBe('₹10.00');
    });
  });
});
