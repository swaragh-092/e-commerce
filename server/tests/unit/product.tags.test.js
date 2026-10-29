import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const service = require('../../src/modules/product/tag.service');
const { normalizeTagNames } = require('../../src/modules/product/tag.utils');
const { productTagsSchema, tagWriteSchema, tagListSchema } = require('../../src/modules/product/tag.validation');
const { updateProductSchema, productListQuerySchema } = require('../../src/modules/product/product.validation');
const { authorizePermissions, authorizeAnyPermission } = require('../../src/middleware/role.middleware');
const { PERMISSIONS } = require('../../src/config/permissions');
const transaction = { id: 'test-transaction' };

afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback(transaction));
  vi.spyOn(db.sequelize, 'query').mockResolvedValue([]);
});

describe('tag normalization and limits', () => {
  it('normalizes Unicode, whitespace and case duplicates while preserving the first label', () => {
    expect(normalizeTagNames(['  Home   Gardening ', 'home gardening', 'Ｓｕｍｍｅｒ', 'Summer'])).toEqual(['Home Gardening', 'Summer']);
  });
  it('rejects empty, oversized, comma and hidden control labels', () => {
    for (const name of [' ', 'x'.repeat(101), 'summer,sale', 'Summer，Sale', 'sum\u200Bmer', 'summer\n']) {
      expect(tagWriteSchema.validate({ name }).error, name).toBeDefined();
    }
    expect(tagWriteSchema.validate({ name: '  Summer   Planting  ' }).value.name).toBe('Summer Planting');
    expect(productTagsSchema.validate(Array.from({ length: 51 }, (_, i) => `Tag ${i}`)).error).toBeDefined();
  });
  it('allows explicit clearing and keeps omitted tags absent on partial updates', () => {
    expect(updateProductSchema.validate({ tags: [] }).value.tags).toEqual([]);
    expect(updateProductSchema.validate({ name: 'New name' }).value).not.toHaveProperty('tags');
  });
  it('bounds dictionary pagination and rejects object filters', () => {
    expect(tagListSchema.validate({ limit: 101 }).error).toBeDefined();
    expect(tagListSchema.validate({ page: 0 }).error).toBeDefined();
    expect(productListQuerySchema.validate({ tags: { name: 'summer' } }).error).toBeDefined();
    expect(productListQuerySchema.validate({ tags: 'summer,home-gardening' }).error).toBeUndefined();
  });
});

describe('shared dictionary and assignment', () => {
  it('reuses tags once per normalized name and locks before lookup', async () => {
    const existing = { id: 'tag-1', name: 'Summer', slug: 'summer' };
    const find = vi.spyOn(db.Tag, 'findOne').mockResolvedValue(existing);
    const create = vi.spyOn(db.Tag, 'create');
    const product = { setTags: vi.fn() };
    await service.syncProductTags(product, [' summer ', 'SUMMER'], transaction);
    expect(find).toHaveBeenCalledOnce();
    expect(db.sequelize.query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), { transaction });
    expect(db.sequelize.query.mock.invocationCallOrder[0]).toBeLessThan(find.mock.invocationCallOrder[0]);
    expect(create).not.toHaveBeenCalled();
    expect(product.setTags).toHaveBeenCalledWith([existing], { transaction });
  });
  it('creates a new normalized tag with a usable slug', async () => {
    vi.spyOn(db.Tag, 'findOne').mockResolvedValue(null);
    const create = vi.spyOn(db.Tag, 'create').mockImplementation(async (data) => data);
    expect(await service.resolveTags([' Home   Gardening '], transaction)).toEqual([{ name: 'Home Gardening', slug: 'home-gardening', description: '' }]);
    expect(create).toHaveBeenCalledWith({ name: 'Home Gardening', slug: 'home-gardening', description: '' }, { transaction });
  });
  it('uses a nonempty slug for non-Latin labels', async () => {
    vi.spyOn(db.Tag, 'findOne').mockResolvedValue(null);
    vi.spyOn(db.Tag, 'create').mockImplementation(async (data) => data);
    const [tag] = await service.resolveTags(['ಬೀಜಗಳು'], transaction);
    expect(tag.name).toBe('ಬೀಜಗಳು');
    expect(tag.slug).toMatch(/^tag-[a-f0-9-]+$/);
  });
  it('clears all links for [] and leaves them untouched for omitted tags', async () => {
    const product = { setTags: vi.fn() };
    await service.syncProductTags(product, undefined, transaction);
    expect(product.setTags).not.toHaveBeenCalled();
    expect(db.sequelize.query).not.toHaveBeenCalled();
    await service.syncProductTags(product, [], transaction);
    expect(product.setTags).toHaveBeenCalledWith([], { transaction });
  });
  it('keeps tag slugs stable during a global rename', async () => {
    const tag = { id: 'tag', update: vi.fn().mockResolvedValue({}) };
    vi.spyOn(db.Tag, 'findByPk').mockResolvedValue(tag);
    vi.spyOn(db.Tag, 'findOne').mockResolvedValue(null);
    await service.renameTag('tag', ' New   Label ');
    expect(tag.update).toHaveBeenCalledWith({ name: 'New Label' }, { transaction });
  });
  it('rejects duplicate creation and conflicting renames', async () => {
    vi.spyOn(db.Tag, 'findOne').mockResolvedValue({ id: 'other' });
    vi.spyOn(db.Tag, 'findByPk').mockResolvedValue({ id: 'tag', update: vi.fn() });
    await expect(service.addTag('Summer')).rejects.toMatchObject({ statusCode: 409 });
    await expect(service.renameTag('tag', 'Summer')).rejects.toMatchObject({ statusCode: 409 });
  });
  it('deletes only the tag and reports a missing tag', async () => {
    const tag = { destroy: vi.fn() };
    vi.spyOn(db.Tag, 'findByPk').mockResolvedValueOnce(tag).mockResolvedValue(null);
    const destroyProducts = vi.spyOn(db.Product, 'destroy');
    await service.deleteTag('tag');
    expect(tag.destroy).toHaveBeenCalledWith({ transaction });
    expect(destroyProducts).not.toHaveBeenCalled();
    await expect(service.deleteTag('missing')).rejects.toMatchObject({ statusCode: 404 });
  });
  it('escapes filter values and supports both slugs and legacy names without filtering the tag include', () => {
    const filter = service.buildTagFilter(["a'); DROP TABLE tags; --", 'Summer']);
    expect(filter.val).toContain("a''); DROP TABLE tags; --");
    expect(filter.val).toContain('t.slug IN');
    expect(filter.val).toContain('t.name IN');
    expect(filter.val).toContain('canonical_tag.slug = t.name');
    expect(service.buildTagFilter(' , ')).toBeNull();
  });
  it('filters usage before pagination and sorts by the same live product count', async () => {
    const find = vi.spyOn(db.Tag, 'findAndCountAll').mockResolvedValue({ rows: [], count: 0 });
    await service.listTags({ usage: 'unused', sortBy: 'products', sortDir: 'desc', page: 2 });
    const query = find.mock.calls[0][0];
    expect(query.offset).toBe(20);
    expect(query.where[db.Sequelize.Op.and][0].val).toContain('= 0');
    expect(query.order[0][0].val).toBe(query.attributes.include[0][0].val);
    expect(query.order[0][1]).toBe('DESC');
    await service.listTags({ usage: 'used' });
    expect(find.mock.calls[1][0].where[db.Sequelize.Op.and][0].val).toContain('> 0');
    expect(tagListSchema.validate({ usage: 'other' }).error).toBeDefined();
    expect(tagListSchema.validate({ sortBy: 'name;drop' }).error).toBeDefined();
    expect(tagListSchema.validate({ sortDir: 'other' }).error).toBeDefined();
  });
  it('counts live products without joining or materializing the product collection', async () => {
    const find = vi.spyOn(db.Tag, 'findAndCountAll').mockResolvedValue({ rows: [], count: 0 });
    await service.listTags({ search: '50%', page: 2, limit: 20 });
    const query = find.mock.calls[0][0];
    expect(query.offset).toBe(20);
    expect(query.attributes.include[0][0].val).toContain('p.deleted_at IS NULL');
    expect(query.include).toEqual([expect.objectContaining({ model: db.Media, as: 'image' })]);
    expect(query.where.name[db.Sequelize.Op.iLike]).toBe('%50\\%%');
  });
});

