import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Menu, MenuItem, Category } = require('../../src/modules');
const service = require('../../src/modules/menu/menu.service');
let items;
let transaction;
beforeEach(() => {
  items = [{ id: 'parent', menuId: 'menu', parentId: null }, { id: 'child', menuId: 'menu', parentId: 'parent' }];
  transaction = { commit: vi.fn(), rollback: vi.fn() };
  vi.spyOn(MenuItem.sequelize, 'transaction').mockResolvedValue(transaction);
  vi.spyOn(MenuItem, 'findOne').mockImplementation(async ({ where }) => items.find((item) => item.id === where.id && item.menuId === where.menuId) || null);
  vi.spyOn(MenuItem, 'findAll').mockImplementation(async ({ where }) => items.filter((item) => where.id.includes(item.id) && item.menuId === where.menuId));
  vi.spyOn(MenuItem, 'count').mockImplementation(async ({ where }) => items.filter((item) => item.menuId === where.menuId && (where.parentId === undefined || item.parentId === where.parentId)).length);
  vi.spyOn(MenuItem, 'destroy').mockImplementation(async ({ where }) => {
    const ids = Array.isArray(where.id) ? where.id : [where.id];
    items = items.filter((item) => !ids.includes(item.id));
  });
  vi.spyOn(Category, 'count').mockResolvedValue(0);
});
afterEach(() => vi.restoreAllMocks());

describe('child-first menu deletion', () => {
  it('rejects a parent without deleting anything and allows it after its child is deleted', async () => {
    await expect(service.deleteMenuItem('menu', 'parent')).rejects.toMatchObject({ statusCode: 409, code: 'MENU_ITEM_HAS_CHILDREN', message: expect.stringContaining('Delete the child items first') });
    expect(MenuItem.destroy).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalledOnce();
    await service.deleteMenuItem('menu', 'child');
    expect(items.map((item) => item.id)).toEqual(['parent']);
    await service.deleteMenuItem('menu', 'parent');
    expect(items).toEqual([]);
  });
  it('rejects a parent and its child selected together with no partial deletions', async () => {
    await expect(service.bulkDeleteMenuItems('menu', ['child', 'parent'])).rejects.toMatchObject({ statusCode: 409 });
    expect(MenuItem.destroy).not.toHaveBeenCalled();
    expect(transaction.commit).not.toHaveBeenCalled();
  });
  it('bulk-deletes only selected leaves and preserves their parent', async () => {
    items.push({ id: 'second-child', menuId: 'menu', parentId: 'parent' });
    await service.bulkDeleteMenuItems('menu', ['child', 'second-child']);
    expect(items.map((item) => item.id)).toEqual(['parent']);
    expect(MenuItem.destroy).toHaveBeenCalledWith({ where: { id: ['child', 'second-child'], menuId: 'menu' }, transaction });
  });
  it('rejects IDs from another menu and rolls back missing bulk selections', async () => {
    await expect(service.deleteMenuItem('other-menu', 'child')).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.bulkDeleteMenuItems('menu', ['child', 'missing'])).rejects.toMatchObject({ statusCode: 404 });
    expect(MenuItem.destroy).not.toHaveBeenCalled();
  });
  it('blocks a nested parent and explains generated category children', async () => {
    items.push({ id: 'grandchild', menuId: 'menu', parentId: 'child' });
    await expect(service.deleteMenuItem('menu', 'child')).rejects.toMatchObject({ statusCode: 409 });
    items = [{ id: 'synced', menuId: 'menu', targetType: 'category', targetId: 'fruit', syncChildren: true }];
    Category.count.mockResolvedValue(2);
    await expect(service.deleteMenuItem('menu', 'synced')).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('turn off category syncing') });
    expect(MenuItem.destroy).not.toHaveBeenCalled();
    expect(Category.count).toHaveBeenCalledWith({ where: { parentId: 'fruit' }, transaction });
  });
  it('does not let deleting a whole menu bypass its items', async () => {
    const destroy = vi.fn();
    vi.spyOn(Menu, 'findByPk').mockResolvedValue({ destroy });
    await expect(service.deleteMenu('menu')).rejects.toMatchObject({ statusCode: 409, code: 'MENU_HAS_ITEMS' });
    expect(destroy).not.toHaveBeenCalled();
    items = [];
    await service.deleteMenu('menu');
    expect(destroy).toHaveBeenCalledOnce();
  });
  it('undo restores only the chosen item without resurrecting deleted descendants', async () => {
    const item = { id: 'parent', restore: vi.fn() };
    MenuItem.findOne.mockResolvedValue(item);
    const restoreDescendants = vi.spyOn(MenuItem, 'restore');
    await service.restoreMenuItem('menu', 'parent');
    expect(item.restore).toHaveBeenCalledWith({ transaction });
    expect(MenuItem.findAll).not.toHaveBeenCalled();
    expect(restoreDescendants).not.toHaveBeenCalled();
  });
});
