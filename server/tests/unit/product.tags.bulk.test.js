import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const service = require('../../src/modules/product/tag.service');
const { bulkProductTagsSchema } = require('../../src/modules/product/tag.validation');
const { PERMISSIONS } = require('../../src/config/permissions');
const transaction = { LOCK: { UPDATE: 'UPDATE' } };
const idA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const idB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const payload = { productIds: [idB, idA], action: 'add', tags: ['Summer'] };

afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback(transaction));
  vi.spyOn(db.sequelize, 'query').mockResolvedValue([]);
  vi.spyOn(db.Product, 'findAll').mockResolvedValue([{ id: idA }, { id: idB }]);
  vi.spyOn(db.ProductTag, 'findAll').mockResolvedValue([]);
  vi.spyOn(db.ProductTag, 'bulkCreate').mockResolvedValue([]);
  vi.spyOn(db.ProductTag, 'destroy').mockResolvedValue(0);
  vi.spyOn(db.Tag, 'findOne').mockResolvedValue({ id: 'summer' });
  vi.spyOn(db.Tag, 'findAll').mockResolvedValue([{ id: 'summer' }]);
});

describe('bulk tag request validation', () => {
  it('requires a bounded, unique UUID selection, valid action and at least one tag', () => {
    expect(bulkProductTagsSchema.validate(payload).error).toBeUndefined();
    for (const patch of [
      { productIds: [] }, { productIds: ['invalid'] }, { productIds: [idA, idA] },
      { productIds: [idA, idA.toUpperCase()] },
      { productIds: Array.from({ length: 101 }, (_, i) => `${i.toString(16).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`) },
      { action: 'replace' }, { tags: [] }, { tags: [' '] },
    ]) expect(bulkProductTagsSchema.validate({ ...payload, ...patch }).error).toBeDefined();
    expect(bulkProductTagsSchema.validate({ ...payload, productIds: [idA.toUpperCase()] }).value.productIds).toEqual([idA]);
  });
});

describe('atomic bulk tag updates', () => {
  it('adds only missing tags and preserves unrelated product labels', async () => {
    db.ProductTag.findAll.mockResolvedValue([
      { productId: idA, tagId: 'summer' }, { productId: idA, tagId: 'organic' },
      { productId: idB, tagId: 'rare' },
    ]);
    const result = await service.bulkUpdateProductTags(payload);
    expect(db.ProductTag.bulkCreate).toHaveBeenCalledWith([{ productId: idB, tagId: 'summer' }], { transaction, ignoreDuplicates: true });
    expect(db.ProductTag.destroy).not.toHaveBeenCalled();
    expect(result).toEqual({ selectedCount: 2, updatedCount: 1, changedCount: 1 });
    expect(db.Product.findAll).toHaveBeenCalledWith(expect.objectContaining({ attributes: ['id'], order: [['id', 'ASC']], lock: 'UPDATE', transaction }));
    expect(db.Product.findAll.mock.invocationCallOrder[0]).toBeLessThan(db.sequelize.query.mock.invocationCallOrder[0]);
  });
  it('treats repeated additions as a no-op', async () => {
    db.ProductTag.findAll.mockResolvedValue([{ productId: idA, tagId: 'summer' }, { productId: idB, tagId: 'summer' }]);
    expect(await service.bulkUpdateProductTags(payload)).toEqual({ selectedCount: 2, updatedCount: 0, changedCount: 0 });
    expect(db.ProductTag.bulkCreate).not.toHaveBeenCalled();
  });
  it('rejects a missing or deleted product before resolving any tags', async () => {
    db.Product.findAll.mockResolvedValue([{ id: idA }]);
    await expect(service.bulkUpdateProductTags(payload)).rejects.toMatchObject({ statusCode: 409 });
    expect(db.Tag.findOne).not.toHaveBeenCalled();
    expect(db.ProductTag.bulkCreate).not.toHaveBeenCalled();
  });
  it('rejects additions beyond 50 tags before writing any product associations', async () => {
    db.ProductTag.findAll.mockResolvedValue(Array.from({ length: 50 }, (_, index) => ({ productId: idB, tagId: `existing-${index}` })));
    await expect(service.bulkUpdateProductTags(payload)).rejects.toMatchObject({ statusCode: 400 });
    expect(db.ProductTag.bulkCreate).not.toHaveBeenCalled();
    expect(db.ProductTag.destroy).not.toHaveBeenCalled();
  });
  it('removes only specified associations, including legacy duplicate tag ids', async () => {
    db.Tag.findAll.mockResolvedValue([{ id: 'summer' }, { id: 'summer-legacy' }]);
    db.ProductTag.findAll.mockResolvedValue([
      { productId: idA, tagId: 'summer' }, { productId: idA, tagId: 'organic' },
      { productId: idB, tagId: 'summer-legacy' },
    ]);
    expect(await service.bulkUpdateProductTags({ ...payload, action: 'remove' })).toEqual({ selectedCount: 2, updatedCount: 2, changedCount: 2 });
    expect(db.ProductTag.destroy).toHaveBeenCalledWith({
      where: { productId: { [db.Sequelize.Op.in]: [idA, idB] }, tagId: { [db.Sequelize.Op.in]: ['summer', 'summer-legacy'] } }, transaction,
    });
    expect(db.ProductTag.bulkCreate).not.toHaveBeenCalled();
    expect(db.Tag.findOne).not.toHaveBeenCalled();
  });
  it('does not create unknown tags during removal', async () => {
    const create = vi.spyOn(db.Tag, 'create');
    db.Tag.findAll.mockResolvedValue([]);
    expect(await service.bulkUpdateProductTags({ ...payload, action: 'remove', tags: ['Unknown'] })).toEqual({ selectedCount: 2, updatedCount: 0, changedCount: 0 });
    expect(create).not.toHaveBeenCalled();
    expect(db.ProductTag.destroy).not.toHaveBeenCalled();
  });
  it('propagates database failures through the transaction', async () => {
    db.ProductTag.bulkCreate.mockRejectedValue(new Error('write failed'));
    await expect(service.bulkUpdateProductTags(payload)).rejects.toThrow('write failed');
  });
});

describe('bulk tag route permission', () => {
  it('registers the bulk route before the tag-id route and requires product update', () => {
    const router = require('../../src/modules/product/tag.routes');
    const routes = router.stack.filter((layer) => layer.route?.methods.patch);
    expect(routes.map((layer) => layer.route.path)).toEqual(['/products', '/:id']);
    const permission = routes[0].route.stack[0].handle;
    const next = vi.fn();
    permission({ user: { permissions: [PERMISSIONS.PRODUCTS_READ] } }, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
    next.mockClear();
    permission({ user: { permissions: [PERMISSIONS.PRODUCTS_UPDATE] } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