describe('tag permissions', () => {
  it('requires authentication, and a read grant does not permit dictionary writes', () => {
    const next = vi.fn();
    authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE)({}, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
    next.mockClear();
    authorizePermissions(PERMISSIONS.PRODUCTS_UPDATE)({ user: { role: 'custom', permissions: [PERMISSIONS.PRODUCTS_READ] } }, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });
  it('lets product creators read suggestions without granting rename or deletion', () => {
    const user = { role: 'custom', permissions: [PERMISSIONS.PRODUCTS_CREATE] };
    const next = vi.fn();
    authorizeAnyPermission(PERMISSIONS.PRODUCTS_READ, PERMISSIONS.PRODUCTS_CREATE, PERMISSIONS.PRODUCTS_UPDATE)({ user }, {}, next);
    expect(next).toHaveBeenCalledWith();
    next.mockClear();
    authorizePermissions(PERMISSIONS.PRODUCTS_DELETE)({ user }, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
  });
});

describe('product listing tag filter consistency', () => {
  it('applies the same predicate to products, price range, and status counts, while retaining every returned tag', async () => {
    const products = require('../../src/modules/product/product.service');
    const settings = require('../../src/modules/settings/settings.service');
    vi.spyOn(db.Setting, 'findOne').mockResolvedValue(null);
    vi.spyOn(settings, 'getFeatures').mockResolvedValue({ features: { pricing: true, brands: true } });
    vi.spyOn(settings, 'getByGroup').mockResolvedValue({ lowStockThreshold: 10 });
    vi.spyOn(db.Product, 'findAndCountAll').mockResolvedValue({ rows: [], count: 0 });
    vi.spyOn(db.Product, 'findOne').mockResolvedValue({ min: 0, max: 0 });
    vi.spyOn(db.Product, 'findAll').mockResolvedValue([]);
    vi.spyOn(db.Product, 'count').mockResolvedValue(0);
    await products.getProducts({ tags: 'home-gardening' }, 1, 20, true);
    const list = db.Product.findAndCountAll.mock.calls[0][0];
    const range = db.Product.findOne.mock.calls[0][0];
    const counts = db.Product.findAll.mock.calls[0][0];
    const predicate = list.where[db.Sequelize.Op.and].find((condition) => condition.val?.includes('product_tags'));
    expect(predicate).toBeDefined();
    expect(range.where[db.Sequelize.Op.and]).toContain(predicate);
    expect(counts.where[db.Sequelize.Op.and]).toContain(predicate);
    const tags = list.include.find((include) => include.as === 'tags');
    expect(tags.attributes.exclude).toContain('description');
    expect(tags.where).toBeUndefined();
    expect(tags.required).not.toBe(true);
  });
});
