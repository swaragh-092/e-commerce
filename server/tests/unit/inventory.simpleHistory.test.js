import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const inventory = require('../../src/modules/inventory/inventory.service');
const tx = { LOCK: { UPDATE: 'UPDATE' } };
let product;
let variant;
afterEach(() => vi.restoreAllMocks());
beforeEach(() => {
  product = { id: 'simple', type: 'simple', quantity: 50, reservedQty: 27 };
  product.update = vi.fn(async (values) => Object.assign(product, values));
  variant = { id: 'old', stockQty: 22, reservedQty: 19 };
  variant.update = vi.fn(async (values) => Object.assign(variant, values));
  vi.spyOn(db.Product, 'findByPk').mockResolvedValue(product);
  vi.spyOn(db.ProductVariant, 'findOne').mockResolvedValue(variant);
  vi.spyOn(db.ProductVariant, 'sum').mockRejectedValue(new Error('Simple stock must not be recomputed from historical rows'));
  vi.spyOn(db.InventoryTransaction, 'create').mockResolvedValue({});
});

describe('Simple product with historical variant orders', () => {
  it('keeps new standalone reservations when historical variant reservations are released in a batch', async () => {
    await inventory.reserve({ productId: 'simple', qty: 2, transaction: tx });
    await inventory.release({ productId: 'simple', variantId: 'old', qty: 3, transaction: tx, syncParent: false });
    await inventory.syncParentProductFromVariants('simple', tx);
    expect(product).toMatchObject({ quantity: 50, reservedQty: 26 });
    expect(variant.reservedQty).toBe(16);
    expect(db.ProductVariant.sum).not.toHaveBeenCalled();
  });
  it('deducts and returns historical shipments without overwriting newer Simple stock', async () => {
    await inventory.shipDeduct({ productId: 'simple', variantId: 'old', qty: 4, transaction: tx });
    expect(product).toMatchObject({ quantity: 46, reservedQty: 23 });
    await inventory.restockReturn({ productId: 'simple', variantId: 'old', qty: 4, transaction: tx });
    expect(product).toMatchObject({ quantity: 50, reservedQty: 23 });
    await inventory.reserve({ productId: 'simple', variantId: 'old', qty: 4, transaction: tx });
    expect(product).toMatchObject({ quantity: 50, reservedQty: 27 });
  });
  it('rejects inconsistent historical reservations instead of silently replacing current stock', async () => {
    product.reservedQty = 1;
    await expect(inventory.release({ productId: 'simple', variantId: 'old', qty: 3, transaction: tx })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(product.update).not.toHaveBeenCalled();
  });
});
