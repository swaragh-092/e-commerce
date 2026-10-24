import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const productTabService = require('../../src/modules/product/productTab.service');
const productComboService = require('../../src/modules/product/productCombo.service');

const { Product, ProductTab, ProductComboItem } = db;

afterEach(() => vi.restoreAllMocks());

describe('Public product tabs', () => {
  it('hides tabs for unpublished or disabled products', async () => {
    vi.spyOn(Product, 'findByPk').mockResolvedValue({ id: 'p1', status: 'draft', isEnabled: true });

    await expect(productTabService.getTabsForProduct('p1', { publicView: true }))
      .rejects.toMatchObject({ statusCode: 404, message: 'Product not found' });
  });

  it('returns only active tabs to storefront callers', async () => {
    vi.spyOn(Product, 'findByPk').mockResolvedValue({ id: 'p1', status: 'published', isEnabled: true });
    const findAll = vi.spyOn(ProductTab, 'findAll').mockResolvedValue([]);

    await productTabService.getTabsForProduct('p1', { publicView: true });

    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'p1', isActive: true },
    }));
  });

  it('keeps inactive tabs visible to staff callers', async () => {
    vi.spyOn(Product, 'findByPk').mockResolvedValue({ id: 'p1', status: 'draft', isEnabled: false });
    const findAll = vi.spyOn(ProductTab, 'findAll').mockResolvedValue([]);

    await productTabService.getTabsForProduct('p1', { publicView: false });

    expect(findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'p1' },
    }));
  });
});

describe('Public combo items', () => {
  it('hides combo contents for unpublished or disabled parent products', async () => {
    vi.spyOn(Product, 'findByPk').mockResolvedValue({ id: 'c1', type: 'combo', status: 'published', isEnabled: false });

    await expect(productComboService.getComboItems('c1', { publicView: true }))
      .rejects.toMatchObject({ statusCode: 404, message: 'Product not found' });
  });

  it('enforces public constraints in the combo query', async () => {
    vi.spyOn(Product, 'findByPk').mockResolvedValue({ id: 'c1', type: 'combo', status: 'published', isEnabled: true });
    const findAll = vi.spyOn(ProductComboItem, 'findAll').mockResolvedValue([]);

    await productComboService.getComboItems('c1', { publicView: true });

    const include = findAll.mock.calls[0][0].include;
    expect(include[0]).toMatchObject({
      as: 'item',
      where: { status: 'published', isEnabled: true },
      required: true,
    });
    expect(include[1]).toMatchObject({
      as: 'variant',
      where: { isActive: true },
    });
  });

  it('drops unpublished items and inactive variants from storefront results', async () => {
    vi.spyOn(Product, 'findByPk').mockResolvedValue({ id: 'c1', type: 'combo', status: 'published', isEnabled: true });
    vi.spyOn(ProductComboItem, 'findAll').mockResolvedValue([
      { id: 'i1', variantId: null, item: { status: 'published', isEnabled: true } },
      { id: 'i2', variantId: null, item: { status: 'draft', isEnabled: true } },
      { id: 'i3', variantId: null, item: { status: 'published', isEnabled: false } },
      { id: 'i4', variantId: 'v1', item: { status: 'published', isEnabled: true }, variant: { isActive: true } },
      { id: 'i5', variantId: 'v2', item: { status: 'published', isEnabled: true }, variant: { isActive: false } },
      { id: 'i6', variantId: 'v3', item: { status: 'published', isEnabled: true }, variant: null },
    ]);

    const items = await productComboService.getComboItems('c1', { publicView: true });

    expect(items.map((item) => item.id)).toEqual(['i1', 'i4']);
  });

  it('does not constrain combo queries for staff callers', async () => {
    vi.spyOn(Product, 'findByPk').mockResolvedValue({ id: 'c1', type: 'combo', status: 'draft', isEnabled: false });
    const findAll = vi.spyOn(ProductComboItem, 'findAll').mockResolvedValue([]);

    await productComboService.getComboItems('c1', { publicView: false });

    const include = findAll.mock.calls[0][0].include;
    expect(include[0].where).toBeUndefined();
    expect(include[1].where).toBeUndefined();
  });
});
