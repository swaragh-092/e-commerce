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

    it('inherits default provider when shipping rule has no provider explicitly assigned', async () => {
        const mockDefaultProvider = {
            id: 'mock-provider-id',
            code: 'shiprocket',
            name: 'Shiprocket',
            enabled: true,
            isDefault: true,
            supportsCod: true,
        };

        const mockRule = {
            id: 'mock-rule-id',
            name: 'Standard Flat Rate',
            rateType: 'flat',
            rateConfig: { flatRate: 50 },
            conditions: {},
            codAllowed: true,
            provider: null,
            zone: null,
        };

        const { ShippingRule, Setting } = require('../../src/modules');

        const providerSpy = vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue(mockDefaultProvider);
        const ruleSpy = vi.spyOn(ShippingRule, 'findAll').mockResolvedValue([mockRule]);
        const settingSpy = vi.spyOn(Setting, 'findAll').mockResolvedValue([
            { group: 'shipping', key: 'warehousePincode', value: '560001' },
            { group: 'general', key: 'currency', value: 'INR' },
        ]);

        const result = await ShippingService.testCalculation({
            pincode: '560002',
            subtotal: 500,
            weightGrams: 500,
            paymentMethod: 'prepaid',
        });

        expect(result.decision.serviceable).toBe(true);
        expect(result.decision.providerId).toBe('mock-provider-id');
        expect(result.decision.providerCode).toBe('shiprocket');
        expect(result.decision.ruleId).toBe('mock-rule-id');

        providerSpy.mockRestore();
        ruleSpy.mockRestore();
        settingSpy.mockRestore();
    });
});
