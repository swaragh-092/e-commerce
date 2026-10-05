import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const InventoryService = require('../../src/modules/inventory/inventory.service');
const { Product, InventoryTransaction } = require('../../src/modules');

afterEach(() => vi.restoreAllMocks());

describe('Inventory after pre-dispatch shipment cancellation', () => {
    it('restores and reserves the items so a replacement shipment can deduct them once', async () => {
        const product = { id: 'product-1', quantity: 8, reservedQty: 0 };
        product.update = vi.fn(async (values) => Object.assign(product, values));
        vi.spyOn(Product, 'findByPk').mockResolvedValue(product);
        vi.spyOn(InventoryTransaction, 'create').mockResolvedValue({});
        const request = { productId: product.id, qty: 2, orderId: 'order-1', transaction: { LOCK: { UPDATE: 'UPDATE' } } };

        await InventoryService.restockReturn(request);
        await InventoryService.reserve(request);
        expect(product.quantity).toBe(10);
        expect(product.reservedQty).toBe(2);

        await InventoryService.shipDeduct(request);
        expect(product.quantity).toBe(8);
        expect(product.reservedQty).toBe(0);
    });
});
