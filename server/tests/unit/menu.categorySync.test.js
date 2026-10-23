import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { Menu, MenuItem, Category } = require('../../src/modules');
const MenuService = require('../../src/modules/menu/menu.service');
const CategoryService = require('../../src/modules/category/category.service');

afterEach(() => vi.restoreAllMocks());

describe('synced category menu', () => {
  it('syncs only the selected category branch and follows its current child order', async () => {
    const menu = {
      id: 'menu-2',
      items: [
        { id: 'fruits-menu-item', menuId: 'menu-2', label: 'Fruits', targetType: 'category', targetId: 'fruits', syncChildren: true, placement: 'center', sortOrder: 10 },
        { id: 'home-menu-item', menuId: 'menu-2', label: 'Home', targetType: 'system_route', url: '/', placement: 'center', sortOrder: 0 },
      ],
    };
    vi.spyOn(Menu, 'findByPk').mockResolvedValue({ toJSON: () => menu });
    const categories = [
      { id: 'vegetables', name: 'Vegetables', slug: 'vegetables', parentId: null, sortOrder: 0 },
      { id: 'fruits', name: 'Fruits', slug: 'fruits', parentId: null, sortOrder: 10 },
      { id: 'watermelon', name: 'Watermelon', slug: 'watermelon', parentId: 'fruits', sortOrder: 20 },
      { id: 'muskmelon', name: 'Muskmelon', slug: 'muskmelon', parentId: 'fruits', sortOrder: 10 },
      { id: 'cantaloupe', name: 'Cantaloupe', slug: 'cantaloupe', parentId: 'muskmelon', sortOrder: 0 },
      { id: 'broccoli', name: 'Broccoli', slug: 'broccoli', parentId: 'vegetables', sortOrder: 0 },
    ];
    vi.spyOn(Category, 'findAll').mockImplementation(async () => [...categories].sort((a, b) =>
      a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));

    const first = await MenuService.getMenuById('menu-2');
    expect(first.items[1].label).toBe('Fruits');
    expect(first.items[1].children.map((item) => item.label)).toEqual(['Muskmelon', 'Watermelon']);
    expect(first.items[1].children[0].children[0]).toMatchObject({
      label: 'Cantaloupe', targetId: 'cantaloupe', generatedFromCategory: true,
    });
    expect(first.items[1].children.flatMap((item) => [item.label, ...item.children.map((child) => child.label)]))
      .not.toContain('Broccoli');

    categories.find((category) => category.id === 'watermelon').sortOrder = 5;
    categories.find((category) => category.id === 'fruits').name = 'Fresh Fruit';
    const second = await MenuService.getMenuById('menu-2');
    expect(second.items[1]).toMatchObject({ label: 'Fresh Fruit' });
    expect(second.items[1].children.map((item) => item.label)).toEqual(['Watermelon', 'Muskmelon']);
  });

  it('uses the current category hierarchy and order without changing manual items', async () => {
    const menu = {
      id: 'menu-1',
      items: [
        { id: 'heading', menuId: 'menu-1', label: 'Categories', targetType: 'category_tree', placement: 'center', sortOrder: 10 },
        { id: 'home', menuId: 'menu-1', label: 'Home', targetType: 'system_route', url: '/', placement: 'center', sortOrder: 0 },
      ],
    };
    vi.spyOn(Menu, 'findByPk').mockResolvedValue({ toJSON: () => menu });
    const categories = [
      { id: 'fruit', name: 'Fruit', slug: 'fruit', icon: 'mui:eco', parentId: null, sortOrder: 0 },
      { id: 'flowers', name: 'Flowers', slug: 'flowers', parentId: null, sortOrder: 10 },
      { id: 'apple', name: 'Apple', slug: 'apple', parentId: 'fruit', sortOrder: 0 },
    ];
    vi.spyOn(Category, 'findAll').mockImplementation(async () => [...categories].sort((a, b) =>
      a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));

    const first = await MenuService.getMenuById('menu-1');
    expect(first.items.map((item) => item.label)).toEqual(['Home', 'Categories']);
    expect(first.items[1].children.map((item) => item.label)).toEqual(['Fruit', 'Flowers']);
    expect(first.items[1].children[0].icon).toBe('mui:eco');
    expect(first.items[1].children[0].children[0]).toMatchObject({
      label: 'Apple', targetId: 'apple', url: '/products?category=apple', generatedFromCategory: true,
    });

    categories[0].name = 'Fresh Fruit';
    categories[0].sortOrder = 20;
    const second = await MenuService.getMenuById('menu-1');
    expect(second.items[1].children.map((item) => item.label)).toEqual(['Flowers', 'Fresh Fruit']);

    vi.spyOn(Menu, 'findAll').mockResolvedValue([{ toJSON: () => menu }]);
    const publicFirst = await MenuService.getPublicMenuByLocation('category-sync-test');
    expect(publicFirst.items[1].children[0].url).toBe('/products?category=flowers');
    categories[1].name = 'Fresh Flowers';
    const publicSecond = await MenuService.getPublicMenuByLocation('category-sync-test');
    expect(publicSecond.items[1].children[0].label).toBe('Fresh Flowers');
  });
});

