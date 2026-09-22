import { describe, expect, it } from 'vitest';
import { STANDARD_UNITS, getUnitLabel, normalizeUnitValue } from '../../constants/units';
import { formatPriceWithUnit } from '../../utils/pricing';

describe('unit utilities and catalog', () => {
  it('contains expected standard measurement categories', () => {
    const categories = new Set(STANDARD_UNITS.map((u) => u.category));
    expect(categories.has('Count / Packaging')).toBe(true);
    expect(categories.has('Weight')).toBe(true);
    expect(categories.has('Volume')).toBe(true);
    expect(categories.has('Length & Area')).toBe(true);
  });

  it('resolves canonical unit labels and fallback strings', () => {
    expect(getUnitLabel('kg')).toBe('Kilogram (kg)');
    expect(getUnitLabel('pc')).toBe('Piece (pc)');
    expect(getUnitLabel('L')).toBe('Litre (L)');
    expect(getUnitLabel('custom-pack')).toBe('custom-pack');
    expect(getUnitLabel('')).toBe('');
    expect(getUnitLabel(null)).toBe('');
  });

  it('normalizes unit values properly', () => {
    expect(normalizeUnitValue('Kilogram (kg)')).toBe('kg');
    expect(normalizeUnitValue('KG')).toBe('kg');
    expect(normalizeUnitValue('Piece (pc)')).toBe('pc');
    expect(normalizeUnitValue('bundle')).toBe('bundle');
    expect(normalizeUnitValue('')).toBe('');
  });

  it('formats price with unit correctly', () => {
    expect(formatPriceWithUnit('$25.00', 'kg')).toBe('$25.00 / kg');
    expect(formatPriceWithUnit('₹500', 'pc')).toBe('₹500 / pc');
    expect(formatPriceWithUnit('$10.00', '')).toBe('$10.00');
    expect(formatPriceWithUnit('$10.00', null)).toBe('$10.00');
    expect(formatPriceWithUnit('', 'kg')).toBe('');
  });
});
 