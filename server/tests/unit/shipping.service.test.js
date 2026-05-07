import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
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
});
