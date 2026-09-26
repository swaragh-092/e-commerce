import { describe, expect, it } from 'vitest';
import {
  getVariantDiscountPercent,
  getVariantRegularPrice,
  getVariantSavingsAmount,
  getVariantUnitPrice,
} from '../../utils/variantPricing';

describe('Variant pricing', () => {
  it('keeps Test1 and demo variant prices positive and consistent with the server price', () => {
    const test1 = { price: 10, salePrice: 5, isSaleActive: true, effectivePrice: 5 };
    const demo = { price: 101, salePrice: 50, isSaleActive: true, effectivePrice: 50 };

    expect(getVariantUnitPrice(test1, { price: 5, unitPrice: 0 })).toBe(5);
    expect(getVariantUnitPrice(demo, { price: 50, unitPrice: 0 })).toBe(50);
    expect(getVariantUnitPrice(demo, { price: 60, unitPrice: 9 })).toBe(60);
    expect(getVariantUnitPrice(demo, { price: 45, unitPrice: 0 })).toBe(45);
  });

  it('uses the canonical variant regular price and savings when the server provides them', () => {
    const product = { price: 101, salePrice: 50, isSaleActive: true, effectivePrice: 50 };
    const variant = { price: 50, unitPrice: 50, regularPrice: 101, savingsAmount: 51, discountPercent: 50 };

    expect(getVariantUnitPrice(product, variant)).toBe(50);
    expect(getVariantRegularPrice(product, variant)).toBe(101);
    expect(getVariantSavingsAmount(product, variant)).toBe(51);
    expect(getVariantDiscountPercent(product, variant)).toBe(50);
  });
});
