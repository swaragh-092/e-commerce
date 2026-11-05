import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const db = require('../../src/modules');
const service = require('../../src/modules/attribute/productAttribute.service');
const variantService = require('../../src/modules/attribute/attribute.service');
const SettingsService = require('../../src/modules/settings/settings.service');
const { updateProductAttributeGroupSchema } = require('../../src/modules/attribute/productAttribute.validation');
const tx = { LOCK: { UPDATE: 'UPDATE' }, commit: vi.fn(), rollback: vi.fn() };
let rows;
const makeRow = (id, valueId, isVariantAttr = false, attributeId = 'size') => {
  const row = { id, productId: 'product', attributeId, valueId, isVariantAttr, sortOrder: 0 };
  row.update = vi.fn(async (updates) => Object.assign(row, updates));
  row.destroy = vi.fn(async () => { rows = rows.filter((item) => item.id !== id); });
  return row;
};

beforeEach(() => {
  vi.clearAllMocks();
  rows = [makeRow('small-row', 'small'), makeRow('large-row', 'large'), makeRow('color-row', 'red', false, 'color')];
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback ? callback(tx) : tx);
  vi.spyOn(db.sequelize, 'query').mockResolvedValue([]);
  vi.spyOn(db.Product, 'findByPk').mockResolvedValue({ id: 'product', type: 'variable' });
  vi.spyOn(db.ProductAttribute, 'findAll').mockImplementation(async ({ where }) => rows.filter((row) => row.productId === where.productId
    && (where.isVariantAttr === undefined || row.isVariantAttr === where.isVariantAttr)));
  vi.spyOn(db.ProductAttribute, 'findOne').mockImplementation(async ({ where }) => rows.find((row) => row.id === where.id && row.productId === where.productId) || null);
  vi.spyOn(db.ProductAttribute, 'findByPk').mockImplementation(async (id) => rows.find((row) => row.id === id));
  vi.spyOn(db.VariantOption, 'findOne').mockResolvedValue(null);
  vi.spyOn(db.AttributeValue, 'findOne').mockResolvedValue({ id: 'replacement' });
  vi.spyOn(db.AttributeTemplate, 'destroy');
  vi.spyOn(db.AttributeValue, 'destroy');
});
afterEach(() => vi.restoreAllMocks());

describe('product attribute removal rules', () => {
  it('removes a display-only attribute and all its values, preserving other groups and reusable definitions', async () => {
    const removed = rows.slice(0, 2);
    await service.deleteProductAttributeGroup('product', 'large-row');
    expect(rows.map((row) => row.id)).toEqual(['color-row']);
    for (const row of removed) expect(row.destroy).toHaveBeenCalledWith({ transaction: tx });
    expect(db.AttributeTemplate.destroy).not.toHaveBeenCalled();
    expect(db.AttributeValue.destroy).not.toHaveBeenCalled();
  });
  it('removes a single display value while preserving the remaining values', async () => {
    await service.deleteProductAttribute('product', 'small-row');
    expect(rows.map((row) => row.id)).toEqual(['large-row', 'color-row']);
  });
  it.each(['deleteProductAttribute', 'deleteProductAttributeGroup'])('blocks %s while any value in the group is enabled, even before variants exist', async (method) => {
    rows[1].isVariantAttr = true;
    await expect(service[method]('product', 'small-row')).rejects.toMatchObject({ code: 'CONFLICT', statusCode: 409, message: expect.stringContaining('Turn off') });
    for (const row of rows) expect(row.destroy).not.toHaveBeenCalled();
  });
  it.each(['deleteProductAttribute', 'deleteProductAttributeGroup'])('blocks %s for legacy display-only assignments still referenced by variants', async (method) => {
    db.VariantOption.findOne.mockResolvedValue({ variantId: 'existing' });
    await expect(service[method]('product', 'small-row')).rejects.toMatchObject({ statusCode: 409 });
    expect(rows).toHaveLength(3);
  });
  it('supports product-only custom groups, including legacy variant flags', async () => {
    rows = [
      Object.assign(makeRow('care1', null, true, null), { customName: 'Care', customValue: 'Dry' }),
      Object.assign(makeRow('care2', null, false, null), { customName: ' care ', customValue: 'Cool' }),
      Object.assign(makeRow('other', null, false, null), { customName: 'Origin', customValue: 'India' }),
    ];
    await service.deleteProductAttributeGroup('product', 'care1');
    expect(rows.map((row) => row.id)).toEqual(['other']);
    expect(db.VariantOption.findOne).not.toHaveBeenCalled();
  });
  it('rejects missing or foreign assignments before deleting anything', async () => {
    await expect(service.deleteProductAttributeGroup('product', 'foreign-row')).rejects.toMatchObject({ statusCode: 404 });
    expect(rows).toHaveLength(3);
  });
  it('rejects a missing or deleted product', async () => {
    db.Product.findByPk.mockResolvedValue(null);
    await expect(service.deleteProductAttributeGroup('product', 'small-row')).rejects.toMatchObject({ statusCode: 404 });
    expect(db.ProductAttribute.findAll).not.toHaveBeenCalled();
  });
});

