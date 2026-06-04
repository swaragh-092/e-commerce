import { describe, expect, it } from 'vitest';
import { calculateTaxSummary } from '../../utils/gst';

const settings = {
  tax: {
    originState: 'Karnataka',
    enableCGST: true,
    enableSGST: true,
    enableIGST: true,
    cgstRate: 0.09,
    sgstRate: 0.09,
    igstRate: 0.18,
  },
};

const items = [
  {
    quantity: 1,
    product: {
      id: 'product-1',
      taxConfig: null,
    },
  },
];

describe('GST utilities', () => {
  it('applies only CGST and SGST for intra-state orders', () => {
    const summary = calculateTaxSummary({
      items,
      settings,
      destinationState: 'Karnataka',
      priceResolver: () => 125,
    });

    expect(summary.cgst).toBe(11.25);
    expect(summary.sgst).toBe(11.25);
    expect(summary.igst).toBe(0);
    expect(summary.totalTax).toBe(22.5);
  });

  it('applies only IGST for inter-state orders', () => {
    const summary = calculateTaxSummary({
      items,
      settings,
      destinationState: 'Tamil Nadu',
      priceResolver: () => 125,
    });

    expect(summary.cgst).toBe(0);
    expect(summary.sgst).toBe(0);
    expect(summary.igst).toBe(22.5);
    expect(summary.totalTax).toBe(22.5);
  });

  it('defaults to intra-state when destination is unavailable', () => {
    const summary = calculateTaxSummary({
      items,
      settings,
      priceResolver: () => 125,
    });

    expect(summary.cgst).toBe(11.25);
    expect(summary.sgst).toBe(11.25);
    expect(summary.igst).toBe(0);
  });

  it('throws when priceResolver is missing', () => {
    expect(() => calculateTaxSummary({ items, settings })).toThrow(TypeError);
  });

  it('allows zero-priced items and returns zero tax for them', () => {
    const summary = calculateTaxSummary({
      items,
      settings,
      priceResolver: () => 0,
    });

    expect(summary.totalTax).toBe(0);
    expect(summary.taxRows).toEqual([]);
  });

  it('throws when priceResolver returns a negative unit price', () => {
    expect(() => calculateTaxSummary({
      items,
      settings,
      priceResolver: () => -1,
    })).toThrow(Error);
  });

  it('marks mixed inclusive when item breakdowns disagree', () => {
    const mixedItems = [
      {
        quantity: 1,
        product: {
          id: 'product-1',
          taxConfig: { isCustom: true, flatRate: 0.1, inclusive: true },
        },
      },
      {
        quantity: 1,
        product: {
          id: 'product-2',
          taxConfig: { isCustom: true, flatRate: 0.1, inclusive: false },
        },
      },
    ];

    const summary = calculateTaxSummary({
      items: mixedItems,
      settings,
      priceResolver: () => 100,
    });

    expect(summary.isInclusive).toBeNull();
    expect(summary.hasMixedInclusive).toBe(true);
    expect(summary.inclusiveCount).toBe(1);
    expect(summary.totalCount).toBe(2);
  });
});
