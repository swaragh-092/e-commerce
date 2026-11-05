import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const db = require('../../src/modules');
const { assignProductAttribute } = require('../../src/modules/attribute/productAttributeAssignment.service');
const { assignProductAttributeSchema } = require('../../src/modules/attribute/productAttribute.validation');
const attributeId = '11111111-1111-4111-8111-111111111111';
const valueId = '22222222-2222-4222-8222-222222222222';
const tx = { LOCK: { UPDATE: 'UPDATE' } };
let template;
let assigned;

beforeEach(() => {
  template = { id: attributeId, name: 'Height', unitCategory: 'Length' };
  assigned = [];
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback(tx));
  vi.spyOn(db.sequelize, 'query').mockResolvedValue([]);
  vi.spyOn(db.Setting, 'findAll').mockResolvedValue([]);
  vi.spyOn(db.Product, 'findByPk').mockResolvedValue({ id: 'product', type: 'variable' });
  vi.spyOn(db.AttributeTemplate, 'findByPk').mockImplementation(async () => template);
  vi.spyOn(db.AttributeTemplate, 'findOne').mockResolvedValue(null);
  vi.spyOn(db.AttributeTemplate, 'create').mockImplementation(async (data) => ({ ...data, id: attributeId }));
  vi.spyOn(db.AttributeValue, 'findAll').mockResolvedValue([{ id: valueId, value: '10', unitLabel: 'cm' }]);
  vi.spyOn(db.AttributeValue, 'findOne').mockResolvedValue(null);
  vi.spyOn(db.VariantOption, 'findOne').mockResolvedValue(null);
  vi.spyOn(db.AttributeValue, 'create').mockImplementation(async (data) => ({ ...data, id: `value-${data.value}` }));
  vi.spyOn(db.ProductAttribute, 'findAll').mockImplementation(async () => [...assigned]);
  vi.spyOn(db.ProductAttribute, 'create').mockImplementation(async (data) => { const row = { ...data, update: vi.fn(async (updates) => Object.assign(row, updates)) }; assigned.push(row); return row; });
});
afterEach(() => vi.restoreAllMocks());

