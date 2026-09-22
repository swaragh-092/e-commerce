import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { ShippingProvider } = require('../../src/modules');
const ShippingService = require('../../src/modules/shipping/shipping.service');

describe('Shipping service helpers', () => {
    it('exports package dimension helpers used by order shipment creation', () => {
        expect(typeof ShippingService.computePackageDimensions).toBe('function');
        expect(typeof ShippingService.computeChargeableWeight).toBe('function');
    });

    it('computes package dimensions with default product dimensions', () => {
        const dims = ShippingService.computePackageDimensions([
            { product: {}, quantity: 1 },
        ]);

        expect(dims).toEqual({
            maxL: 10,
            maxB: 10,
            totalH: 10,
            totalWeightGrams: 500,
            volumeCm3: 1000,
        });
    });

    it('exports provider resolution and testing helpers', () => {
        expect(typeof ShippingService.getDefaultProvider).toBe('function');
        expect(typeof ShippingService.getManualProvider).toBe('function');
        expect(typeof ShippingService.testCalculation).toBe('function');
    });

    it('resolves active default provider from ShippingProvider model', async () => {
        const mockProvider = {
            id: 'mock-provider-id',
            code: 'shiprocket',
            name: 'Shiprocket',
            enabled: true,
            isDefault: true,
        };

        const findOneSpy = vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue(mockProvider);

        const provider = await ShippingService.getDefaultProvider();
        expect(provider).toEqual(mockProvider);
        expect(findOneSpy).toHaveBeenCalled();

        findOneSpy.mockRestore();
    });
});
