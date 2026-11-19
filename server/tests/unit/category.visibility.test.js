import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const { Category, Product, Menu, Setting, Sequelize, sequelize } = db;
const { Op } = Sequelize;
const { getPopulatedCategoryIds } = require('../../src/modules/category/category.visibility');
const categoriesService = require('../../src/modules/category/category.service');
const menus = require('../../src/modules/menu/menu.service');
const builder = require('../../src/modules/apiBuilder/apiBuilder.service');
const searchRepository = require('../../src/modules/search/search.repository');
const searchService = require('../../src/modules/search/search.service');
const settings = require('../../src/modules/settings/settings.service');
const { hideEmptyQuerySchema } = require('../../src/utils/common.validation');

const rows = [
  { id: 'root', parentId: null, name: 'Fruit', slug: 'fruit', sortOrder: 0 },
  { id: 'empty', parentId: 'root', name: 'Empty', slug: 'empty', sortOrder: 0 },
  { id: 'branch', parentId: 'root', name: 'Melons', slug: 'melons', sortOrder: 1 },
  { id: 'leaf', parentId: 'branch', name: 'Watermelon', slug: 'watermelon', sortOrder: 0 },
  { id: 'direct', parentId: 'root', name: 'Apple', slug: 'apple', sortOrder: 2 },
  { id: 'empty-root', parentId: null, name: 'Flowers', slug: 'flowers', sortOrder: 1 },
];
const modelRows = () => rows.map(row => ({ ...row, toJSON: () => ({ ...row }) }));
const visibleIds = ['leaf', 'branch', 'root', 'direct'];

function mockCategories() {
  return vi.spyOn(Category, 'findAll').mockImplementation(async options => {
    if (options.include) return [{ id: 'leaf' }, { id: 'direct' }, { id: 'leaf' }];
    if (options.where?.parentId) {
      return rows.filter(row => row.parentId === options.where.parentId &&
        (!options.where.id || options.where.id[Op.in].includes(row.id)));
    }
    return modelRows();
  });
}

beforeEach(() => {
  vi.spyOn(settings, 'getFeatures').mockResolvedValue({ features: {} });
  vi.spyOn(Setting, 'findOne').mockResolvedValue(null);
  searchService.invalidateSearchCache();
});
afterEach(() => vi.restoreAllMocks());

describe('populated storefront categories', () => {
  it('uses published, enabled, non-deleted products regardless of stock, and keeps all ancestors', async () => {
    // Exercise the real Sequelize SQL generation without a database connection.
    const query = vi.spyOn(sequelize, 'query').mockImplementation(async sql =>
      sql.includes('JOIN') ? [{ id: 'leaf' }, { id: 'direct' }] : rows);
    expect([...(await getPopulatedCategoryIds())]).toEqual(visibleIds);
    const sql = query.mock.calls.find(([sql]) => sql.includes('JOIN'))[0];
    expect(sql).toContain('"products"."status" = \'published\'');
    expect(sql).toContain('"products"."is_enabled" = true');
    expect(sql).toContain('"products"."deleted_at" IS NULL');
    expect(sql).not.toMatch(/stock|quantity|variants/i);
  });

  it('prunes empty branches recursively without changing the admin tree', async () => {
    const findAll = mockCategories();
    const full = await categoriesService.getCategoryTree();
    expect(full.map(row => row.id)).toEqual(['root', 'empty-root']);
    expect(full[0].children.map(row => row.id)).toEqual(['empty', 'branch', 'direct']);
    expect(findAll).toHaveBeenCalledTimes(1);
    const filtered = await categoriesService.getCategoryTree({ hideEmpty: true });
    expect(filtered.map(row => row.id)).toEqual(['root']);
    expect(filtered[0].children.map(row => row.id)).toEqual(['branch', 'direct']);
    expect(filtered[0].children[0].children[0].id).toBe('leaf');
  });

  it('returns no categories when there are no storefront products', async () => {
    vi.spyOn(Category, 'findAll').mockImplementation(async options => options.include ? [] : modelRows());
    expect(await categoriesService.getCategoryTree({ hideEmpty: true })).toEqual([]);
    expect(await categoriesService.getCategoryTree()).toHaveLength(2);
  });

  it('filters the subcategory rail while keeping direct empty-category URLs valid', async () => {
    mockCategories();
    vi.spyOn(Category, 'findOne').mockResolvedValue(modelRows()[0]);
    vi.spyOn(Product, 'findOne').mockResolvedValue({ min: 0, max: 0 });
    vi.spyOn(Product, 'findAndCountAll').mockResolvedValue({ count: 0, rows: [] });
    const filtered = await categoriesService.getCategoryWithProducts('fruit', { hideEmpty: true });
    expect(filtered.subcategories.map(row => row.id)).toEqual(['branch', 'direct']);
    expect(filtered.products).toEqual([]);
    const full = await categoriesService.getCategoryWithProducts('fruit');
    expect(full.subcategories.map(row => row.id)).toContain('empty');
  });

  it('terminates safely even if stored parent references contain a cycle', async () => {
    vi.spyOn(Category, 'findAll').mockResolvedValue([{ id: 'a' }]);
    const ids = await getPopulatedCategoryIds([{ id: 'a', parentId: 'b' }, { id: 'b', parentId: 'a' }]);
    expect([...ids]).toEqual(['a', 'b']);
  });

  it('defaults to the full response and validates the opt-in flag', () => {
    expect(hideEmptyQuerySchema.validate({}).value).toEqual({ hideEmpty: false });
    expect(hideEmptyQuerySchema.validate({ hideEmpty: 'true' }).value.hideEmpty).toBe(true);
    expect(hideEmptyQuerySchema.validate({ hideEmpty: 'false' }).value.hideEmpty).toBe(false);
    expect(hideEmptyQuerySchema.validate({ hideEmpty: 'invalid' }).error).toBeTruthy();
    const builderQuery = hideEmptyQuerySchema.unknown(true).validate({ hideEmpty: 'true', page: '2', customFilter: 'fruit' });
    expect(builderQuery.value).toEqual({ hideEmpty: true, page: '2', customFilter: 'fruit' });
  });
});