describe('variant dimension changes', () => {
  it('requires turning off the group before removal even when there are no variants', async () => {
    rows[0].isVariantAttr = rows[1].isVariantAttr = true;
    await expect(service.deleteProductAttributeGroup('product', 'small-row')).rejects.toMatchObject({ statusCode: 409 });
    await service.updateProductAttributeGroup('product', 'small-row', { isVariantAttr: false });
    await service.deleteProductAttributeGroup('product', 'small-row');
    expect(rows.map((row) => row.id)).toEqual(['color-row']);
  });
  it('updates every value together without the 100-value assignment limit', async () => {
    rows = Array.from({ length: 101 }, (_, index) => makeRow(`row-${index}`, `value-${index}`, true));
    const result = await service.updateProductAttributeGroup('product', 'row-0', { isVariantAttr: false });
    expect(result).toHaveLength(101);
    expect(result.every((row) => row.isVariantAttr === false)).toBe(true);
    for (const row of rows) expect(row.update).toHaveBeenCalledWith({ isVariantAttr: false }, { transaction: tx });
  });
  it.each(['updateProductAttribute', 'updateProductAttributeGroup'])('blocks disabling via %s while variants use any value of the attribute', async (method) => {
    rows[0].isVariantAttr = true;
    db.VariantOption.findOne.mockResolvedValue({ variantId: 'existing' });
    await expect(service[method]('product', 'small-row', { isVariantAttr: false })).rejects.toMatchObject({ statusCode: 409 });
    expect(rows[0].update).not.toHaveBeenCalled();
    // Only this product's non-deleted variants count, regardless of availability.
    expect(db.VariantOption.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: { attributeId: 'size' }, transaction: tx,
      include: [{ model: db.ProductVariant, as: 'variant', attributes: [], required: true, where: { productId: 'product' } }],
    }));
    expect(db.ProductVariant.options.paranoid).toBe(true);
  });
  it('allows disabling after the last dependent variant is deleted', async () => {
    rows[0].isVariantAttr = true;
    db.VariantOption.findOne.mockResolvedValueOnce({ variantId: 'existing' }).mockResolvedValueOnce(null);
    await expect(service.updateProductAttributeGroup('product', 'small-row', { isVariantAttr: false })).rejects.toMatchObject({ statusCode: 409 });
    await service.updateProductAttributeGroup('product', 'small-row', { isVariantAttr: false });
    expect(rows[0].isVariantAttr).toBe(false);
  });
  it('blocks replacing a value used by variants, including simultaneous toggle-off attempts', async () => {
    db.VariantOption.findOne.mockResolvedValue({ variantId: 'existing' });
    await expect(service.updateProductAttribute('product', 'small-row', { valueId: 'replacement', isVariantAttr: false })).rejects.toMatchObject({ statusCode: 409 });
    expect(rows[0].update).not.toHaveBeenCalled();
  });
  it('allows harmless ordering edits while variants use the attribute', async () => {
    db.VariantOption.findOne.mockResolvedValue({ variantId: 'existing' });
    await service.updateProductAttribute('product', 'small-row', { sortOrder: 9 });
    expect(rows[0].sortOrder).toBe(9);
    expect(db.VariantOption.findOne).not.toHaveBeenCalled();
  });
  it('allows enabling an attribute that existing variants already reference', async () => {
    db.VariantOption.findOne.mockResolvedValue({ variantId: 'existing' });
    await service.updateProductAttributeGroup('product', 'small-row', { isVariantAttr: true });
    expect(rows[0].isVariantAttr).toBe(true);
    expect(db.VariantOption.findOne).not.toHaveBeenCalled();
  });
  it('rejects variant dimensions on Simple products', async () => {
    db.Product.findByPk.mockResolvedValue({ id: 'product', type: 'simple' });
    await expect(service.updateProductAttributeGroup('product', 'small-row', { isVariantAttr: true })).rejects.toMatchObject({ statusCode: 400 });
    expect(rows[0].update).not.toHaveBeenCalled();
  });
  it('waits for concurrent variant changes before checking dependencies or modifying assignments', async () => {
    let release;
    db.sequelize.query.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    const operation = service.updateProductAttributeGroup('product', 'small-row', { isVariantAttr: false });
    expect(db.Product.findByPk).not.toHaveBeenCalled();
    db.VariantOption.findOne.mockResolvedValue({ variantId: 'created-while-waiting' });
    release([]);
    await expect(operation).rejects.toMatchObject({ statusCode: 409 });
    expect(rows[0].update).not.toHaveBeenCalled();
  });
  it('requires an explicit boolean and rejects unrelated group changes at the route boundary', () => {
    expect(updateProductAttributeGroupSchema.validate({ isVariantAttr: false }).error).toBeUndefined();
    expect(updateProductAttributeGroupSchema.validate({}).error).toBeDefined();
    expect(updateProductAttributeGroupSchema.validate({ isVariantAttr: false, valueId: 'other' }).error).toBeDefined();
  });
});

describe('manual variant creation after attribute changes', () => {
  beforeEach(() => {
    vi.spyOn(SettingsService, 'getFeatures').mockResolvedValue({ features: { pricing: false } });
    vi.spyOn(db.ProductVariant, 'create').mockResolvedValue({ id: 'new-variant' });
  });
  it.each([false, 'removed'])('rejects an option after it has been disabled or removed: %s', async (state) => {
    if (state === 'removed') rows = rows.filter((row) => row.id !== 'small-row');
    await expect(variantService.addProductVariant('product', { price: 100, options: [{ attributeId: 'size', valueId: 'small' }] })).rejects.toMatchObject({ statusCode: 409 });
    expect(db.ProductVariant.create).not.toHaveBeenCalled();
    expect(tx.rollback).toHaveBeenCalled();
  });
});