describe('moving menu items', () => {
  it('moves active and soft-deleted descendants with a selected synced category parent', async () => {
    const storedItems = [
      { id: 'fruit-root', menuId: 'source-menu', parentId: null, targetType: 'category', syncChildren: true },
      { id: 'manual-child', menuId: 'source-menu', parentId: 'fruit-root', deletedAt: null },
      { id: 'manual-grandchild', menuId: 'source-menu', parentId: 'manual-child', deletedAt: new Date() },
    ];
    vi.spyOn(Menu, 'findByPk').mockResolvedValue({ id: 'target-menu' });
    vi.spyOn(MenuItem, 'findAll').mockImplementation(async ({ where, paranoid = true }) => {
      const found = where.id
        ? storedItems.filter((item) => where.id.includes(item.id))
        : storedItems.filter((item) => item.menuId === where.menuId && item.parentId === where.parentId);
      return paranoid ? found.filter((item) => !item.deletedAt) : found;
    });
    vi.spyOn(MenuItem, 'update').mockResolvedValue([1]);
    vi.spyOn(MenuItem.sequelize, 'transaction').mockResolvedValue({
      commit: vi.fn(),
      rollback: vi.fn(),
    });

    await MenuService.moveItems(['fruit-root'], 'target-menu');

    expect(MenuItem.update).toHaveBeenCalledTimes(3);
    expect(MenuItem.update).toHaveBeenNthCalledWith(1,
      { menuId: 'target-menu', parentId: null },
      expect.objectContaining({ where: { id: 'fruit-root' }, paranoid: false, transaction: expect.any(Object) }));
    expect(MenuItem.update).toHaveBeenNthCalledWith(2,
      { menuId: 'target-menu', parentId: 'fruit-root' },
      expect.objectContaining({ where: { id: 'manual-child' }, paranoid: false, transaction: expect.any(Object) }));
    expect(MenuItem.update).toHaveBeenNthCalledWith(3,
      { menuId: 'target-menu', parentId: 'manual-child' },
      expect.objectContaining({ where: { id: 'manual-grandchild' }, paranoid: false, transaction: expect.any(Object) }));
  });
});

describe('category ordering', () => {
  it('moves a category even when adjacent siblings start with the same sort order', async () => {
    const siblings = ['Apple', 'Banana', 'Cherry'].map((name, index) => ({
      id: String(index), name, parentId: null, sortOrder: 0,
      update: vi.fn(async function update(values) { Object.assign(this, values); }),
    }));
    vi.spyOn(Category, 'findByPk').mockResolvedValue(siblings[1]);
    vi.spyOn(Category, 'findAll').mockResolvedValue(siblings);
    vi.spyOn(Category.sequelize, 'transaction').mockImplementation(async (callback) => callback({}));

    await CategoryService.reorderCategory('1', 'up');

    expect(siblings.map((item) => [item.name, item.sortOrder])).toEqual([
      ['Banana', 0], ['Apple', 10], ['Cherry', 20],
    ]);
  });
});
