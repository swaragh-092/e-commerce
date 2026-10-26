import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const db = require('../../src/modules');
const { cloneProductVariants } = require('../../src/modules/attribute/productVariantClone.service');
const productService = require('../../src/modules/product/product.service');
const { productListQuerySchema } = require('../../src/modules/product/product.validation');
const tx = { LOCK: { UPDATE: 'UPDATE' } };
let source, target, variants, assignments;
const option = (valueId) => ({ attributeId: 'color', valueId });
const sourceVariant = (id, valueId) => ({ id, productId: 'source', options: [option(valueId)], price: 199, stockQty: 12, reservedQty: 3, sku: `SOURCE-${id}`, isActive: true, weightGrams: 250, sortOrder: id === 'red' ? 0 : 1 });
beforeEach(() => {
  source = { id: 'source', type: 'variable', name: 'Source' };
  target = { id: 'target', type: 'variable', name: 'Target', sku: 'TARGET', quantity: 0, reservedQty: 0, update: vi.fn(async (data) => Object.assign(target, data)) };
  variants = [sourceVariant('red', 'red'), sourceVariant('blue', 'blue')];
  assignments = [
    { id: 'source-blue', productId: 'source', ...option('blue'), sortOrder: 0 },
    { id: 'source-red', productId: 'source', ...option('red'), sortOrder: 1 },
  ];
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback(tx));
  vi.spyOn(db.sequelize, 'query').mockResolvedValue([]);
  vi.spyOn(db.Product, 'findAll').mockImplementation(async () => [source, target].filter(Boolean));
  vi.spyOn(db.Product, 'findByPk').mockImplementation(async () => target);
  vi.spyOn(db.ProductVariant, 'findAll').mockImplementation(async () => variants);
  vi.spyOn(db.ProductVariant, 'sum').mockImplementation(async (field, { where }) => variants.filter((variant) => variant.productId === 'target' && (!where.isActive || variant.isActive !== false)).reduce((sum, variant) => sum + Number(variant[field] || 0), 0));
  vi.spyOn(db.ProductAttribute, 'findAll').mockImplementation(async () => assignments);
  vi.spyOn(db.AttributeValue, 'findAll').mockResolvedValue([{ id: 'red', attributeId: 'color' }, { id: 'blue', attributeId: 'color' }]);
  vi.spyOn(db.ProductAttribute, 'create').mockImplementation(async (data) => { const row = { id: `assignment-${assignments.length}`, ...data }; assignments.push(row); return row; });
  vi.spyOn(db.ProductVariant, 'create').mockImplementation(async (data) => { const variant = { id: `new-${variants.length}`, options: [], ...data }; variants.push(variant); return variant; });
  vi.spyOn(db.VariantOption, 'bulkCreate').mockImplementation(async (data) => { for (const item of data) variants.find((variant) => variant.id === item.variantId).options.push(item); return data; });
});
afterEach(() => vi.restoreAllMocks());

