import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Menu, MenuItem, Category } = require('../../src/modules');
const service = require('../../src/modules/menu/menu.service');
const validation = require('../../src/modules/menu/menu.validation');
afterEach(() => vi.restoreAllMocks());
const makeMenu = (id, limit = 10) => ({
  id, slug: id,
  items: [
    { id: 'parent', menuId: id, label: 'Products', targetType: 'none', childDisplayLimit: limit },
    ...Array.from({ length: 25 }, (_, index) => ({
      id: `child-${index}`, menuId: id, parentId: 'parent', label: `Product ${index}`,
      targetType: 'custom_url', url: `/product-${index}`, sortOrder: index,
    })),
  ],
});

describe('public menu child pagination', () => {
  it('limits public responses, preserves admin children, and does not truncate the cached tree', async () => {
    const menu = makeMenu('pagination-location');
    vi.spyOn(Menu, 'findAll').mockResolvedValue([menu]);
    vi.spyOn(Menu, 'findByPk').mockResolvedValue(menu);
    const publicMenu = await service.getPublicMenuByLocation(menu.id);
    expect(publicMenu.items[0].children.map(child => child.id)).toEqual(Array.from({ length: 10 }, (_, i) => `child-${i}`));
    expect(publicMenu.items[0].childrenPagination).toEqual({ total: 25, limit: 10, offset: 0, hasMore: true, nextOffset: 10 });
    expect((await service.getPublicMenuByLocation(menu.id)).items[0].children).toHaveLength(10);
    expect((await service.getMenuById(menu.id)).items[0].children).toHaveLength(25);
  });
  it('returns ordered next and last pages, including an empty page past the end', async () => {
    vi.spyOn(Menu, 'findOne').mockResolvedValue(makeMenu('pagination-next'));
    const next = await service.getPublicMenuChildren('pagination-next', 'parent', { offset: 10 });
    expect(next.items.map(child => child.id)).toEqual(Array.from({ length: 10 }, (_, i) => `child-${i + 10}`));
    expect(next.pagination.nextOffset).toBe(20);
    const last = await service.getPublicMenuChildren('pagination-next', 'parent', { offset: 20 });
    expect(last.items).toHaveLength(5);
    expect(last.pagination).toMatchObject({ hasMore: false, nextOffset: null });
    const empty = await service.getPublicMenuChildren('pagination-next', 'parent', { offset: 50 });
    expect(empty.items).toEqual([]);
    expect(empty.pagination.hasMore).toBe(false);
  });
  it('preserves unlimited menus and also limits public slug responses', async () => {
    vi.spyOn(Menu, 'findOne').mockResolvedValue(makeMenu('pagination-unlimited', null));
    expect((await service.getPublicMenuBySlug('pagination-unlimited')).items[0].children).toHaveLength(25);
    Menu.findOne.mockResolvedValue(makeMenu('pagination-slug', 5));
    expect((await service.getPublicMenuBySlug('pagination-slug')).items[0].children).toHaveLength(5);
  });
  it('limits synced categories at each depth and pages generated parents by their public IDs', async () => {
    vi.spyOn(Menu, 'findOne').mockResolvedValue({ id: 'pagination-synced', items: [{
      id: 'root', menuId: 'pagination-synced', targetType: 'category_tree', childDisplayLimit: 1,
    }] });
    vi.spyOn(Category, 'findAll').mockResolvedValue([
      { id: 'fruit', name: 'Fruit', slug: 'fruit', parentId: null },
      { id: 'veg', name: 'Vegetables', slug: 'vegetables', parentId: null },
      { id: 'apple', name: 'Apple', slug: 'apple', parentId: 'fruit' },
      { id: 'berry', name: 'Berry', slug: 'berry', parentId: 'fruit' },
    ]);
    const menu = await service.getPublicMenuBySlug('pagination-synced');
    expect(menu.items[0].children).toHaveLength(1);
    const fruit = menu.items[0].children[0];
    expect(fruit.children).toHaveLength(1);
    expect(fruit.childrenPagination.nextOffset).toBe(1);
    const page = await service.getPublicMenuChildren('pagination-synced', fruit.id, { offset: 1 });
    expect(page.items.map(child => child.label)).toEqual(['Berry']);
    expect(page.pagination.hasMore).toBe(false);
  });
  it('does not expose inactive menus, hidden parents or their visible descendants', async () => {
    const findMenu = vi.spyOn(Menu, 'findOne').mockResolvedValue(null);
    await expect(service.getPublicMenuChildren('private-menu', 'parent')).rejects.toMatchObject({ statusCode: 404 });
    expect(findMenu).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'private-menu', isActive: true } }));
    // The visibility query omits the hidden parent. Its descendants must not become public roots.
    findMenu.mockResolvedValue({ id: 'hidden-parent-menu', items: [{ id: 'child', parentId: 'hidden-parent', url: '/private' }] });
    await expect(service.getPublicMenuChildren('hidden-parent-menu', 'child')).rejects.toMatchObject({ statusCode: 404 });
    expect((await service.getPublicMenuBySlug('hidden-parent-menu')).items).toEqual([]);
  });
  it('persists and clears the limit without changing existing child records', async () => {
    vi.spyOn(Menu, 'findByPk').mockResolvedValue({ id: 'write-menu' });
    const create = vi.spyOn(MenuItem, 'create').mockImplementation(async data => data);
    await service.createMenuItem('write-menu', { label: 'Products', targetType: 'none', childDisplayLimit: 30 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ childDisplayLimit: 30 }));
    const update = vi.fn();
    vi.spyOn(MenuItem, 'findOne').mockResolvedValue({ id: 'parent', targetType: 'none', childDisplayLimit: 30, update });
    await service.updateMenuItem('write-menu', 'parent', { childDisplayLimit: null });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ childDisplayLimit: null }));
  });
  it('validates opaque generated IDs and normalizes query values for the public controller', async () => {
    const menuId = 'a1a1a1a1-1111-4111-8111-a1a1a1a1a1a1';
    const itemId = `category-sync:${menuId}:b2b2b2b2-2222-4222-8222-b2b2b2b2b2b2`;
    expect(validation.publicChildrenParamsSchema.validate({ menuId, itemId }).error).toBeUndefined();
    expect(validation.publicChildrenParamsSchema.validate({ menuId: 'bad-id', itemId }).error).toBeDefined();
    const query = validation.publicChildrenQuerySchema.validate({ offset: '10', limit: '10' }).value;
    const page = { items: [], pagination: { total: 10, limit: 10, offset: 10, hasMore: false, nextOffset: null } };
    const read = vi.spyOn(service, 'getPublicMenuChildren').mockResolvedValue(page);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await require('../../src/modules/menu/menu.controller').getPublicMenuChildren({ params: { menuId, itemId }, query }, res, next);
    expect(read).toHaveBeenCalledWith(menuId, itemId, { offset: 10, limit: 10 });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: page }));
    expect(next).not.toHaveBeenCalled();
  });
  it('rejects invalid limits and pagination inputs, and permits clearing a limit', () => {
    for (const value of [0, -1, 101, 1.5]) {
      expect(validation.updateMenuItemSchema.validate({ targetType: 'none', childDisplayLimit: value }).error).toBeDefined();
      expect(validation.publicChildrenQuerySchema.validate({ limit: value }).error).toBeDefined();
    }
    expect(validation.updateMenuItemSchema.validate({ targetType: 'none', childDisplayLimit: null }).error).toBeUndefined();
    expect(validation.publicChildrenQuerySchema.validate({ offset: -1 }).error).toBeDefined();
  });
});
