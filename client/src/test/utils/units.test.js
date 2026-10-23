import { describe, expect, it } from 'vitest';
import { STANDARD_UNITS, getUnitLabel, normalizeUnitValue, mergeUnitCatalog } from '../../constants/units';
import { formatAttributeValue } from '../../utils/attributePresentation';
import { formatPriceWithUnit } from '../../utils/pricing';

describe('unit utilities and catalog', () => {
  it('contains expected standard measurement categories', () => {
    const categories = new Set(STANDARD_UNITS.map((u) => u.category));
    expect(categories.has('Count / Packaging')).toBe(true);
    expect(categories.has('Weight')).toBe(true);
    expect(categories.has('Volume')).toBe(true);
    expect(categories.has('Length')).toBe(true);
    expect(categories.has('Area')).toBe(true);
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

  it('merges custom definitions without changing built-in symbols or removing defaults', () => {
    const units = mergeUnitCatalog([
      { value: 'KG', label: 'Custom kilogram', category: 'Mass', enabled: false },
      { value: 'm³', label: 'Cubic metre', category: 'Volume', enabled: true },
      null, { value: 'bad' },
    ]);
    expect(units.find((unit) => unit.value === 'kg')).toMatchObject({ label: 'Custom kilogram', category: 'Mass', enabled: false });
    expect(units.find((unit) => unit.value === 'm³')).toMatchObject({ category: 'Volume' });
    expect(units.find((unit) => unit.value === 'cm')).toMatchObject({ category: 'Length', enabled: true });
    expect(mergeUnitCatalog(null)).toHaveLength(STANDARD_UNITS.length);
  });

  it('keeps default units, mixed-unit overrides, and existing labels working', () => {
    expect(formatAttributeValue({ value: '600 - 900' }, { unit: 'cm' })).toBe('600 - 900cm');
    expect(formatAttributeValue({ value: '1 - 1.5', unitLabel: 'm' }, { unit: 'cm' })).toBe('1 - 1.5m');
    expect(formatAttributeValue({ value: '5 - 6cm' }, { unit: 'cm' })).toBe('5 - 6cm');
    expect(formatAttributeValue({ value: '10', unitLabel: 'seeds' }, {})).toBe('10 seeds');
  });

  it('keeps deleted built-in units removed after reload and supports explicit restoration', () => {
    const removed = { value: 'cm', label: 'Centimetre (cm)', category: 'Length', enabled: false, deleted: true };
    expect(mergeUnitCatalog([removed]).some((unit) => unit.value === 'cm')).toBe(false);
    expect(mergeUnitCatalog([removed], { includeDeleted: true }).find((unit) => unit.value === 'cm')).toMatchObject({ deleted: true });
    expect(mergeUnitCatalog([{ ...removed, deleted: false, enabled: true }]).find((unit) => unit.value === 'cm')).toMatchObject({ enabled: true });
  });
});

