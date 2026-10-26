'use strict';

import { createRequire } from 'node:module';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const axios = require('axios');
const ShiprocketProvider = require('../../src/modules/shipping/providers/shiprocket.provider');
const ShippingService = require('../../src/modules/shipping/shipping.service');
const ShippingWebhookService = require('../../src/modules/shipping/shipping.webhook.service');
const ShippingOperationService = require('../../src/modules/shipping/shippingOperation.service');
const {
    sequelize,
    Shipment,
    Fulfillment,
    ShipmentEvent,
    ShippingOperation,
    ShippingProvider,
    ShippingRule,
    ShippingQuote,
    Product,
    Address,
    Setting,
    Cart,
} = require('../../src/modules');

describe('Shipping System 10 Edge Cases A-to-Z', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(sequelize, 'transaction').mockImplementation(async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
        if (typeof ShiprocketProvider.clearAuthCooldown === 'function') {
            ShiprocketProvider.clearAuthCooldown();
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ─────────────────────────────────────────────────────────────
    // Edge Case 1: Wrong credentials or blocked Shiprocket user
    // ─────────────────────────────────────────────────────────────
    describe('Edge Case 1: Wrong credentials or blocked Shiprocket user', () => {
        it('trips auth failure circuit breaker and prevents repeated login attempts for cooldown period', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'baduser@example.com', password: 'wrongpassword' },
                settings: { mockShiprocket: false },
            });

            // Mock axios.post to return 401 Unauthorized
            const postSpy = vi.spyOn(axios, 'post').mockRejectedValue({
                response: {
                    status: 401,
                    data: { message: 'The credentials supplied were invalid' },
                },
            });

            // First attempt should fail and trigger circuit breaker
            await expect(provider._getToken()).rejects.toThrow(/Shiprocket authentication error/);
            expect(postSpy).toHaveBeenCalledTimes(1);

            // Second attempt immediately following should be blocked by circuit breaker WITHOUT calling remote API
            await expect(provider._getToken()).rejects.toThrow(/Shiprocket login suspended|cooldown active/i);
            expect(postSpy).toHaveBeenCalledTimes(1);

            // Clearing cooldown allows retry
            ShiprocketProvider.clearAuthCooldown();
            await expect(provider._getToken()).rejects.toThrow(/Shiprocket authentication error/);
            expect(postSpy).toHaveBeenCalledTimes(2);
        });

        it('testConnection returns structured configuration error when credentials are bad', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'baduser@example.com', password: 'wrongpassword' },
                settings: { mockShiprocket: false },
            });

            vi.spyOn(axios, 'post').mockRejectedValue({
                response: {
                    status: 401,
                    data: { message: 'Invalid credentials' },
                },
            });

            const result = await provider.testConnection();
            expect(result.success).toBe(false);
            expect(result.message).toContain('Shiprocket connection failed');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // Edge Case 2: Single dispatch warehouse pincode
    // ─────────────────────────────────────────────────────────────
    describe('Edge Case 2: Unified single dispatch warehouse pincode', () => {
        it('uses single warehouse pincode across zone detection and rates', async () => {
            const mockDefaultProvider = {
                id: 'prov-sr-1',
                code: 'shiprocket',
                name: 'Shiprocket',
                enabled: true,
                isDefault: true,
                supportsCod: true,
                settings: { pickupPincode: '560001', pickupLocationName: 'Primary Warehouse' },
            };

            vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue(mockDefaultProvider);
            vi.spyOn(ShippingRule, 'findAll').mockResolvedValue([]);
            vi.spyOn(Setting, 'findAll').mockResolvedValue([
                { group: 'shipping', key: 'warehousePincode', value: '560001' },
                { group: 'general', key: 'currency', value: 'INR' },
            ]);

            const testResult = await ShippingService.testCalculation({
                pincode: '560002', // Same city (Bengaluru)
                subtotal: 1000,
                weightGrams: 500,
                paymentMethod: 'prepaid',
            });

            expect(testResult.decision.serviceable).toBe(true);
            expect(testResult.zone).toBe('same_city');
        });

        it('resolves consistent dispatch origin across checkout and fulfillment even if settings differ', async () => {
            const providerWithPickup = {
                id: 'prov-1',
                settings: { pickupPincode: '560001', pickupLocationName: 'Bangalore Hub' },
            };
            const settingsWithDifferentWarehouse = {
                'shipping.warehousePincode': '110001',
            };

            // Provider's configured pickup location takes precedence for that provider across both checkout and fulfillment
            const origin = await ShippingService.resolveDispatchOrigin(providerWithPickup, settingsWithDifferentWarehouse);
            expect(origin.pincode).toBe('560001');
            expect(origin.pickupLocationName).toBe('Bangalore Hub');

            // When provider does not configure a pickup pincode, falls back to general warehouse pincode
            const providerWithoutPickup = {
                id: 'prov-2',
                settings: {},
            };
            const fallbackOrigin = await ShippingService.resolveDispatchOrigin(providerWithoutPickup, settingsWithDifferentWarehouse);
            expect(fallbackOrigin.pincode).toBe('110001');
        });

        it('ensures shippingOperation fulfillment passes matching pickup location to adapter', async () => {
            const mockProvider = {
                id: 'prov-sr-1',
                code: 'shiprocket',
                name: 'Shiprocket',
                enabled: true,
                settings: { pickupPincode: '560001', pickupLocationName: 'Saved Warehouse' },
            };
            const mockOp = {
                id: 'op-pickup-1',
                providerId: 'prov-sr-1',
                shipmentId: 'ship-1',
                attempts: 0,
                maxAttempts: 8,
                requestPayload: {
                    order: { orderNumber: 'ORD-PICKUP', paymentMethod: 'prepaid', subtotal: 125 },
                    shipment: { actualWeightGrams: 500, providerRequestId: 'ORD-PICKUP', lengthCm: 10, breadthCm: 8, heightCm: 4 },
                    address: { postalCode: '110001' },
                    items: [],
                },
                get: vi.fn().mockReturnValue({
                    id: 'op-pickup-1',
                    providerId: 'prov-sr-1',
                    shipmentId: 'ship-1',
                    attempts: 0,
                    maxAttempts: 8,
                    requestPayload: {
                        order: { orderNumber: 'ORD-PICKUP', paymentMethod: 'prepaid', subtotal: 125 },
                        shipment: { actualWeightGrams: 500, providerRequestId: 'ORD-PICKUP', lengthCm: 10, breadthCm: 8, heightCm: 4 },
                        address: { postalCode: '110001' },
                        items: [],
                    },
                }),
                update: vi.fn().mockResolvedValue(true),
            };

            vi.spyOn(ShippingOperation, 'findByPk').mockResolvedValue(mockOp);
            vi.spyOn(ShippingOperation, 'update').mockResolvedValue([1]);
            vi.spyOn(Shipment, 'update').mockResolvedValue([1]);
            vi.spyOn(ShippingProvider, 'findByPk').mockResolvedValue(mockProvider);
            vi.spyOn(Setting, 'findAll').mockResolvedValue([]);
            const serviceabilitySpy = vi.spyOn(ShiprocketProvider.prototype, 'getServiceability').mockResolvedValue({ serviceable: true, codAvailable: true });
            vi.spyOn(ShiprocketProvider.prototype, 'checkShipmentExists').mockResolvedValue(null);
            const createShipmentSpy = vi.spyOn(ShiprocketProvider.prototype, 'createShipment').mockResolvedValue({
                awbCode: 'AWB-PICKUP-123',
                providerOrderId: 'PO-123',
                providerShipmentId: 'PS-123',
            });
            vi.spyOn(Shipment, 'findByPk').mockResolvedValue({
                id: 'ship-1',
                update: vi.fn().mockResolvedValue(true),
            });

            await ShippingOperationService.processOperation('op-pickup-1');

            expect(createShipmentSpy).toHaveBeenCalled();
            const calledPayload = createShipmentSpy.mock.calls[0][0];
            expect(calledPayload.shipment.pickupLocationName).toBe('Saved Warehouse');
            expect(calledPayload.shipment.pickupPincode).toBe('560001');
            expect(serviceabilitySpy).toHaveBeenCalledWith(expect.objectContaining({
                declaredValue: 125,
                lengthCm: 10,
                breadthCm: 8,
                heightCm: 4,
            }));
        });
    });

    // ─────────────────────────────────────────────────────────────
    // Edge Case 3: Invalid or unsupported customer pincode
    // ─────────────────────────────────────────────────────────────
    describe('Edge Case 3: Invalid or unsupported customer pincode', () => {
        it('rejects malformed or non-6-digit pincode with clear unserviceable status', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { pickupPincode: '560001' },
            });

            // 4 digits (invalid for India)
            const result4 = await provider.getServiceability({
                pickupPincode: '560001',
                pincode: '1234',
                weightGrams: 500,
            });
            expect(result4.serviceable).toBe(false);
            expect(result4.reason).toContain('Invalid delivery pincode format (must be 6 digits)');

            // Letters in pincode
            const resultAlpha = await provider.getServiceability({
                pickupPincode: '560001',
                pincode: '5600AB',
                weightGrams: 500,
            });
            expect(resultAlpha.serviceable).toBe(false);
            expect(resultAlpha.reason).toContain('Invalid delivery pincode format (must be 6 digits)');
        });

        it('handles carrier 404/422 as graceful unserviceable instead of hard crash', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });

            vi.spyOn(provider, '_getToken').mockResolvedValue('mock-token');
            vi.spyOn(provider, '_request').mockRejectedValue({
                response: {
                    status: 404,
                    data: { message: 'Pincode not serviceable' },
                },
            });

            const result = await provider.getServiceability({
                pickupPincode: '560001',
                pincode: '799999',
                weightGrams: 1000,
            });

            expect(result.serviceable).toBe(false);
            expect(result.reason).toContain('Pincode not serviceable');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // Edge Case 4: COD unavailable but prepaid available
    // ─────────────────────────────────────────────────────────────
    describe('Edge Case 4: COD unavailable but prepaid fallback', () => {
        it('falls back to check prepaid when COD returns 0 couriers and offers prepaid delivery', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });

            vi.spyOn(provider, '_getToken').mockResolvedValue('mock-token');

            // Mock _request: first call with cod=1 returns empty couriers; second call with cod=0 returns couriers
            vi.spyOn(provider, '_request').mockImplementation(async (config) => {
                if (config?.params?.cod === 1) {
                    return {
                        data: {
                            status: 200,
                            data: {
                                available_courier_companies: [],
                            },
                        },
                    };
                }
                return {
                    data: {
                        status: 200,
                        data: {
                            available_courier_companies: [
                                {
                                    courier_company_id: 12,
                                    courier_name: 'BlueDart Air Prepaid',
                                    rate: 95,
                                    etd: '3 days',
                                    estimated_delivery_days: 3,
                                    cod: 0,
                                },
                            ],
                        },
                    },
                };
            });

            const result = await provider.getServiceability({
                pickupPincode: '560001',
                pincode: '110001',
                weightGrams: 500,
                paymentMode: 'cod',
            });

            expect(result.serviceable).toBe(true);
            expect(result.codAvailable).toBe(false);
            expect(result.reason.toLowerCase()).toContain('prepaid delivery is available');
        });

        it('strictly rejects COD order submission when codAvailable is false', async () => {
            const quoteWithCodUnavailable = {
                id: 'quote-no-cod',
                cartHash: 'cart-1',
                addressHash: 'addr-1',
                paymentMethod: 'cod',
                couponHash: 'none',
                serviceable: true,
                codAvailable: false,
                expiresAt: new Date(Date.now() + 3600000),
            };

            vi.spyOn(ShippingQuote, 'findOne').mockResolvedValue(quoteWithCodUnavailable);
            vi.spyOn(Product, 'findByPk').mockResolvedValue({
                id: 'prod-1',
                name: 'Item',
                price: 500,
                weightGrams: 500,
            });
            vi.spyOn(Address, 'findOne').mockResolvedValue({
                id: 'addr-1',
                postalCode: '560001',
                state: 'Karnataka',
                country: 'India',
            });
            vi.spyOn(Setting, 'findAll').mockResolvedValue([]);

            await expect(
                ShippingService.validateQuoteForOrder('user-1', {
                    shippingQuoteId: 'quote-no-cod',
                    shippingAddressId: 'addr-1',
                    paymentMethod: 'cod',
                    buyNowItem: { productId: 'prod-1', quantity: 1 },
                })
            ).rejects.toThrow('Cash on delivery is not available for this delivery address or order.');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // Edge Case 5: Missing weight or dimensions & packaging tare
    // ─────────────────────────────────────────────────────────────
    describe('Edge Case 5: Missing weight/dimensions and packaging tare', () => {
        it('computes package dimensions including packaging tare weight', () => {
            const items = [
                {
                    product: { weightGrams: 400, lengthCm: 15, breadthCm: 10, heightCm: 5 },
                    quantity: 2,
                },
            ];

            // 2 items * 400g = 800g + 150g packaging tare = 950g
            const dims = ShippingService.computePackageDimensions(items, 150);
            expect(dims.totalWeightGrams).toBe(950);
            expect(dims.maxL).toBe(15);
            expect(dims.maxB).toBe(10);
            expect(dims.totalH).toBe(10); // 5 * 2
        });

        it('provides safe fallback dimensions and tare when product measurements are missing in non-strict mode', () => {
            const items = [
                {
                    product: { weightGrams: null, lengthCm: null },
                    quantity: 1,
                },
            ];

            const dims = ShippingService.computePackageDimensions(items, 100, { strict: false });
            expect(dims.totalWeightGrams).toBe(600); // 500g default + 100g tare
            expect(dims.maxL).toBe(10);
            expect(dims.maxB).toBe(10);
            expect(dims.totalH).toBe(10);
            expect(dims.hasMissingMeasurements).toBe(true);
        });

        it('enforces physical measurements in strict mode and rejects silent defaults', () => {
            const items = [
                {
                    product: { id: 'prod-no-dims', name: 'Shoes', requiresShipping: true, weightGrams: null },
                    quantity: 1,
                },
            ];

            expect(() => {
                ShippingService.computePackageDimensions(items, 0, { strict: true });
            }).toThrow(/Shipping is temporarily unavailable for this item/i);
        });

        it('createShipment refuses to create carrier shipment if product measurements are missing', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });

            await expect(provider.createShipment({
                order: { orderNumber: 'ORD-NO-DIMS', createdAt: new Date() },
                shipment: { hasMissingMeasurements: true, actualWeightGrams: 500 },
                address: {
                    fullName: 'Customer',
                    addressLine1: 'Line 1',
                    city: 'City',
                    state: 'State',
                    postalCode: '560001',
                    phone: '9876543210',
                },
                items: [{ title: 'Item 1', quantity: 1, unitPrice: 100 }],
            })).rejects.toThrow('Valid parcel weight and dimensions are required');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // Edge Case 6: Heavy or oversized parcels
    // ─────────────────────────────────────────────────────────────
    describe('Edge Case 6: Heavy or oversized parcels', () => {
        it('rejects parcels exceeding max weight or dimension limits with clear explanation', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                record: { maxWeightKg: 20, maxLengthCm: 150 },
            });

            // 25 kg parcel (limit is 20 kg)
            const resultHeavy = await provider.getServiceability({
                pickupPincode: '560001',
                pincode: '110001',
                weightGrams: 25000,
            });
            expect(resultHeavy.serviceable).toBe(false);
            expect(resultHeavy.reason).toContain('exceeds courier maximum limit');

            // 180 cm length (limit is 150 cm)
            const resultLong = await provider.getServiceability({
                pickupPincode: '560001',
                pincode: '110001',
                weightGrams: 5000,
                lengthCm: 180,
                breadthCm: 20,
                heightCm: 20,
            });
            expect(resultLong.serviceable).toBe(false);
            expect(resultLong.reason).toContain('exceed courier maximum allowed size');
        });

        it('testCalculation simulator blocks parcels exceeding courier max weight', async () => {
            vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue({
                id: 'prov-sr-1',
                code: 'shiprocket',
                name: 'Shiprocket',
                enabled: true,
                isDefault: true,
                maxWeightKg: 20,
            });
            vi.spyOn(ShippingRule, 'findAll').mockResolvedValue([]);
            vi.spyOn(Setting, 'findAll').mockResolvedValue([
                { group: 'shipping', key: 'warehousePincode', value: '560001' },
            ]);

            const result = await ShippingService.testCalculation({
                pincode: '560002',
                subtotal: 1000,
                weightGrams: 25000,
            });

            expect(result.decision.serviceable).toBe(false);
            expect(result.decision.message).toContain('exceeds courier maximum limit');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // Edge Case 7: Overlapping rules & domestic area guard
    // ─────────────────────────────────────────────────────────────
    describe('Edge Case 7: Overlapping rules and domestic area guard', () => {
        it('blocks delivery outside domestic territory with clear area guard message', async () => {
            vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue({
                id: 'prov-sr-1',
                code: 'shiprocket',
                name: 'Shiprocket',
                enabled: true,
                isDefault: true,
            });
            vi.spyOn(ShippingRule, 'findAll').mockResolvedValue([]);
            vi.spyOn(Setting, 'findAll').mockResolvedValue([
                { group: 'shipping', key: 'warehousePincode', value: '560001' },
            ]);

            const result = await ShippingService.testCalculation({
                pincode: '10001',
                country: 'United States',
                subtotal: 1000,
                weightGrams: 500,
            });

            expect(result.decision.serviceable).toBe(false);
            expect(result.decision.message).toContain('Delivery is currently only available within India');
        });

        it('domestic area guard blocks non-Indian addresses even if a universal rule with no zone exists', async () => {
            const universalRule = {
                id: 'rule-universal',
                name: 'Universal Free Shipping',
                priority: 100,
                rateType: 'free',
                rateConfig: {},
                conditions: {},
                codAllowed: true,
                provider: null,
                zone: null,
            };

            vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue({
                id: 'prov-sr-1',
                code: 'shiprocket',
                name: 'Shiprocket',
                enabled: true,
                isDefault: true,
            });
            vi.spyOn(ShippingRule, 'findAll').mockResolvedValue([universalRule]);
            vi.spyOn(Setting, 'findAll').mockResolvedValue([
                { group: 'shipping', key: 'warehousePincode', value: '560001' },
            ]);

            const result = await ShippingService.testCalculation({
                pincode: '10001',
                country: 'United States',
                subtotal: 2000,
                weightGrams: 500,
            });

            expect(result.decision.serviceable).toBe(false);
            expect(result.decision.message).toContain('Delivery is currently only available within India');
        });

        it('selects higher priority rule when multiple rules match', async () => {
            const highPriorityRule = {
                id: 'rule-high',
                name: 'Express Rule',
                priority: 200,
                rateType: 'flat',
                rateConfig: { flatRate: 150 },
                conditions: {},
                codAllowed: true,
                provider: null,
                zone: null,
            };
            const lowPriorityRule = {
                id: 'rule-low',
                name: 'Standard Rule',
                priority: 50,
                rateType: 'flat',
                rateConfig: { flatRate: 50 },
                conditions: {},
                codAllowed: true,
                provider: null,
                zone: null,
            };

            vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue({
                id: 'prov-sr-1',
                code: 'shiprocket',
                enabled: true,
                isDefault: true,
            });
            vi.spyOn(ShippingRule, 'findAll').mockResolvedValue([highPriorityRule, lowPriorityRule]);
            vi.spyOn(Setting, 'findAll').mockResolvedValue([
                { group: 'shipping', key: 'warehousePincode', value: '560001' },
            ]);

            const result = await ShippingService.testCalculation({
                pincode: '560002',
                subtotal: 500,
                weightGrams: 500,
            });

            expect(result.decision.ruleId).toBe('rule-high');
            expect(result.decision.shippingCost).toBe(150);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // Edge Case 8: Cart/address changes or expired quote
    // ─────────────────────────────────────────────────────────────
    describe('Edge Case 8: Cart/address changes and stale quote validation', () => {
        it('throws SHIPPING_QUOTE_STALE when cart, address, or payment method hashes drift', async () => {
            const staleQuote = {
                id: 'quote-123',
                cartHash: 'original-cart-hash',
                addressHash: 'original-address-hash',
                paymentMethod: 'prepaid',
                couponHash: 'none',
                serviceable: true,
                expiresAt: new Date(Date.now() + 3600000),
            };

            vi.spyOn(ShippingQuote, 'findOne').mockResolvedValue(staleQuote);
            vi.spyOn(Product, 'findByPk').mockResolvedValue({
                id: 'prod-1',
                name: 'Product 1',
                price: 500,
                weightGrams: 500,
                lengthCm: 10,
                breadthCm: 10,
                heightCm: 10,
                categories: [],
                brand: null,
            });
            vi.spyOn(Address, 'findOne').mockResolvedValue({
                id: 'addr-1',
                postalCode: '560001',
                state: 'Karnataka',
                country: 'India',
            });
            vi.spyOn(Setting, 'findAll').mockResolvedValue([
                { group: 'shipping', key: 'packageProfiles', value: [{ id: 'test-box', name: 'Test Box', lengthCm: 30, breadthCm: 30, heightCm: 30, emptyWeightGrams: 50, maxItems: 10, maxContentsWeightGrams: 5000 }] },
                { group: 'shipping', key: 'volumetricDivisor', value: 5000 },
            ]);

            await expect(
                ShippingService.validateQuoteForOrder('user-1', {
                    shippingQuoteId: 'quote-123',
                    shippingAddressId: 'addr-1',
                    paymentMethod: 'prepaid',
                    buyNowItem: { productId: 'prod-1', quantity: 2 },
                })
            ).rejects.toThrow(/Shipping quote no longer matches your cart or address/);
        });
    });

    // ─────────────────────────────────────────────────────────────
    // Edge Case 9: Carrier timeout during shipment & reconciliation
    // ─────────────────────────────────────────────────────────────
    describe('Edge Case 9: Carrier timeout, recovery lookup, and duplicate prevention', () => {
        it('performs real Shiprocket lookup using /orders?search with reference ID and returns existing AWB', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });

            vi.spyOn(provider, '_getToken').mockResolvedValue('mock-token');

            const requestSpy = vi.spyOn(provider, '_request').mockImplementation(async (opts) => {
                if (opts.url.includes('/orders?search=')) {
                    return {
                        data: {
                            data: [
                                {
                                    id: 998877,
                                    channel_order_id: 'ORD-1001',
                                    shipments: [
                                        {
                                            id: 887766,
                                            awb: 'AWB-EXISTING-REAL-999',
                                            courier_name: 'Delhivery',
                                            label_url: 'https://label.pdf',
                                            pickup_scheduled_date: '2026-09-29',
                                        },
                                    ],
                                },
                            ],
                        },
                    };
                }
                throw new Error(`Unexpected call to ${opts.url}`);
            });

            const shipmentResult = await provider.createShipment({
                order: {
                    orderNumber: 'ORD-1001',
                    createdAt: new Date(),
                },
                shipment: {
                    actualWeightGrams: 500,
                    providerRequestId: 'ORD-1001',
                },
                address: {
                    fullName: 'John Doe',
                    line1: 'MG Road',
                    city: 'Bengaluru',
                    state: 'Karnataka',
                    postalCode: '560001',
                    phone: '9876543210',
                },
                items: [{ title: 'Item 1', sku: 'SKU1', quantity: 1, unitPrice: 500 }],
            });

            expect(requestSpy).toHaveBeenCalledWith(expect.objectContaining({
                method: 'get',
                url: '/orders?search=ORD-1001',
            }));
            expect(shipmentResult.awbCode).toBe('AWB-EXISTING-REAL-999');
            expect(shipmentResult.reconciled).toBe(true);
        });

        it('does not attach another order tracking number when search returns a non-matching order', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });

            vi.spyOn(provider, '_getToken').mockResolvedValue('mock-token');
            vi.spyOn(provider, '_request').mockResolvedValue({
                data: {
                    data: [
                        {
                            id: 998877,
                            channel_order_id: 'DIFFERENT-ORDER-ID',
                            shipments: [
                                {
                                    id: 887766,
                                    awb: 'WRONG-AWB-123',
                                    courier_name: 'Delhivery',
                                },
                            ],
                        },
                    ],
                },
            });

            const recovery = await provider.checkShipmentExists({
                orderNumber: 'EXPECTED-ORDER',
            });

            expect(recovery).toBeNull();
        });

        it.each([undefined, [], [{}]])('rejects recovery without a shipment ID instead of using the order ID (%j)', async (shipments) => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });
            const request = vi.spyOn(provider, '_request').mockResolvedValue({
                data: { data: [{ id: 112233, channel_order_id: 'ORD-NO-SHIPMENT', shipments }] },
            });

            await expect(provider.checkShipmentExists({ orderNumber: 'ORD-NO-SHIPMENT' }))
                .rejects.toThrow('lacks a shipment ID for recovery');
            expect(request).toHaveBeenCalledTimes(1);
            expect(request.mock.calls[0][0].method).toBe('get');
        });

        it('recovers using an explicit shipment_id when the order has no shipments array', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });
            const request = vi.spyOn(provider, '_request').mockResolvedValue({
                data: { data: [{
                    id: 112233,
                    channel_order_id: 'ORD-EXPLICIT-SHIPMENT',
                    shipment_id: 445566,
                    awb_code: 'AWB-EXPLICIT',
                    pickup_scheduled_date: '2026-10-01',
                    label_url: 'https://label.pdf',
                    invoice_url: 'https://invoice.pdf',
                    manifest_url: 'https://manifest.pdf',
                }] },
            });

            const recovered = await provider.checkShipmentExists({ orderNumber: 'ORD-EXPLICIT-SHIPMENT' });
            expect(recovered.providerOrderId).toBe('112233');
            expect(recovered.providerShipmentId).toBe('445566');
            expect(request).toHaveBeenCalledTimes(2);
            expect(request.mock.calls[1][0]).toMatchObject({
                method: 'post',
                url: '/manifests/print',
                data: { order_ids: ['112233'] },
            });
        });

        it('assigns AWB via /courier/assign/awb when order exists on Shiprocket but lacks AWB', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });

            vi.spyOn(provider, '_getToken').mockResolvedValue('mock-token');

            const calls = [];
            vi.spyOn(provider, '_request').mockImplementation(async (opts) => {
                calls.push(opts.url);
                if (opts.url.includes('/orders?search=')) {
                    return {
                        data: {
                            data: [
                                {
                                    id: 112233,
                                    channel_order_id: 'ORD-NO-AWB',
                                    shipments: [
                                        {
                                            id: 445566,
                                            // awb missing
                                        },
                                    ],
                                },
                            ],
                        },
                    };
                }
                if (opts.url === '/courier/assign/awb') {
                    return {
                        data: {
                            awb_code: 'AWB-ASSIGNED-NEW-123',
                            courier_name: 'Blue Dart',
                        },
                    };
                }
                if (opts.url.includes('/courier/generate/')) {
                    return { data: { label_url: 'https://label.pdf' } };
                }
                throw new Error(`Unexpected request: ${opts.url}`);
            });

            const recovery = await provider.checkShipmentExists({
                orderNumber: 'ORD-NO-AWB',
            });

            expect(calls).toContain('/orders?search=ORD-NO-AWB');
            expect(calls).toContain('/courier/assign/awb');
            expect(recovery).not.toBeNull();
            expect(recovery.awbCode).toBe('AWB-ASSIGNED-NEW-123');
            expect(recovery.courierName).toBe('Blue Dart');
            expect(recovery.reconciled).toBe(true);
        });

        it('recovery completes missing pickup and label steps for an order with existing AWB', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });

            vi.spyOn(provider, '_getToken').mockResolvedValue('mock-token');

            const calls = [];
            vi.spyOn(provider, '_request').mockImplementation(async (opts) => {
                calls.push(opts.url);
                if (opts.url.includes('/orders?search=')) {
                    return {
                        data: {
                            data: [
                                {
                                    id: 554433,
                                    channel_order_id: 'ORD-EXISTING-AWB',
                                    shipments: [
                                        {
                                            id: 665544,
                                            awb: 'AWB-EXISTING-123',
                                            courier_name: 'Delhivery',
                                            // label_url missing, pickup missing
                                        },
                                    ],
                                },
                            ],
                        },
                    };
                }
                if (opts.url === '/courier/generate/pickup') {
                    return { data: { response: { pickup_status: 1 } } };
                }
                if (opts.url === '/courier/generate/label') {
                    return { data: { label_url: 'https://label-reconciled.pdf' } };
                }
                throw new Error(`Unexpected call: ${opts.url}`);
            });

            const recovery = await provider.checkShipmentExists({
                orderNumber: 'ORD-EXISTING-AWB',
            });

            expect(calls).toContain('/courier/generate/pickup');
            expect(calls).toContain('/courier/generate/label');
            expect(recovery.awbCode).toBe('AWB-EXISTING-123');
            expect(recovery.label).toBe('https://label-reconciled.pdf');
        });

        it('recovery throws error when pickup generation fails instead of swallowing it', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });

            vi.spyOn(provider, '_getToken').mockResolvedValue('mock-token');

            vi.spyOn(provider, '_request').mockImplementation(async (opts) => {
                if (opts.url.includes('/orders?search=')) {
                    return {
                        data: {
                            data: [
                                {
                                    id: 554433,
                                    channel_order_id: 'ORD-PICKUP-FAIL',
                                    shipments: [
                                        {
                                            id: 665544,
                                            awb: 'AWB-123',
                                            courier_name: 'Delhivery',
                                        },
                                    ],
                                },
                            ],
                        },
                    };
                }
                if (opts.url === '/courier/generate/pickup') {
                    throw new Error('Carrier pickup service unreachable');
                }
                throw new Error(`Unexpected call: ${opts.url}`);
            });

            await expect(provider.checkShipmentExists({
                orderNumber: 'ORD-PICKUP-FAIL',
            })).rejects.toThrow('Carrier pickup service unreachable');
        });

        it('propagates network or auth error during recovery lookup rather than falsely assuming order does not exist', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });

            vi.spyOn(provider, '_getToken').mockResolvedValue('mock-token');
            vi.spyOn(provider, '_request').mockRejectedValue(new Error('ETIMEDOUT'));

            await expect(provider.checkShipmentExists({
                orderNumber: 'ORD-FAIL',
            })).rejects.toThrow('ETIMEDOUT');
        });
    });

    // ─────────────────────────────────────────────────────────────
    // Edge Case 10: Webhooks & Tracking Reconciliation
    // ─────────────────────────────────────────────────────────────
    describe('Edge Case 10: Webhooks, status recording, and tracking reconciliation', () => {
        it('records unknown carrier statuses in lastProviderError and statusHistory', async () => {
            const mockShipment = {
                id: 'ship-1',
                providerId: 'prov-1',
                awb: 'TRK-UNKNOWN-1',
                status: 'in_transit',
                providerState: 'in_transit',
                statusHistory: [],
                update: vi.fn().mockResolvedValue(true),
            };

            const mockProviderRecord = {
                id: 'prov-1',
                code: 'shiprocket',
                enabled: true,
                settings: { webhookSecret: 'secret' },
            };

            vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue(mockProviderRecord);
            vi.spyOn(Shipment, 'findOne').mockResolvedValue(mockShipment);
            vi.spyOn(ShipmentEvent, 'findOne').mockResolvedValue(null);
            vi.spyOn(ShipmentEvent, 'create').mockResolvedValue({ id: 'evt-1' });

            vi.spyOn(ShiprocketProvider.prototype, 'verifyWebhookSignature').mockResolvedValue(true);

            const rawPayload = {
                awb: 'TRK-UNKNOWN-1',
                current_status: 'CUSTOMS_HOLD',
                scan_id: 'SCAN-HOLD-1',
                current_timestamp: '2026-09-29T10:00:00Z',
            };

            const result = await ShippingWebhookService.processWebhook('shiprocket', rawPayload, { 'x-api-key': 'secret' });
            expect(result.accepted).toBe(true);
            expect(mockShipment.update).toHaveBeenCalled();
            const updatePayload = mockShipment.update.mock.calls[0][0];
            expect(updatePayload.lastProviderError).toContain('Unrecognized carrier status: CUSTOMS_HOLD');
        });

        it('correctly maps numeric status 7 and label DELIVERED to delivered in getTracking', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });

            vi.spyOn(provider, '_getToken').mockResolvedValue('mock-token');
            vi.spyOn(provider, '_request').mockResolvedValue({
                data: {
                    tracking_data: {
                        track_status: 1,
                        shipment_status: 7, // Numeric 7
                        shipment_track: [
                            {
                                'sr-status': 7,
                                'sr-status-label': 'DELIVERED',
                                current_status: 'DELIVERED',
                            },
                        ],
                        shipment_track_activities: [
                            {
                                date: '2026-09-29 12:00:00',
                                status: 'DELIVERED',
                                'sr-status': 7,
                                'sr-status-label': 'DELIVERED',
                                activity: 'Delivered to customer',
                                location: 'Mumbai',
                            },
                        ],
                    },
                },
            });

            const tracking = await provider.getTracking({ awbCode: 'AWB-DELIV-777' });
            expect(tracking.status).toBe('delivered');
            expect(tracking.location).toBe('Mumbai');
        });

        it('correctly maps status 38 (Reached Destination Hub) to in_transit and 46 (RTO In Transit) to rto_in_transit', async () => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });

            vi.spyOn(provider, '_getToken').mockResolvedValue('mock-token');

            // 1. Test status 38: Reached Destination Hub -> in_transit
            vi.spyOn(provider, '_request').mockResolvedValueOnce({
                data: {
                    tracking_data: {
                        shipment_status: 38,
                        shipment_track: [{ 'sr-status': 38, 'sr-status-label': 'REACHED DESTINATION HUB' }],
                    },
                },
            });

            const tracking38 = await provider.getTracking({ awbCode: 'AWB-HUB-38' });
            expect(tracking38.status).toBe('in_transit');

            // 2. Test status 46: RTO In Transit -> rto_in_transit
            vi.spyOn(provider, '_request').mockResolvedValueOnce({
                data: {
                    tracking_data: {
                        shipment_status: 46,
                        shipment_track: [{ 'sr-status': 46, 'sr-status-label': 'RTO IN TRANSIT' }],
                    },
                },
            });

            const tracking46 = await provider.getTracking({ awbCode: 'AWB-RTO-46' });
            expect(tracking46.status).toBe('rto_in_transit');
        });

        it.each([
            [13, 'unknown'], [15, 'packed'], [16, 'unknown'], [20, 'unknown'],
            [21, 'delivery_failed'], [22, 'in_transit'], [23, 'unknown'],
            [24, 'delivery_failed'], [25, 'delivery_failed'], [26, 'unknown'],
            [43, 'unknown'], [44, 'delivery_failed'], [45, 'cancelled'],
            [47, 'unknown'], [52, 'created'], [67, 'packed'], [77, 'unknown'],
        ])('maps Shiprocket shipment code %i to %s without falling back to old activity', async (code, expected) => {
            const provider = new ShiprocketProvider({
                credentials: { email: 'admin@test.com', password: 'pass' },
                settings: { mockShiprocket: false },
            });
            vi.spyOn(provider, '_request').mockResolvedValue({
                data: { tracking_data: {
                    shipment_status: code,
                    shipment_track_activities: [{ 'sr-status': 18, status: 'IN TRANSIT' }],
                } },
            });

            expect((await provider.getTracking({ awbCode: 'AWB-STATUS' })).status).toBe(expected);
        });

        it('locks only the shipment row and fetches fulfillment separately during reconciliation', async () => {
            const shipment = {
                id: 'ship-lock-1',
                status: 'in_transit',
                awb: 'AWB-LOCK-1',
                provider: { id: 'prov-1', code: 'shiprocket', settings: {} },
            };
            const freshShipment = {
                id: shipment.id,
                status: 'in_transit',
                fulfillmentId: 'fulfillment-lock-1',
                update: vi.fn().mockResolvedValue(true),
            };
            const fulfillment = { status: 'shipped', update: vi.fn().mockResolvedValue(true) };
            vi.spyOn(Shipment, 'findAll').mockResolvedValue([shipment]);
            const findShipment = vi.spyOn(Shipment, 'findByPk').mockResolvedValue(freshShipment);
            const findFulfillment = vi.spyOn(Fulfillment, 'findByPk').mockResolvedValue(fulfillment);
            vi.spyOn(ShiprocketProvider.prototype, 'getTracking').mockResolvedValue({ status: 'delivered' });

            expect(await ShippingWebhookService.reconcileTracking()).toBe(1);
            const options = findShipment.mock.calls[0][1];
            expect(options).not.toHaveProperty('include');
            expect(options.lock).toEqual({ level: 'UPDATE', of: Shipment });
            expect(findFulfillment).toHaveBeenCalledWith('fulfillment-lock-1', { transaction: options.transaction });
            expect(fulfillment.update).toHaveBeenCalledWith({ status: 'delivered' }, { transaction: options.transaction });
        });

        it('generates PostgreSQL shipment-only locking SQL without outer joins', async () => {
            const query = vi.spyOn(sequelize, 'query').mockResolvedValue(null);
            await Shipment.findByPk('00000000-0000-4000-8000-000000000001', {
                transaction: { LOCK: { UPDATE: 'UPDATE' } },
                lock: { level: 'UPDATE', of: Shipment },
            });

            const sql = query.mock.calls[0][0];
            expect(sql).toContain('FOR UPDATE OF "Shipment"');
            expect(sql).not.toMatch(/\bJOIN\b/i);
        });

        it('touches updatedAt on shipments whose tracking status is unchanged to avoid polling starvation', async () => {
            const mockShipmentUnchanged = {
                id: 'ship-unchanged-1',
                awb: 'AWB-SAME-1',
                status: 'in_transit',
                provider: {
                    id: 'prov-1',
                    code: 'shiprocket',
                    settings: { webhookSecret: 'secret' },
                },
                update: vi.fn().mockResolvedValue(true),
            };

            vi.spyOn(Shipment, 'findAll').mockResolvedValue([mockShipmentUnchanged]);
            vi.spyOn(Shipment, 'findByPk').mockResolvedValue(mockShipmentUnchanged);
            vi.spyOn(ShiprocketProvider.prototype, 'getTracking').mockResolvedValue({
                status: 'in_transit', // Same status as shipment
                location: 'Hub',
            });

            const count = await ShippingWebhookService.reconcileTracking({ limit: 10 });
            expect(count).toBe(0); // Status didn't change
            // But updatedAt must be touched so other shipments are not starved
            expect(mockShipmentUnchanged.update).toHaveBeenCalledWith(expect.objectContaining({
                updatedAt: expect.any(Date),
            }), expect.any(Object));
        });

        it('does not overwrite newer webhook delivered status when carrier polling returns older in_transit status', async () => {
            const initialPolledShipment = {
                id: 'ship-race-1',
                awb: 'AWB-RACE-1',
                status: 'in_transit', // Status loaded before the carrier API call
                provider: {
                    id: 'prov-1',
                    code: 'shiprocket',
                    settings: { webhookSecret: 'secret' },
                },
            };

            // By the time the transaction acquires the row lock, a webhook updated status to delivered
            const freshShipmentFromDb = {
                id: 'ship-race-1',
                awb: 'AWB-RACE-1',
                status: 'delivered', // Webhook delivered arrived during carrier call!
                orderId: 'ord-race-1',
                fulfillment: { status: 'delivered', update: vi.fn() },
                update: vi.fn().mockResolvedValue(true),
            };

            vi.spyOn(Shipment, 'findAll').mockResolvedValue([initialPolledShipment]);
            vi.spyOn(Shipment, 'findByPk').mockResolvedValue(freshShipmentFromDb);
            vi.spyOn(ShiprocketProvider.prototype, 'getTracking').mockResolvedValue({
                status: 'in_transit', // Stale carrier status
                location: 'Regional Hub',
            });

            const count = await ShippingWebhookService.reconcileTracking({ limit: 10 });
            expect(count).toBe(0); // Regressive update rejected, count is 0

            // Verify status was NOT changed back to in_transit
            expect(freshShipmentFromDb.update).toHaveBeenCalledWith(expect.objectContaining({
                updatedAt: expect.any(Date),
                rawResponse: expect.objectContaining({
                    lastPolledStatus: 'in_transit',
                }),
            }), expect.any(Object));
            expect(freshShipmentFromDb.update).not.toHaveBeenCalledWith(expect.objectContaining({
                status: 'in_transit',
            }), expect.any(Object));
            expect(freshShipmentFromDb.fulfillment.update).not.toHaveBeenCalled();
        });
    });

    // ─────────────────────────────────────────────────────────────
    // Edge Case 11: Manual Retry state guard and concurrency lock
    // ─────────────────────────────────────────────────────────────
    describe('Manual Retry State Guard & Concurrency Lock', () => {
        it('rejects retrying a cancelled shipment even when its booking operation failed', async () => {
            const operation = { id: 'op-cancelled', shipmentId: 'ship-cancelled', status: 'failed', update: vi.fn() };
            vi.spyOn(ShippingOperation, 'findByPk').mockResolvedValue(operation);
            vi.spyOn(Shipment, 'findByPk').mockResolvedValue({ status: 'cancelled', providerState: 'cancelled' });
            const processSpy = vi.spyOn(ShippingOperationService, 'processOperation');
            await expect(ShippingOperationService.retryOperation(operation.id)).rejects.toThrow('Cancelled or missing shipments');
            expect(operation.update).not.toHaveBeenCalled();
            expect(processSpy).not.toHaveBeenCalled();
        });
        it('refuses to retry an operation that is already completed', async () => {
            const mockCompletedOp = {
                id: 'op-comp-1',
                status: 'completed',
            };
            vi.spyOn(ShippingOperation, 'findByPk').mockResolvedValue(mockCompletedOp);

            await expect(ShippingOperationService.retryOperation('op-comp-1'))
                .rejects.toThrow('Completed shipping operations cannot be retried');
        });

        it('refuses to retry an operation that is actively processing', async () => {
            const mockProcessingOp = {
                id: 'op-proc-1',
                status: 'processing',
                lockedAt: new Date(), // Active lock
            };
            vi.spyOn(ShippingOperation, 'findByPk').mockResolvedValue(mockProcessingOp);

            await expect(ShippingOperationService.retryOperation('op-proc-1'))
                .rejects.toThrow('Shipping operation is currently processing');
        });

        it('allows retrying a failed operation and resets status to queued under lock', async () => {
            const mockFailedOp = {
                id: 'op-fail-1',
                status: 'failed',
                shipmentId: 'ship-retry-1',
                attempts: 8,
                maxAttempts: 8,
                requestPayload: { shipment: { providerRequestId: 'stable-1', lengthCm: 99 }, order: { subtotal: 125 } },
                update: vi.fn().mockResolvedValue(true),
            };
            vi.spyOn(ShippingOperation, 'findByPk').mockResolvedValue(mockFailedOp);
            vi.spyOn(Shipment, 'findByPk').mockResolvedValue({ status: 'created', actualWeightGrams: 200, lengthCm: 10, breadthCm: 8, heightCm: 4 });
            vi.spyOn(ShippingOperationService, 'processOperation').mockResolvedValue({ success: true });

            const result = await ShippingOperationService.retryOperation('op-fail-1');
            expect(mockFailedOp.update).toHaveBeenCalledWith(expect.objectContaining({
                status: 'queued',
                maxAttempts: 16,
                requestPayload: expect.objectContaining({ shipment: expect.objectContaining({ providerRequestId: 'stable-1', lengthCm: 10, actualWeightGrams: 200 }) }),
            }), expect.any(Object));
            expect(mockFailedOp.update.mock.calls[0][0]).not.toHaveProperty('attempts');
            expect(result.success).toBe(true);
        });
    });
});