describe('copying product variants', () => {
  it('filters eligible products before pagination so simple products cannot hide copy sources', async () => {
    vi.spyOn(db.Setting, 'findOne').mockResolvedValue(null);
    vi.spyOn(db.Product, 'findAndCountAll').mockRejectedValue(new Error('query captured'));
    await expect(productService.getProducts({ hasVariants: true }, 1, 20)).rejects.toThrow('query captured');
    const query = db.Product.findAndCountAll.mock.calls[0][0];
    expect(query.limit).toBe(20);
    expect(query.where[db.Sequelize.Op.and].some((condition) => condition.val?.includes('copy_variant.deleted_at IS NULL'))).toBe(true);
    expect(productListQuerySchema.validate({ hasVariants: 'true' }).value.hasVariants).toBe(true);
    expect(productListQuerySchema.validate({ hasVariants: 'invalid' }).error).toBeDefined();
  });
  it('copies into an empty target, assigning exact values in source display order', async () => {
    const result = await cloneProductVariants('target', 'source');
    expect(result).toEqual({ createdCount: 2, skippedCount: 0, addedAssignments: 2 });
    expect(assignments.filter((row) => row.productId === 'target').map((row) => [row.valueId, row.sortOrder])).toEqual([['blue', 0], ['red', 1]]);
    const copied = variants.filter((variant) => variant.productId === 'target');
    expect(copied).toHaveLength(2);
    expect(copied[0]).toMatchObject({ price: 199, stockQty: 0, reservedQty: 0, weightGrams: 250, isActive: true });
    expect(copied[0].sku).toMatch(/^TARGET-[A-F0-9]{32}$/);
    expect(copied[0].sku).not.toBe(copied[1].sku);
    expect(copied[0].sku).not.toBe('SOURCE-red');
    expect(db.ProductAttribute.create).toHaveBeenCalledWith(expect.anything(), { transaction: tx });
    expect(db.ProductVariant.create).toHaveBeenCalledWith(expect.anything(), { transaction: tx });
    expect(variants[0]).toMatchObject({ stockQty: 12, reservedQty: 3, sku: 'SOURCE-red' });
  });
  it('is idempotent if copying is retried after a lost response', async () => {
    await cloneProductVariants('target', 'source');
    const result = await cloneProductVariants('target', 'source');
    expect(result).toEqual({ createdCount: 0, skippedCount: 2, addedAssignments: 0 });
    expect(db.ProductVariant.create).toHaveBeenCalledTimes(2);
    expect(db.ProductAttribute.create).toHaveBeenCalledTimes(2);
  });
  it('keeps existing target stock, price, SKU and order while adding missing combinations', async () => {
    const existing = { id: 'existing', productId: 'target', options: [option('red')], price: 349, stockQty: 7, reservedQty: 2, sku: 'KEEP', sortOrder: 5, isActive: true };
    variants.push(existing);
    assignments.push({ id: 'existing-red', productId: 'target', ...option('red'), isVariantAttr: true, sortOrder: 4 });
    expect(await cloneProductVariants('target', 'source')).toEqual({ createdCount: 1, skippedCount: 1, addedAssignments: 1 });
    expect(existing).toMatchObject({ price: 349, stockQty: 7, reservedQty: 2, sku: 'KEEP', sortOrder: 5 });
    expect(db.ProductVariant.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ sortOrder: 6 }), { transaction: tx });
    expect(target).toMatchObject({ quantity: 7, reservedQty: 2 });
  });
  it('enables existing display-only assignments without duplicating values', async () => {
    const row = { id: 'existing-blue', productId: 'target', ...option('blue'), isVariantAttr: false, sortOrder: 8, update: vi.fn() };
    assignments.push(row);
    await cloneProductVariants('target', 'source');
    expect(row.update).toHaveBeenCalledWith({ isVariantAttr: true }, { transaction: tx });
    expect(db.ProductAttribute.create).toHaveBeenCalledTimes(1);
    expect(row.sortOrder).toBe(8);
  });
  it('retains inactive state and safely handles missing product SKUs', async () => {
    target.sku = null; target.name = 'A'.repeat(150); variants[0].isActive = false;
    await cloneProductVariants('target', 'source');
    const copied = variants.filter((variant) => variant.productId === 'target');
    expect(copied[0].isActive).toBe(false);
    expect(copied[0].sku.length).toBeLessThanOrEqual(100);
  });
  it('rejects copying a product into itself', async () => {
    await expect(cloneProductVariants('target', 'target')).rejects.toThrow('another product');
    expect(db.ProductVariant.create).not.toHaveBeenCalled();
  });
  it.each(['simple', 'combo'])('rejects %s targets before creating any rows', async (type) => {
    target.type = type;
    await expect(cloneProductVariants('target', 'source')).rejects.toThrow('Variable Product');
    expect(db.ProductAttribute.create).not.toHaveBeenCalled();
  });
  it('rejects a source without variants', async () => {
    variants = [];
    await expect(cloneProductVariants('target', 'source')).rejects.toThrow('no variants');
  });
  it('rejects inconsistent source dimensions before assigning attributes', async () => {
    variants[1].options = [{ attributeId: 'size', valueId: 'large' }];
    await expect(cloneProductVariants('target', 'source')).rejects.toThrow('inconsistent');
    expect(db.ProductAttribute.create).not.toHaveBeenCalled();
  });
  it('rejects conflicting target dimensions instead of mixing incompatible variants', async () => {
    variants.push({ id: 'existing', productId: 'target', options: [{ attributeId: 'size', valueId: 'large' }] });
    await expect(cloneProductVariants('target', 'source')).rejects.toThrow('different attributes');
    expect(db.ProductVariant.create).not.toHaveBeenCalled();
  });
  it('rejects incorrect value/attribute relationships before writing', async () => {
    db.AttributeValue.findAll.mockResolvedValue([{ id: 'red', attributeId: 'size' }]);
    await expect(cloneProductVariants('target', 'source')).rejects.toThrow('no longer belongs');
    expect(db.ProductAttribute.create).not.toHaveBeenCalled();
  });
  it('rejects extra target dimensions enabled for variants', async () => {
    assignments.push({ productId: 'target', attributeId: 'size', valueId: 'large', isVariantAttr: true });
    await expect(cloneProductVariants('target', 'source')).rejects.toThrow('other attributes');
    expect(db.ProductVariant.create).not.toHaveBeenCalled();
  });
  it('enforces the 500-variant limit before making assignments', async () => {
    variants.push(...Array.from({ length: 500 }, (_, index) => ({ id: `existing-${index}`, productId: 'target', options: [option('red')] })));
    await expect(cloneProductVariants('target', 'source')).rejects.toThrow('exceed 500');
    expect(db.ProductAttribute.create).not.toHaveBeenCalled();
  });
});
