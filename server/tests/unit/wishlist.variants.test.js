import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const models = require('../../src/modules');
const service = require('../../src/modules/wishlist/wishlist.service');
const settings = require('../../src/modules/settings/settings.service');
const t = {};

describe('wishlist variant identity and availability', () => {
  beforeEach(() => {
    vi.spyOn(settings, 'getFeatures').mockResolvedValue({ features: { wishlist: true } });
    vi.spyOn(models.sequelize, 'transaction').mockImplementation(callback => callback(t));
    vi.spyOn(models.Wishlist, 'findOne').mockResolvedValue({ id: 'wishlist' });
    vi.spyOn(models.Product, 'findByPk').mockResolvedValue({ id: 'product', status: 'published', isEnabled: true });
    vi.spyOn(models.WishlistItem, 'findOrCreate').mockResolvedValue([{ id: 'item' }, false]);
  });
  afterEach(() => vi.restoreAllMocks());
  it('rejects an inactive variant instead of saving it', async () => {
    vi.spyOn(models.ProductVariant, 'findOne').mockResolvedValue({ id: 'inactive', isActive: false });
    await expect(service.addItem(null, 'session', 'product', 'inactive')).rejects.toThrow(/unavailable/);
    expect(models.WishlistItem.findOrCreate).not.toHaveBeenCalled();
  });
  it('keeps the chosen product/variant pair when saving and deleting', async () => {
    vi.spyOn(models.ProductVariant, 'findOne').mockResolvedValue({ id: 'variant', isActive: true });
    await service.addItem(null, 'session', 'product', 'variant');
    expect(models.WishlistItem.findOrCreate).toHaveBeenCalledWith(expect.objectContaining({ where: { wishlistId: 'wishlist', productId: 'product', variantId: 'variant' } }));
    const destroy = vi.fn();
    vi.spyOn(models.WishlistItem, 'findOne').mockResolvedValue({ destroy });
    await service.removeItem(null, 'session', 'product', 'variant');
    expect(models.WishlistItem.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { wishlistId: 'wishlist', productId: 'product', variantId: 'variant' } }));
    expect(destroy).toHaveBeenCalledOnce();
  });
});
