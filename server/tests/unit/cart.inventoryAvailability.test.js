import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const cartService = require('../../src/modules/cart/cart.service');

afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback({ LOCK: { UPDATE: 'UPDATE' } }));
  vi.spyOn(db.Cart, 'findOne').mockResolvedValue({ id: 'cart' });
  vi.spyOn(db.Cart, 'findByPk').mockResolvedValue({ id: 'cart' });
});

describe('cart inventory availability', () => {
  it.each(['draft', 'archived'])('rejects an enabled but %s product', async (status) => {
    vi.spyOn(db.Product, 'findByPk').mockResolvedValue({ id: 'product', status, isEnabled: true, quantity: 30 });
    const create = vi.spyOn(db.CartItem, 'create');
    await expect(cartService.addItem('user', null, { productId: 'product', quantity: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(create).not.toHaveBeenCalled();
  });
  it('uses standalone stock for Simple products even when historical variants exist', async () => {
    vi.spyOn(db.Product, 'findByPk').mockResolvedValue({ id: 'product', type: 'simple', status: 'published', isEnabled: true, quantity: 50, reservedQty: 27 });
    const count = vi.spyOn(db.ProductVariant, 'count');
    vi.spyOn(db.CartItem, 'findOne').mockResolvedValue(null);
    vi.spyOn(db.CartItem, 'create').mockResolvedValue({});
    vi.spyOn(db.Cart, 'findByPk').mockResolvedValue({ id: 'cart', items: [] });
    // Empty cart serialization needs no product pricing data.
    await cartService.addItem('user', null, { productId: 'product', quantity: 1 });
    expect(db.CartItem.create).toHaveBeenCalledWith(expect.objectContaining({ variantId: null, quantity: 1 }), expect.anything());
    expect(count).not.toHaveBeenCalled();
  });
  it('rejects obsolete variant IDs on Simple products', async () => {
    vi.spyOn(db.Product, 'findByPk').mockResolvedValue({ id: 'product', type: 'simple', status: 'published', isEnabled: true, quantity: 50, reservedQty: 27 });
    await expect(cartService.addItem('user', null, { productId: 'product', variantId: 'old', quantity: 1 })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
  it('rejects a disabled variant without changing its inventory', async () => {
    vi.spyOn(db.Product, 'findByPk').mockResolvedValue({ id: 'product', type: 'variable', status: 'published', isEnabled: true });
    vi.spyOn(db.ProductVariant, 'findOne').mockResolvedValue(null);
    await expect(cartService.addItem('user', null, { productId: 'product', variantId: 'disabled', quantity: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(db.ProductVariant.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'disabled', productId: 'product', isActive: true } }));
  });
});
