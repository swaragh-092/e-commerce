import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../services/api';
import { getCategories, getCategoryTree } from '../../services/categoryService';
import MenuService from '../../services/menuService';
import { searchProducts } from '../../services/searchService';
import { filterCategoryTiles } from '../../utils/categories';

vi.mock('../../services/api', () => ({ default: { get: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { data: [] } });
});

describe('storefront category requests', () => {
  it('opts in explicitly while keeping admin category requests unfiltered', async () => {
    await getCategoryTree();
    await getCategories();
    expect(api.get.mock.calls.slice(0, 2)).toEqual([
      ['/categories', { params: undefined }], ['/categories', { params: undefined }],
    ]);
    await getCategoryTree({ hideEmpty: true });
    expect(api.get).toHaveBeenLastCalledWith('/categories', { params: { hideEmpty: true } });
  });

  it('preserves public menu opt-in and filters storefront search', async () => {
    await MenuService.getPublicMenu('header', { hideEmpty: true });
    expect(api.get).toHaveBeenLastCalledWith('/menus/public/header', { params: { hideEmpty: true } });
    await MenuService.getPublicMenu('header');
    expect(api.get).toHaveBeenLastCalledWith('/menus/public/header', { params: undefined });
    await searchProducts({ q: 'fruit', page: 2 });
    expect(api.get).toHaveBeenLastCalledWith('/search', { params: { q: 'fruit', page: 2, hideEmpty: true } });
  });
});

describe('configured homepage category links', () => {
  it('removes empty category tiles before display limits and retains nested categories and custom links', () => {
    const categories = [{ slug: 'fruit', children: [{ slug: 'melon & more' }] }];
    const tiles = [
      { id: 'empty', link: '/category/empty' },
      { id: 'empty-query', link: '/products?category=empty' },
      { id: 'parent', link: '/category/fruit' },
      { id: 'leaf', link: '/category/melon%20%26%20more' },
      { id: 'custom', link: '/sale' },
    ];
    expect(filterCategoryTiles(tiles, categories).map(tile => tile.id)).toEqual(['parent', 'leaf', 'custom']);
    expect(filterCategoryTiles(tiles, []).map(tile => tile.id)).toEqual(['custom']);
    expect(tiles).toHaveLength(5);
  });
});
