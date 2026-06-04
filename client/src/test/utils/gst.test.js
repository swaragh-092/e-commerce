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
});