describe('public category menus', () => {
  const menu = { id: 'populated-menu', items: [
    { id: 'home', menuId: 'populated-menu', label: 'Home', targetType: 'custom_url', url: '/', sortOrder: 0 },
    { id: 'catalog', menuId: 'populated-menu', label: 'Products', targetType: 'category_tree', childDisplayLimit: 1, sortOrder: 1 },
    { id: 'manual-empty', menuId: 'populated-menu', label: 'Empty category', targetType: 'category', targetId: 'empty-root', sortOrder: 2 },
  ] };

  it('filters both synced and manual categories before paging without changing Menu Builder', async () => {
    mockCategories();
    vi.spyOn(Menu, 'findOne').mockResolvedValue(menu);
    vi.spyOn(Menu, 'findAll').mockResolvedValue([menu]);
    vi.spyOn(Menu, 'findByPk').mockResolvedValue(menu);
    const result = await menus.getPublicMenuBySlug('populated-menu', { hideEmpty: true });
    expect(result.items.map(item => item.id)).toEqual(['home', 'catalog']);
    const root = result.items[1].children[0];
    expect(root.targetId).toBe('root');
    expect(result.items[1].childrenPagination).toMatchObject({ total: 1, hasMore: false });
    expect(root.children[0].targetId).toBe('branch');
    expect(root.childrenPagination).toMatchObject({ total: 2, nextOffset: 1 });
    const next = await menus.getPublicMenuChildren(menu.id, root.id, { hideEmpty: true, offset: 1, limit: 1 });
    expect(next.items.map(item => item.targetId)).toEqual(['direct']);
    expect(next.pagination).toMatchObject({ total: 2, hasMore: false });
    expect((await menus.getPublicMenuByLocation('populated-test', { hideEmpty: true })).items).toHaveLength(2);
    const admin = await menus.getMenuById(menu.id);
    expect(admin.items).toHaveLength(3);
    expect(admin.items[1].children).toHaveLength(2);
    expect(admin.items[1].children[0].children.map(item => item.targetId)).toContain('empty');
  });

  it('does not serve a cached unfiltered manual menu to a filtered caller', async () => {
    mockCategories();
    vi.spyOn(Menu, 'findOne').mockResolvedValue({ ...menu, items: menu.items.filter(item => item.id !== 'catalog') });
    expect((await menus.getPublicMenuBySlug('manual-cache-isolation')).items).toHaveLength(2);
    expect((await menus.getPublicMenuBySlug('manual-cache-isolation', { hideEmpty: true })).items.map(item => item.id)).toEqual(['home']);
  });
});

describe('API Builder categories', () => {
  it('constrains category queries before pagination and preserves admin previews', async () => {
    mockCategories();
    const findPage = vi.spyOn(Category, 'findAndCountAll').mockResolvedValue({ rows: [rows[0]], count: 1 });
    const config = { includeMeta: false, blocks: [{ key: 'categories', resource: 'categories', pagination: { enabled: true }, relations: [{ relation: 'children', enabled: true }] }] };
    const result = await builder.executeConfig(config, { query: { hideEmpty: true } });
    expect(result.categories.pagination.total).toBe(1);
    expect(findPage.mock.calls[0][0].where[Op.and][1].id[Op.in]).toEqual(visibleIds);
    const childQuery = Category.findAll.mock.calls.find(([options]) => options.where?.parentId === 'root')[0];
    expect(childQuery.where[Op.and][1].id[Op.in]).toEqual(visibleIds);
    findPage.mockClear();
    await builder.executeConfig(config, { preview: true, query: { hideEmpty: true } });
    expect(findPage.mock.calls[0][0].where).toEqual({});
  });
});

describe('category search filtering', () => {
  it('restricts matches and spelling suggestions before their limits', async () => {
    const populatedCategoryIds = new Set(visibleIds);
    const findAll = vi.spyOn(Category, 'findAll').mockResolvedValue([]);
    await searchRepository.searchCategories('fruit', 5, { populatedCategoryIds });
    expect(findAll.mock.calls[0][0].where[Op.and][1].id[Op.in]).toEqual(visibleIds);
    vi.spyOn(Product, 'unscoped').mockReturnValue({ findAll: vi.fn().mockResolvedValue([]) });
    await searchRepository.suggestCorrection('empty', { includeBrands: false, populatedCategoryIds });
    expect(findAll.mock.calls[1][0].where.id[Op.in]).toEqual(visibleIds);
  });

  it('separates filtered and unfiltered search cache entries', async () => {
    mockCategories();
    vi.spyOn(settings, 'getFeatures').mockResolvedValue({ features: { brands: false } });
    vi.spyOn(searchRepository, 'searchProducts').mockResolvedValue({ rows: [], count: 0 });
    const searchCategories = vi.spyOn(searchRepository, 'searchCategories').mockImplementation(async (_q, _n, options) =>
      options.populatedCategoryIds ? [{ id: 'root' }] : [{ id: 'empty-root' }]);
    expect((await searchService.search('fruit')).categories).toEqual([{ id: 'empty-root' }]);
    expect((await searchService.search('fruit', 1, 20, { hideEmpty: true })).categories).toEqual([{ id: 'root' }]);
    expect((await searchService.search('fruit', 1, 20, { hideEmpty: true })).fromCache).toBe(true);
    expect(searchCategories).toHaveBeenCalledTimes(2);
  });
});
