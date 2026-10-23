import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const { buildVariantGenerationPlan } = require('../../src/modules/attribute/variantGenerationPlan');
const db = require('../../src/modules');
const service = require('../../src/modules/attribute/attribute.service');
const { generateVariantsSchema } = require('../../src/modules/attribute/productAttribute.validation');
const row = (valueId, attributeId = 'height') => ({ attributeId, valueId, isVariantAttr: true, attribute: { id: attributeId, name: attributeId }, value: { value: valueId, unitLabel: 'cm' } });
const variant = (id, ids, fields = {}) => ({ id, options: ids.map(([attributeId, valueId]) => ({ attributeId, valueId })), price: 150, stockQty: 0, reservedQty: 0, updatedAt: '2026-10-22', destroy: vi.fn(), ...fields });

describe('variant generation plan', () => {
  it('builds combinations with units and deduplicates assigned values', () => {
    const { review, added } = buildVariantGenerationPlan([row('10'), row('10'), row('20'), row('1', 'size'), row('2', 'size')], []);
    expect(review).toMatchObject({ total: 4, addedCount: 4, keptCount: 0, removedCount: 0 });
    expect(added).toHaveLength(4);
    expect(review.combinations[0].label).toBe('10 cm / 1 cm');
  });
  it('distinguishes additions, unchanged combinations and removals', () => {
    const keep = variant('keep', [['height', '10']], { price: 175, stockQty: 8, sku: 'KEEP' });
    const old = variant('old', [['height', '30']]);
    const plan = buildVariantGenerationPlan([row('10'), row('20')], [keep, old]);
    expect(plan.review).toMatchObject({ total: 2, addedCount: 1, keptCount: 1, removedCount: 1, blockedRemovalCount: 0 });
    expect(plan.added[0][0].valueId).toBe('20');
    expect(plan.removed).toEqual([old]);
    expect(keep).toMatchObject({ price: 175, stockQty: 8, sku: 'KEEP' });
  });
  it.each([[{ stockQty: 3 }, 0], [{ stockQty: 3, reservedQty: 1 }, 1]])('only blocks removal for active reservations: %j', (fields, blocked) => {
    expect(buildVariantGenerationPlan([row('10')], [variant('old', [['height', '20']], fields)]).review.blockedRemovalCount).toBe(blocked);
  });
  it('does not promote legacy custom specifications', () => {
    expect(() => buildVariantGenerationPlan([{ isVariantAttr: true, customName: 'Care', customValue: 'Shade' }], [])).toThrow('Choose at least one attribute');
  });
  it('rejects oversized combinations before enumerating them', () => {
    const rows = Array.from({ length: 23 }, (_, index) => [row(String(index)), row(String(index), 'size')]).flat();
    expect(() => buildVariantGenerationPlan(rows, [])).toThrow('within 500 variants');
  });
  it('bounds previews while counting the entire selection', () => {
    const rows = Array.from({ length: 20 }, (_, index) => row(String(index)));
    expect(buildVariantGenerationPlan(rows, []).review).toMatchObject({ total: 20, combinations: expect.any(Array) });
    expect(buildVariantGenerationPlan(rows, []).review.combinations).toHaveLength(12);
  });
  it('detects changed prices, stock and selected values without depending on row order', () => {
    const rows = [row('10'), row('20')];
    const original = variant('keep', [['height', '10']]);
    const token = buildVariantGenerationPlan(rows, [original]).review.token;
    expect(buildVariantGenerationPlan([...rows].reverse(), [original]).review.token).toBe(token);
    expect(buildVariantGenerationPlan(rows, [{ ...original, stockQty: 3 }]).review.token).not.toBe(token);
    expect(buildVariantGenerationPlan(rows, [{ ...original, price: 300 }]).review.token).not.toBe(token);
    expect(buildVariantGenerationPlan([row('10')], [original]).review.token).not.toBe(token);
  });
});

