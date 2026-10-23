import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const db = require('../../src/modules');
const { reorderProductAttributes, addProductAttribute } = require('../../src/modules/attribute/productAttribute.service');
const { reorderProductAttributesSchema } = require('../../src/modules/attribute/productAttribute.validation');
const { serializeProductPricing } = require('../../src/modules/product/product.pricing');
const { getProductVariants } = require('../../src/modules/attribute/attribute.service');
const tx = { LOCK: { UPDATE: 'UPDATE' } };
const rowsForProduct = () => [
  { id: 'a1', productId: 'product', attributeId: 'volume', valueId: 'small', sortOrder: 0 },
  { id: 'a2', productId: 'product', attributeId: 'volume', valueId: 'large', sortOrder: 1 },
  { id: 'b1', productId: 'product', attributeId: 'color', valueId: 'red', sortOrder: 2 },
  { id: 'b2', productId: 'product', attributeId: 'color', valueId: 'blue', sortOrder: 3 },
];
let rows;
beforeEach(() => {
  rows = rowsForProduct();
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback(tx));
  vi.spyOn(db.Product, 'findByPk').mockResolvedValue({ id: 'product' });
  vi.spyOn(db.ProductAttribute, 'findAll').mockImplementation(async () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder));
  vi.spyOn(db.ProductAttribute, 'update').mockImplementation(async (data, { where }) => { Object.assign(rows.find((row) => row.id === where.id), data); return [1]; });
});
afterEach(() => vi.restoreAllMocks());

describe('product-specific attribute ordering', () => {
  it('appends a new product-only assignment after the saved order', async () => {
    vi.spyOn(db.ProductAttribute, 'max').mockResolvedValue(7);
    vi.spyOn(db.ProductAttribute, 'create').mockImplementation(async (data) => data);
    const created = await addProductAttribute('product', { customName: 'Care', customValue: 'Dry clean' });
    expect(created.sortOrder).toBe(8);
    expect(db.ProductAttribute.max).toHaveBeenCalledWith('sortOrder', { where: { productId: 'product' }, transaction: tx });
  });
  it('saves group order and value order together without changing assignments', async () => {
    const next = await reorderProductAttributes('product', ['b2', 'b1', 'a1', 'a2']);
    expect(next.map((row) => row.id)).toEqual(['b2', 'b1', 'a1', 'a2']);
    expect(next.map((row) => row.sortOrder)).toEqual([0, 1, 2, 3]);
    expect(rows.find((row) => row.id === 'b2')).toMatchObject({ productId: 'product', attributeId: 'color', valueId: 'blue' });
    expect(db.ProductAttribute.update).toHaveBeenCalledWith({ sortOrder: 0 }, { where: { id: 'b2', productId: 'product' }, transaction: tx });
  });
  it.each([
    ['a1', 'a2', 'b1'], ['a1', 'a1', 'b1', 'b2'], ['a1', 'a2', 'foreign', 'b2'],
  ])('rejects incomplete, duplicate, or foreign assignments: %j', async (...ids) => {
    await expect(reorderProductAttributes('product', ids)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.ProductAttribute.update).not.toHaveBeenCalled();
  });
  it('rejects interleaved groups before changing any row', async () => {
    await expect(reorderProductAttributes('product', ['a1', 'b1', 'a2', 'b2'])).rejects.toThrow('Keep values');
    expect(db.ProductAttribute.update).not.toHaveBeenCalled();
  });
  it('validates UUIDs and duplicate IDs at the route boundary', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(reorderProductAttributesSchema.validate({ rowIds: [id] }).error).toBeUndefined();
    expect(reorderProductAttributesSchema.validate({ rowIds: [id, id] }).error).toBeDefined();
    expect(reorderProductAttributesSchema.validate({ rowIds: ['invalid'] }).error).toBeDefined();
  });
  it('returns saved order through the product serializer and variant options', () => {
    const attributes = rows.map((row) => ({ ...row, sortOrder: ['b2', 'b1', 'a1', 'a2'].indexOf(row.id) }));
    const variants = [{ id: 'variant', price: 150, stockQty: 3, options: [
      { attributeId: 'volume', valueId: 'small', attribute: { id: 'volume', name: 'Volume' }, value: { id: 'small', value: '250' } },
      { attributeId: 'color', valueId: 'red', attribute: { id: 'color', name: 'Color' }, value: { id: 'red', value: 'Red' } },
    ] }];
    const result = serializeProductPricing({ price: 100, attributes, variants }, { adminView: true });
    expect(result.attributes.map((row) => row.id)).toEqual(['b2', 'b1', 'a1', 'a2']);
    expect(result.variants[0].options.map((option) => option.attributeId)).toEqual(['color', 'volume']);
    expect(result.variants[0].options[0]).toMatchObject({ attributeOrder: 0, valueOrder: 1 });
    expect(result.variants[0]).toMatchObject({ price: 150, stockQty: 3 });
    expect(variants[0].options[0].attributeId).toBe('volume');
  });
  it('includes product order when fetching variant lists', async () => {
    vi.spyOn(db.ProductVariant, 'findAll').mockResolvedValue([{ id: 'variant', options: [{ attributeId: 'color', valueId: 'blue' }] }]);
    const result = await getProductVariants('product');
    expect(result[0].options[0]).toMatchObject({ attributeOrder: 1, valueOrder: 1 });
  });
});
