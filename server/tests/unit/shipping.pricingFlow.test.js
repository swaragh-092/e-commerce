import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { Op } = require('sequelize');
const { Product, Address, Setting, ShippingProvider, ShippingRule, ShippingQuote } = require('../../src/modules');
const ShippingService = require('../../src/modules/shipping/shipping.service');
const ShiprocketProvider = require('../../src/modules/shipping/providers/shiprocket.provider');

describe('Customer delivery policies through quote creation and order validation', () => {
    let settings;
    let rules;
    let savedQuote;
    let carrier;
    const payload = {
        shippingAddressId: 'address-1', checkoutSessionId: 'checkout-1', paymentMethod: 'razorpay',
        buyNowItem: { productId: 'product-1', quantity: 1 },
    };
    const flatRule = {
        id: 'rule-1', name: 'Regional fee', rateType: 'flat', rateConfig: { amount: 70 },
        conditions: {}, zone: null, provider: null, codAllowed: true,
    };

    beforeEach(() => {
        savedQuote = null;
        rules = [flatRule];
        settings = {
            'shipping.pricingMode': 'standard', 'shipping.method': 'flat_rate', 'shipping.flatRate': 50,
            'shipping.freeThreshold': 1000, 'shipping.warehousePincode': '400001',
            'general.currency': 'INR', 'tax.originState': 'Maharashtra',
            'tax.enableCGST': true, 'tax.enableSGST': true, 'tax.enableIGST': true,
            'tax.cgstRate': 0.09, 'tax.sgstRate': 0.09, 'tax.igstRate': 0.18,
            'shipping.packageProfiles': [{ id: 'test-box', name: 'Test Box', lengthCm: 20, breadthCm: 20, heightCm: 20, emptyWeightGrams: 50, maxItems: 10, maxContentsWeightGrams: 5000 }],
        };
        const provider = { id: 'provider-1', code: 'shiprocket', name: 'Shiprocket', enabled: true, supportsCod: true, settings: {} };
        vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue(provider);
        vi.spyOn(ShippingProvider, 'findByPk').mockResolvedValue(provider);
        vi.spyOn(ShippingRule, 'findAll').mockImplementation(async () => rules);
        // Respect the queried groups so a quote hash built from different settings cannot pass by accident.
        vi.spyOn(Setting, 'findAll').mockImplementation(async ({ where }) => Object.entries(settings)
            .map(([name, value]) => { const [group, key] = name.split('.'); return { group, key, value }; })
            .filter(({ group }) => where.group[Op.in].includes(group)));
        vi.spyOn(Product, 'findByPk').mockResolvedValue({
            id: 'product-1', name: 'Product', price: 1000, requiresShipping: true,
            weightGrams: 100, lengthCm: 10, breadthCm: 10, heightCm: 10,
        });
        vi.spyOn(Address, 'findOne').mockResolvedValue({
            id: 'address-1', fullName: 'Customer', addressLine1: 'Street', city: 'Mumbai',
            state: 'Maharashtra', postalCode: '400002', country: 'India',
        });
        vi.spyOn(ShippingQuote, 'findOne').mockImplementation(async ({ where }) => where.id ? savedQuote : null);
        vi.spyOn(ShippingQuote, 'create').mockImplementation(async (values) => {
            savedQuote = { id: 'quote-1', ...values };
            return savedQuote;
        });
        carrier = vi.spyOn(ShiprocketProvider.prototype, 'getServiceability').mockResolvedValue({
            serviceable: true, codAvailable: true, rate: 120, estimatedDeliveryDays: 3,
        });
    });
    afterEach(() => vi.restoreAllMocks());

    it.each([['standard', 50, 9], ['rules', 70, 12.6], ['carrier', 120, 21.6]])(
        '%s keeps its own customer fee and accepts the fresh quote at order validation', async (mode, fee, tax) => {
            settings['shipping.pricingMode'] = mode;
            const quote = await ShippingService.createQuote('user-1', payload);
            expect(quote).toMatchObject({ serviceable: true, shippingCost: fee, taxAmount: tax, pricingSource: mode });
            expect(carrier).toHaveBeenCalledWith(expect.objectContaining({ pickupPincode: '400001', pincode: '400002' }));
            const validated = await ShippingService.validateQuoteForOrder('user-1', { ...payload, shippingQuoteId: quote.quoteId });
            expect(validated).toMatchObject({ shippingCost: fee, taxAmount: tax });
        });

    it.each([['flat_rate', 50], ['free', 0], ['free_above_threshold', 0]])(
        'standard %s ignores a matching advanced rule', async (method, fee) => {
            settings['shipping.method'] = method;
            expect(await ShippingService.createQuote('user-1', payload)).toMatchObject({ shippingCost: fee, pricingSource: 'standard' });
        });

    it('charges the fixed fee below the standard free threshold', async () => {
        settings['shipping.method'] = 'free_above_threshold';
        settings['shipping.freeThreshold'] = 1001;
        expect(await ShippingService.createQuote('user-1', payload)).toMatchObject({ shippingCost: 50 });
    });

    it('blocks advanced rules without a match instead of falling back to the standard fee', async () => {
        settings['shipping.pricingMode'] = 'rules';
        rules = [];
        expect(await ShippingService.createQuote('user-1', payload)).toMatchObject({ serviceable: false, shippingCost: 0 });
        expect(carrier).not.toHaveBeenCalled();
    });

    it.each(['standard', 'rules', 'carrier'])('blocked pincodes win in %s mode', async (mode) => {
        settings['shipping.pricingMode'] = mode;
        settings['shipping.serviceablePincodes'] = '400002';
        settings['shipping.blockedPincodes'] = '400002';
        expect(await ShippingService.createQuote('user-1', payload)).toMatchObject({ serviceable: false, shippingCost: 0, taxAmount: 0 });
        expect(carrier).not.toHaveBeenCalled();
    });

    it.each([null, undefined, '', -1, NaN])('rejects a missing or invalid carrier rate %s', async (rate) => {
        settings['shipping.pricingMode'] = 'carrier';
        carrier.mockResolvedValue({ serviceable: true, codAvailable: true, rate });
        expect(await ShippingService.createQuote('user-1', payload)).toMatchObject({ serviceable: false, shippingCost: 0 });
    });

    it('returns a retryable error when the live carrier check fails', async () => {
        settings['shipping.pricingMode'] = 'carrier';
        carrier.mockRejectedValue(new Error('timeout'));
        await expect(ShippingService.createQuote('user-1', payload)).rejects.toMatchObject({ code: 'SHIPPING_UNAVAILABLE', statusCode: 503 });
    });

    it('blocks physical checkout when no measured package catalog exists', async () => {
        settings['shipping.packageProfiles'] = [];
        await expect(ShippingService.createQuote('user-1', payload)).rejects.toMatchObject({ code: 'SHIPPING_PACKAGE_CATALOG_MISSING' });
    });

    it.each(['shipping.flatRate', 'general.currency', 'tax.cgstRate'])('invalidates a quote when %s changes', async (key) => {
        const quote = await ShippingService.createQuote('user-1', payload);
        settings[key] = key === 'general.currency' ? 'USD' : 99;
        await expect(ShippingService.validateQuoteForOrder('user-1', { ...payload, shippingQuoteId: quote.quoteId }))
            .rejects.toMatchObject({ code: 'SHIPPING_QUOTE_STALE' });
    });
});