describe('reviewed variant writes', () => {
  const tx = { LOCK: { UPDATE: 'UPDATE' } };
  let rows;
  let variants;
  beforeEach(() => {
    rows = [row('10'), row('20')]; variants = [variant('keep', [['height', '10']], { stockQty: 4, sku: 'KEEP' })];
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback(tx));
    vi.spyOn(db.sequelize, 'query').mockResolvedValue([]);
    vi.spyOn(db.Product, 'findByPk').mockResolvedValue({ id: 'product', price: 100 });
    vi.spyOn(db.ProductAttribute, 'findAll').mockImplementation(async () => rows);
    vi.spyOn(db.ProductVariant, 'findAll').mockImplementation(async () => variants);
    vi.spyOn(db.ProductVariant, 'findOne').mockImplementation(async () => variants[0]);
    vi.spyOn(db.ProductVariant, 'create').mockResolvedValue({ id: 'new' });
    vi.spyOn(db.ProductVariant, 'sum').mockResolvedValue(4);
    vi.spyOn(db.Product, 'update').mockResolvedValue([1]);
    vi.spyOn(db.VariantOption, 'bulkCreate').mockResolvedValue([]);
  });
  afterEach(() => vi.restoreAllMocks());
  it('only creates missing combinations and preserves existing prices, stock, and SKU', async () => {
    const review = await service.previewVariantGeneration('product');
    await service.bulkGenerateVariants('product', { planToken: review.token, defaultPrice: 200, defaultStockQty: 1 });
    expect(db.ProductVariant.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ price: 200, stockQty: 1 }), { transaction: tx });
    expect(variants[0]).toMatchObject({ price: 150, stockQty: 4, sku: 'KEEP' });
    expect(variants[0].destroy).not.toHaveBeenCalled();
  });
  it('rejects a stale review before changing anything', async () => {
    const review = await service.previewVariantGeneration('product');
    variants[0].stockQty = 5;
    await expect(service.bulkGenerateVariants('product', { planToken: review.token })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(db.ProductVariant.create).not.toHaveBeenCalled();
  });
  it('requires an explicit reviewed confirmation for removals', async () => {
    variants = [variant('old', [['height', '30']])];
    await expect(service.bulkGenerateVariants('product')).rejects.toMatchObject({ code: 'CONFLICT' });
    const review = await service.previewVariantGeneration('product');
    await expect(service.bulkGenerateVariants('product', { planToken: review.token })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(variants[0].destroy).not.toHaveBeenCalled();
    await service.bulkGenerateVariants('product', { planToken: review.token, confirmRemovals: true });
    expect(variants[0].destroy).toHaveBeenCalledWith({ transaction: tx });
  });
  it('allows confirmed removal of ordinary stock without requiring a stock adjustment first', async () => {
    rows = [row('20')];
    const review = await service.previewVariantGeneration('product');
    await service.bulkGenerateVariants('product', { planToken: review.token, confirmRemovals: true });
    expect(variants[0].destroy).toHaveBeenCalledWith({ transaction: tx });
  });
  it('retains variants reserved by active orders', async () => {
    rows = [row('20')]; variants[0].reservedQty = 1;
    const review = await service.previewVariantGeneration('product');
    await expect(service.bulkGenerateVariants('product', { planToken: review.token, confirmRemovals: true })).rejects.toThrow('reserved');
    expect(variants[0].destroy).not.toHaveBeenCalled();
    expect(db.ProductVariant.create).not.toHaveBeenCalled();
  });
  it('validates the review token and starting inventory', () => {
    expect(generateVariantsSchema.validate({ planToken: 'a'.repeat(64), defaultStockQty: 1 }).error).toBeUndefined();
    expect(generateVariantsSchema.validate({ planToken: 'invalid' }).error).toBeDefined();
    expect(generateVariantsSchema.validate({ defaultStockQty: 1.5 }).error).toBeDefined();
    expect(generateVariantsSchema.validate({ defaultPrice: -1 }).error).toBeDefined();
  });
  it('rejects aggregate stock overflow before writing variants', async () => {
    const review = await service.previewVariantGeneration('product');
    await expect(service.bulkGenerateVariants('product', { planToken: review.token, defaultStockQty: 2147483647 })).rejects.toThrow('combined variant stock');
    expect(db.ProductVariant.create).not.toHaveBeenCalled();
  });
  it('allows deleting a stocked variant, but retains active order reservations', async () => {
    await service.deleteProductVariant('product', 'keep');
    expect(variants[0].destroy).toHaveBeenCalledWith({ transaction: tx });
    variants[0].destroy.mockClear(); variants[0].reservedQty = 1;
    await expect(service.deleteProductVariant('product', 'keep')).rejects.toThrow('reserved');
    expect(variants[0].destroy).not.toHaveBeenCalled();
  });
});