describe('unified product attribute assignment', () => {
  it('blocks disabling existing assignments through the assignment endpoint when variants use the attribute', async () => {
    const update = vi.fn();
    assigned.push({ attributeId, valueId, isVariantAttr: true, update });
    db.VariantOption.findOne.mockResolvedValue({ variantId: 'existing' });
    await expect(assignProductAttribute('product', { attributeId, values: [{ valueId }], isVariantAttr: false })).rejects.toMatchObject({ statusCode: 409 });
    expect(update).not.toHaveBeenCalled();
    expect(db.ProductAttribute.create).not.toHaveBeenCalled();
  });
  it('appends newly assigned values without resetting the saved product order', async () => {
    assigned.push({ id: 'old', attributeId: 'other', valueId: 'other-value', sortOrder: 9 });
    await assignProductAttribute('product', { attributeId, values: [{ valueId }] });
    expect(db.ProductAttribute.create).toHaveBeenCalledWith(expect.objectContaining({ sortOrder: 10 }), { transaction: tx });
    expect(assigned[0].sortOrder).toBe(9);
  });
  it('rejects variant dimensions on Simple products before creating templates or values', async () => {
    db.Product.findByPk.mockResolvedValue({ id: 'product', type: 'simple' });
    await expect(assignProductAttribute('product', { attributeId, values: [{ valueId }], isVariantAttr: true })).rejects.toThrow('Save the product as Variable');
    expect(db.AttributeValue.create).not.toHaveBeenCalled();
    expect(db.ProductAttribute.create).not.toHaveBeenCalled();
  });
  it('validates one attribute source and at least one value', () => {
    expect(assignProductAttributeSchema.validate({ attributeId, values: [{ valueId }] }).error).toBeUndefined();
    expect(assignProductAttributeSchema.validate({ attribute: { name: 'Height', unitCategory: 'Length' }, values: [{ value: '10', unitLabel: 'cm' }] }).error).toBeUndefined();
    expect(assignProductAttributeSchema.validate({ attributeId, attribute: { name: 'Height' }, values: [{ valueId }] }).error).toBeDefined();
    expect(assignProductAttributeSchema.validate({ attributeId, values: [] }).error).toBeDefined();
    expect(assignProductAttributeSchema.validate({ attributeId, values: [{ valueId, value: 'bad' }] }).error).toBeDefined();
  });
  it('creates reusable attributes, new values, and assignments in one transaction', async () => {
    await assignProductAttribute('product', { attribute: { name: 'Diameter', unitCategory: 'Length' }, values: [{ value: '1 - 1.5', unitLabel: 'm' }], isVariantAttr: true });
    expect(db.AttributeTemplate.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Diameter', unitCategory: 'Length' }), { transaction: tx });
    expect(db.AttributeValue.create).toHaveBeenCalledWith(expect.objectContaining({ value: '1 - 1.5', unitLabel: 'm', attributeId }), { transaction: tx });
    expect(assigned[0]).toMatchObject({ productId: 'product', attributeId, isVariantAttr: true });
  });
  it('adds existing and newly entered values in the same request', async () => {
    await assignProductAttribute('product', { attributeId, values: [{ valueId }, { value: '2', unitLabel: 'm' }], isVariantAttr: false });
    expect(assigned.map((row) => row.valueId)).toEqual([valueId, 'value-2']);
  });
  it('deduplicates selected and newly entered existing values', async () => {
    await assignProductAttribute('product', { attributeId, values: [{ valueId }, { valueId }, { value: '10', unitLabel: 'cm' }], isVariantAttr: false });
    expect(assigned).toHaveLength(1);
    expect(db.AttributeValue.create).not.toHaveBeenCalled();
  });
  it('makes repeated saves idempotent and updates the variant flag atomically', async () => {
    const payload = { attributeId, values: [{ valueId }], isVariantAttr: false };
    await assignProductAttribute('product', payload);
    await assignProductAttribute('product', payload);
    await assignProductAttribute('product', { ...payload, isVariantAttr: true });
    expect(assigned).toHaveLength(1);
    expect(assigned[0].isVariantAttr).toBe(true);
  });
  it('reuses an identically named attribute on a retry without creating another template', async () => {
    db.AttributeTemplate.findOne.mockResolvedValue(template);
    await assignProductAttribute('product', { attribute: { name: ' height ', unitCategory: 'Length' }, values: [{ valueId }], isVariantAttr: false });
    expect(db.AttributeTemplate.create).not.toHaveBeenCalled();
  });
  it('rejects conflicting categories for an existing name', async () => {
    db.AttributeTemplate.findOne.mockResolvedValue(template);
    await expect(assignProductAttribute('product', { attribute: { name: 'Height', unitCategory: 'Volume' }, values: [{ valueId }] })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.ProductAttribute.create).not.toHaveBeenCalled();
  });
  it.each(['ml', '', 'bogus'])('rejects unavailable or wrong-category units: %s', async (unitLabel) => {
    await expect(assignProductAttribute('product', { attributeId, values: [{ value: '2', unitLabel }] })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(db.ProductAttribute.create).not.toHaveBeenCalled();
  });
  it('rejects a value from another attribute', async () => {
    await expect(assignProductAttribute('product', { attributeId, values: [{ valueId: 'other-value' }] })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('does not silently reuse an existing number with a different unit', async () => {
    await expect(assignProductAttribute('product', { attributeId, values: [{ value: '10', unitLabel: 'm' }] })).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('requires a saved, existing product before creating templates', async () => {
    db.Product.findByPk.mockResolvedValue(null);
    await expect(assignProductAttribute('product', { attribute: { name: 'Height' }, values: [{ value: '10' }] })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(db.AttributeTemplate.create).not.toHaveBeenCalled();
  });
  it('allows product-only text specifications to remain unitless', async () => {
    db.AttributeTemplate.findByPk.mockResolvedValue({ id: attributeId, name: 'Firmness' });
    await assignProductAttribute('product', { attributeId, values: [{ value: 'Firm' }], isVariantAttr: false });
    expect(db.AttributeValue.create).toHaveBeenCalledWith(expect.objectContaining({ value: 'Firm', unitLabel: null }), { transaction: tx });
  });
});
