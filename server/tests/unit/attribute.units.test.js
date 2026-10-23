import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { validateAttributeCategory, validateValueUnit, validateCategoryChange } = require('../../src/modules/attribute/attributeUnits');
const service = require('../../src/modules/attribute/attribute.service');
const db = require('../../src/modules');
const { createAttributeSchema, updateAttributeSchema } = require('../../src/modules/attribute/attribute.validation');
const settings = { categories: ['Length', 'Volume'], units: [
  { value: 'cm', label: 'Centimetre', category: 'Length', enabled: true },
  { value: 'm', label: 'Metre', category: 'Length', enabled: true },
  { value: 'ml', label: 'Millilitre', category: 'Volume', enabled: true },
  { value: 'ft', label: 'Foot', category: 'Length', enabled: false },
] };

afterEach(() => vi.restoreAllMocks());

describe('attribute unit categories', () => {
  it('accepts a category without a template default unit', () => {
    const { error, value } = createAttributeSchema.validate({ name: 'Height', unitCategory: 'Length' });
    expect(error).toBeUndefined();
    expect(value.unit).toBeUndefined();
    expect(validateAttributeCategory('length', settings)).toBe('Length');
    expect(updateAttributeSchema.validate({ unitCategory: null }).error).toBeUndefined();
  });
  it('rejects unregistered categories and malformed category names', () => {
    expect(() => validateAttributeCategory('Unknown', settings)).toThrow(/registered/);
    expect(createAttributeSchema.validate({ name: 'Height', unitCategory: 'bad\nname' }).error).toBeDefined();
  });
  it.each(['cm', 'm'])('allows different Length units on separate values: %s', (unitLabel) => {
    expect(validateValueUnit({ unitCategory: 'Length' }, unitLabel, settings)).toBe(unitLabel);
  });
  it.each(['ml', 'unknown', 'ft', '', null])('rejects unavailable or wrong-category units: %s', (unitLabel) => {
    expect(() => validateValueUnit({ unitCategory: 'Length' }, unitLabel, settings)).toThrow(/Length category/);
  });
  it('preserves unchanged hidden and legacy units on existing values', () => {
    expect(validateValueUnit({ unitCategory: 'Length' }, 'ft', settings, 'ft')).toBe('ft');
    expect(validateValueUnit({ unitCategory: 'Length' }, 'old-unit', settings, 'old-unit')).toBe('old-unit');
  });
  it('keeps attributes without measurements unitless', () => {
    expect(validateValueUnit({}, null, settings)).toBeNull();
    expect(() => validateValueUnit({}, 'cm', settings)).toThrow(/category on the attribute/);
  });
  it('infers the category for legacy template defaults', () => {
    expect(validateValueUnit({ unit: 'cm' }, 'm', settings)).toBe('m');
  });
  it('prevents category changes that conflict with existing value units', () => {
    expect(() => validateCategoryChange({ unitCategory: 'Length', values: [{ unitLabel: 'cm' }] }, 'Volume', settings)).toThrow(/Existing values/);
    expect(() => validateCategoryChange({ unitCategory: 'Length', unit: 'cm', values: [{}] }, null, settings)).toThrow(/Existing values/);
    expect(() => validateCategoryChange({ unitCategory: 'Length', unit: 'cm', values: [] }, 'Volume', settings)).not.toThrow();
  });
});

describe('attribute unit service enforcement', () => {
  let attribute;
  beforeEach(() => {
    attribute = { id: 'attribute', name: 'Height', unitCategory: 'Length', values: [], update: vi.fn() };
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback({ id: 'tx' }));
    vi.spyOn(db.sequelize, 'query').mockResolvedValue([]);
    vi.spyOn(db.Setting, 'findAll').mockResolvedValue([]);
    vi.spyOn(db.AttributeTemplate, 'findByPk').mockImplementation(async () => attribute);
    vi.spyOn(db.AttributeTemplate, 'findOne').mockResolvedValue(null);
    vi.spyOn(db.AttributeTemplate, 'create').mockImplementation(async (data) => data);
    vi.spyOn(db.AttributeValue, 'findOne').mockResolvedValue(null);
    vi.spyOn(db.AttributeValue, 'create').mockImplementation(async (data) => data);
  });
  it('persists the category independently from a default unit', async () => {
    const result = await service.createAttribute({ name: 'Height', unitCategory: 'Length' });
    expect(result).toMatchObject({ name: 'Height', unitCategory: 'Length' });
    expect(result.unit).toBeUndefined();
  });
  it('saves cm and m as independent per-value units', async () => {
    expect(await service.addValue('attribute', { value: '600 - 900', unitLabel: 'cm' })).toMatchObject({ value: '600 - 900', unitLabel: 'cm' });
    expect(await service.addValue('attribute', { value: '1 - 1.5', unitLabel: 'm' })).toMatchObject({ value: '1 - 1.5', unitLabel: 'm' });
  });
  it('rejects wrong-category and missing units before creating any value', async () => {
    await expect(service.addValue('attribute', { value: '10', unitLabel: 'ml' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(service.addValue('attribute', { value: '10' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(db.AttributeValue.create).not.toHaveBeenCalled();
  });
  it('validates changed units when editing values', async () => {
    const update = vi.fn();
    db.AttributeValue.findOne.mockResolvedValue({ value: '10', unitLabel: 'cm', update });
    await expect(service.updateValue('attribute', 'value', { unitLabel: 'ml' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(update).not.toHaveBeenCalled();
    await service.updateValue('attribute', 'value', { unitLabel: 'm' });
    expect(update).toHaveBeenCalledWith({ unitLabel: 'm' }, expect.anything());
  });
  it('does not rewrite a legacy default when saving the same category', async () => {
    attribute.unit = 'cm';
    await service.updateAttribute('attribute', { unitCategory: 'Length' });
    expect(attribute.update).toHaveBeenCalledWith({ unitCategory: 'Length' }, expect.anything());
  });
  it('blocks incompatible category edits without modifying the template', async () => {
    attribute.values = [{ unitLabel: 'cm' }];
    await expect(service.updateAttribute('attribute', { unitCategory: 'Volume' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(attribute.update).not.toHaveBeenCalled();
  });
});
