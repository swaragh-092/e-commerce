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

    it('applies storewide allow and block coverage to any provider or rule result', () => {
        const ruleQuote = { serviceable: true, shippingCost: 25, codAvailable: true, providerCode: 'shiprocket' };
        expect(ShippingService.applyStorewidePincodeCoverage(ruleQuote, '560001', {
            allowedPincodes: ['560001', '600001'], blockedPincodes: ['560001'],
        })).toMatchObject({ serviceable: false, shippingCost: 0, codAvailable: false });

        expect(ShippingService.applyStorewidePincodeCoverage(ruleQuote, '500001', {
            allowedPincodes: ['560001', '600001'],
        })).toMatchObject({ serviceable: false, shippingCost: 0, codAvailable: false });

        expect(ShippingService.applyStorewidePincodeCoverage(ruleQuote, '560001', {
            allowedPincodes: ['560001'], blockedPincodes: [],
        })).toBe(ruleQuote);
        expect(ShippingService.applyStorewidePincodeCoverage(ruleQuote, '500001')).toBe(ruleQuote);
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

describe('Unified shipping policy preview', () => {
    const { ShippingRule, Setting } = require('../../src/modules');
    const preview = async (settings, rules = [], pincode = '560002', country = 'India') => {
        vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue({ id: 'default', code: 'manual', name: 'Manual', enabled: true, supportsCod: true });
        vi.spyOn(ShippingRule, 'findAll').mockResolvedValue(rules);
        vi.spyOn(Setting, 'findAll').mockResolvedValue(Object.entries({ warehousePincode: '560001', method: 'flat_rate', flatRate: 5, ...settings }).map(([key, value]) => ({ group: 'shipping', key, value })));
        try {
            return await ShippingService.testCalculation({ pincode, subtotal: 25, weightGrams: 500, country });
        } finally {
            vi.restoreAllMocks();
        }
    };
    const freeRule = { id: 'free', name: 'Free rule', rateType: 'free', rateConfig: {}, conditions: {}, provider: null, zone: null };

    it('charges the selected fixed fee even when a free rule exists', async () => {
        const result = await preview({ pricingMode: 'standard' }, [freeRule]);
        expect(result.decision).toMatchObject({ serviceable: true, shippingCost: 5, pricingSource: 'standard', pricingReason: 'Fixed delivery fee' });
    });

    it('does not silently fall back to fixed pricing when advanced rules have no match', async () => {
        const result = await preview({ pricingMode: 'rules' });
        expect(result.decision).toMatchObject({ serviceable: false, shippingCost: 0, pricingReason: 'No matching shipping rule' });
    });

    it('preserves existing rules-first behavior until a merchant selects a policy', async () => {
        const result = await preview({}, [freeRule]);
        expect(result.decision).toMatchObject({ serviceable: true, shippingCost: 0, pricingMode: 'legacy', ruleId: 'free' });
    });

    it.each(['standard', 'rules'])('enforces storewide blocked pincodes in %s preview', async (pricingMode) => {
        const result = await preview({ pricingMode, serviceablePincodes: '560002', blockedPincodes: '560002' }, [freeRule]);
        expect(result.decision).toMatchObject({ serviceable: false, shippingCost: 0, codAvailable: false });
    });

    it('rejects invalid domestic pincodes even with a matching free rule', async () => {
        const result = await preview({ pricingMode: 'rules' }, [freeRule], '123');
        expect(result.decision.serviceable).toBe(false);
    });
});


describe('Shipping quote policy freshness', () => {
    it.each([undefined, 'previous-policy-hash'])('requires refreshing quotes without the current policy snapshot', async (shippingSettingsHash) => {
        const { ShippingQuote, Setting } = require('../../src/modules');
        vi.spyOn(ShippingQuote, 'findOne').mockResolvedValue({ serviceable: true, expiresAt: new Date(Date.now() + 60000), inputSnapshot: { shippingSettingsHash } });
        vi.spyOn(Setting, 'findAll').mockResolvedValue([{ group: 'shipping', key: 'blockedPincodes', value: '560002' }]);
        try {
            await expect(ShippingService.validateQuoteForOrder('user', { shippingQuoteId: 'quote', paymentMethod: 'razorpay' })).rejects.toMatchObject({ code: 'SHIPPING_QUOTE_STALE' });
        } finally {
            vi.restoreAllMocks();
        }
    });
});

describe('Percent of order shipping rule multi-parcel handling', () => {
    it('applies percent_of_order shipping rate once across multi-parcel orders instead of multiplying per parcel', async () => {
        const { ShippingProvider, ShippingRule, Setting } = require('../../src/modules');
        const percentRule = {
            id: 'pct-rule',
            name: '10 Percent Delivery',
            rateType: 'percent_of_order',
            rateConfig: { percent: 10 },
            conditions: {},
            codAllowed: true,
            provider: null,
            zone: null,
        };

        vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue({ id: 'default', code: 'manual', name: 'Manual', enabled: true, supportsCod: true });
        vi.spyOn(ShippingRule, 'findAll').mockResolvedValue([percentRule]);
        vi.spyOn(Setting, 'findAll').mockResolvedValue([
            { group: 'shipping', key: 'warehousePincode', value: '560001' },
            { group: 'general', key: 'currency', value: 'INR' },
        ]);

        try {
            const decision = await ShippingService.calculateDeliveryDecision({
                subtotal: 1000,
                chargeableWeightGrams: 1000,
                parcelWeightsGrams: [500, 500],
                packageCount: 2,
                zone: 'national',
                addressSnapshot: { postalCode: '560002', country: 'India' },
                paymentMethod: 'razorpay',
            }, {});

            expect(decision.serviceable).toBe(true);
            expect(decision.shippingCost).toBe(100);
            expect(decision.rateBreakdown.freight).toBe(100);
        } finally {
            vi.restoreAllMocks();
        }
    });
});

describe('Advanced shipping rule order and parcel charging', () => {
    const { ShippingRule, Setting } = require('../../src/modules');
    const baseParams = {
        subtotal: 1000,
        chargeableWeightGrams: 1000,
        parcelWeightsGrams: [500, 500],
        packageCount: 2,
        zone: 'national',
        addressSnapshot: { postalCode: '560002', country: 'India' },
        paymentMethod: 'cod',
    };
    const setMocks = (rule) => {
        vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue({ id: 'manual', code: 'manual', name: 'Manual', enabled: true, supportsCod: true });
        vi.spyOn(ShippingRule, 'findAll').mockResolvedValue([rule]);
        vi.spyOn(Setting, 'findAll').mockResolvedValue([{ group: 'general', key: 'currency', value: 'INR' }]);
    };

    it.each([
        [{ rateType: 'percent_of_order', rateConfig: { percent: 10, codFeeType: 'flat', codFeeValue: 40 } }, 140],
        [{ rateType: 'free_above_threshold', rateConfig: { threshold: 2000, amount: 50, codFeeType: 'flat', codFeeValue: 40 } }, 90],
        [{ rateType: 'free_above_threshold', rateConfig: { threshold: 500, amount: 50, codFeeType: 'flat', codFeeValue: 40 } }, 40],
        [{ rateType: 'flat', rateConfig: { flatRate: 50, codFeeType: 'flat', codFeeValue: 40 } }, 90],
    ])('charges order-level freight and COD once for %s', async (config, expectedTotal) => {
        setMocks({ id: 'rule', name: 'Rule', conditions: {}, codAllowed: true, provider: null, zone: null, ...config });
        try {
            const decision = await ShippingService.calculateRuleDecision(baseParams);
            expect(decision.shippingCost).toBe(expectedTotal);
        } finally {
            vi.restoreAllMocks();
        }
    });

    it('matches weight conditions against total parcel chargeable weight', async () => {
        setMocks({ id: 'rule', name: 'Light order', rateType: 'flat', rateConfig: { flatRate: 50 }, conditions: { weightLte: 800 }, codAllowed: true, provider: null, zone: null });
        try {
            const decision = await ShippingService.calculateRuleDecision(baseParams);
            expect(decision).toBeNull();
        } finally {
            vi.restoreAllMocks();
        }
    });

    it('continues to rate per-kg freight per parcel while charging the COD fee once', async () => {
        setMocks({ id: 'rule', name: 'Weight rate', rateType: 'per_kg_slab', rateConfig: { baseCharge: 20, additionalSlabRate: 10, codFeeType: 'flat', codFeeValue: 40 }, conditions: {}, codAllowed: true, provider: null, zone: null });
        try {
            const decision = await ShippingService.calculateRuleDecision(baseParams);
            expect(decision.shippingCost).toBe(80);
            expect(decision.rateBreakdown.codFee).toBe(40);
        } finally {
            vi.restoreAllMocks();
        }
    });
});
