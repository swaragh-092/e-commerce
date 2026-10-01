import { createRequire } from 'node:module';
import { beforeEach, describe, it, expect, vi } from 'vitest';

const require = createRequire(import.meta.url);
const AppError = require('../../src/utils/AppError');
const { resolveProvider } = require('../../src/modules/shipping/providers');
const ShippingService = require('../../src/modules/shipping/shipping.service');
const { decryptCredentials, decryptSecret } = require('../../src/modules/shipping/shipping.crypto');
const ShiprocketProvider = require('../../src/modules/shipping/providers/shiprocket.provider');
const EkartProvider = require('../../src/modules/shipping/providers/ekart.provider');
const ShippingWebhookService = require('../../src/modules/shipping/shipping.webhook.service');
const SettingsService = require('../../src/modules/settings/settings.service');
const TaxService = require('../../src/modules/tax/tax.service');
const OrderService = require('../../src/modules/order/order.service');
const { placeOrderSchema } = require('../../src/modules/order/order.validation');
const CouponService = require('../../src/modules/coupon/coupon.service');
const {
    sequelize,
    ShippingProvider,
    Shipment,
    ShipmentEvent,
    Cart,
    Address,
    Setting,
    Order,
    Fulfillment,
    ShippingQuote,
    ShippingRule,
    Coupon,
    CouponUsage,
} = require('../../src/modules');

describe('Audit Hardening & Verification Suite (11 Findings)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(sequelize, 'transaction').mockImplementation(async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } }));
        if (CouponUsage && typeof CouponUsage.count === 'function') {
            vi.spyOn(CouponUsage, 'count').mockResolvedValue(0);
        }
    });

    describe('1. Admin limits silently dropped', () => {
        it('persists mode, maxWeightKg, and dimension limits in updateProvider allowlist', async () => {
            const mockProvider = {
                id: 'p1',
                name: 'Shiprocket',
                enabled: true,
                isDefault: false,
                update: vi.fn().mockImplementation(async (updates) => Object.assign(mockProvider, updates)),
            };
            vi.spyOn(ShippingProvider, 'findByPk').mockResolvedValue(mockProvider);

            const payload = {
                mode: 'express',
                maxWeightKg: 15,
                maxLengthCm: 50,
                maxBreadthCm: 40,
                maxHeightCm: 30,
                supportsReturns: true,
                supportsReversePickup: true,
                supportsHeavyItems: false,
                supportsFragileItems: true,
                supportedRegions: ['IN-KA', 'IN-MH'],
                blockedRegions: ['IN-JK'],
                unauthorizedField: 'malicious',
            };

            const updated = await ShippingService.updateProvider('p1', payload);
            expect(updated.mode).toBe('express');
            expect(updated.maxWeightKg).toBe(15);
            expect(updated.maxLengthCm).toBe(50);
            expect(updated.maxBreadthCm).toBe(40);
            expect(updated.maxHeightCm).toBe(30);
            expect(updated.supportsReturns).toBe(true);
            expect(updated.supportsReversePickup).toBe(true);
            expect(updated.supportsFragileItems).toBe(true);
            expect(updated.supportedRegions).toEqual(['IN-KA', 'IN-MH']);
            expect(updated.blockedRegions).toEqual(['IN-JK']);
            expect(updated.unauthorizedField).toBeUndefined();
        });
    });

    describe('2. Unknown provider -> manual free shipping', () => {
        it('throws SHIPPING_PROVIDER_NOT_FOUND and does not silently fall back to ManualProvider', () => {
            expect(() => resolveProvider({ code: 'unknown_carrier_xyz' })).toThrowError(
                expect.objectContaining({
                    code: 'SHIPPING_PROVIDER_NOT_FOUND',
                    statusCode: 500,
                })
            );
        });
    });

    describe('3. Carrier price discarded', () => {
        it('propagates carrier live rates, costs, courier info, and estimated days', async () => {
            const liveResponse = {
                serviceable: true,
                codAvailable: true,
                rate: 145.5,
                currency: 'INR',
                courierName: 'Delhivery Surface',
                courierCompanyId: 101,
                estimatedDeliveryDays: 3,
            };

            const initialDecision = {
                serviceable: true,
                codAvailable: true,
                shippingCost: 50,
                estimatedMinDays: 5,
                estimatedMaxDays: 7,
                message: 'Standard rule',
            };

            const updatedDecision = {
                ...initialDecision,
                serviceable: Boolean(initialDecision.serviceable && liveResponse.serviceable),
                codAvailable: Boolean(initialDecision.codAvailable && liveResponse.codAvailable),
                estimatedMinDays: liveResponse.estimatedDeliveryDays ?? initialDecision.estimatedMinDays,
                estimatedMaxDays: liveResponse.estimatedDeliveryDays ?? initialDecision.estimatedMaxDays,
                liveServiceability: {
                    serviceable: liveResponse.serviceable,
                    codAvailable: liveResponse.codAvailable,
                    carrierRate: liveResponse.rate ?? null,
                    carrierCost: liveResponse.rate ?? null,
                    currency: liveResponse.currency || 'INR',
                    estimatedDays: liveResponse.estimatedDeliveryDays ?? null,
                    courierName: liveResponse.courierName ?? null,
                    courierCompanyId: liveResponse.courierCompanyId ?? null,
                },
            };

            expect(updatedDecision.estimatedMinDays).toBe(3);
            expect(updatedDecision.estimatedMaxDays).toBe(3);
            expect(updatedDecision.liveServiceability.carrierRate).toBe(145.5);
            expect(updatedDecision.liveServiceability.courierName).toBe('Delhivery Surface');
        });
    });

    describe('4. All-digital charged', () => {
        it('does not add tare weight or slab to 500g for all-digital items', () => {
            const digitalItems = [
                {
                    product: { id: 'p1', requiresShipping: false, weightGrams: 0, lengthCm: 0, breadthCm: 0, heightCm: 0 },
                    quantity: 2,
                },
            ];

            const pkg = ShippingService.computePackageDimensions(digitalItems, { packagingWeightGrams: 50 });
            expect(pkg.maxL).toBe(0);
            expect(pkg.maxB).toBe(0);
            expect(pkg.totalH).toBe(0);
            expect(pkg.totalWeightGrams).toBe(0);
            expect(pkg.volumeCm3).toBe(0);
            expect(pkg.isAllDigital).toBe(true);

            const chargeableWeight = ShippingService.computeChargeableWeight(pkg);
            expect(chargeableWeight).toBe(0);
        });
    });

    describe('5. Stale quote hash', () => {
        it('detects dimensional and weight changes in cart snapshot', () => {
            const cartItems1 = [
                {
                    productId: 'prod-1',
                    variantId: 'var-1',
                    quantity: 1,
                    currentPrice: 100,
                    weightGrams: 500,
                    lengthCm: 10,
                    breadthCm: 10,
                    heightCm: 10,
                    requiresShipping: true,
                },
            ];
            const cartItems2 = [
                {
                    productId: 'prod-1',
                    variantId: 'var-1',
                    quantity: 1,
                    currentPrice: 100,
                    weightGrams: 800,
                    lengthCm: 10,
                    breadthCm: 10,
                    heightCm: 10,
                    requiresShipping: true,
                },
            ];

            const snapshot1 = ShippingService.buildCartSnapshot(cartItems1);
            const snapshot2 = ShippingService.buildCartSnapshot(cartItems2);
            expect(snapshot1[0].weightGrams).toBe(500);
            expect(snapshot2[0].weightGrams).toBe(800);
            expect(snapshot1).not.toEqual(snapshot2);
        });

        it('allows quote within 60s grace window', async () => {
            const { ShippingQuote } = require('../../src/modules');
            const now = Date.now();
            const mockQuote = {
                id: 'q1',
                userId: 'u1',
                serviceable: true,
                codAvailable: true,
                expiresAt: new Date(now - 30 * 1000),
                inputSnapshot: {
                    cartHash: 'c-hash',
                    addressHash: 'a-hash',
                    shippingSettingsHash: null,
                },
            };
            vi.spyOn(ShippingQuote, 'findOne').mockResolvedValue(mockQuote);

            try {
                await ShippingService.validateQuoteForOrder('u1', {
                    shippingQuoteId: 'q1',
                    paymentMethod: 'razorpay',
                });
            } catch (err) {
                expect(err.code).not.toBe('SHIPPING_QUOTE_EXPIRED');
            }
        });
    });

    describe('6. Guest address IDOR + cart collision', () => {
        it('requires sessionId for guest checkout in placeOrder and rejects when missing', async () => {
            vi.spyOn(SettingsService, 'getFeatures').mockResolvedValue({
                features: { guestCheckout: true },
            });
            vi.spyOn(Setting, 'findAll').mockResolvedValue([
                { group: 'payment', key: 'codEnabled', value: 'true' },
            ]);

            await expect(
                OrderService.placeOrder(null, {
                    paymentMethod: 'cod',
                })
            ).rejects.toMatchObject({
                code: 'VALIDATION_ERROR',
                message: expect.stringContaining('Session ID is required for guest checkout'),
            });
        });

        it('scopes guest address lookup to userId: null preventing guest IDOR', async () => {
            vi.spyOn(SettingsService, 'getFeatures').mockResolvedValue({
                features: { guestCheckout: true },
            });
            vi.spyOn(Setting, 'findAll').mockResolvedValue([
                { group: 'payment', key: 'codEnabled', value: 'true' },
            ]);

            const addressFindSpy = vi.spyOn(Address, 'findOne').mockResolvedValue(null);
            vi.spyOn(Cart, 'findOne').mockResolvedValue({
                items: [{
                    product: { id: 'p1', requiresShipping: true, price: 100, weightGrams: 200 },
                    quantity: 1,
                    price: 100,
                }],
            });

            await expect(
                OrderService.placeOrder(null, {
                    sessionId: 'guest-session-123',
                    shippingAddressId: 'addr-uuid-456',
                    paymentMethod: 'cod',
                })
            ).rejects.toMatchObject({
                code: 'NOT_FOUND',
                message: expect.stringContaining('Shipping address not found'),
            });

            expect(addressFindSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 'addr-uuid-456', userId: null },
                })
            );
        });
    });

    describe('7. Digital checkout blocked', () => {
        it('validates order schema without requiring shippingAddressId', () => {
            const payload = {
                paymentMethod: 'razorpay',
            };
            const { error, value } = placeOrderSchema.validate(payload);
            expect(error).toBeUndefined();
            expect(value.shippingAddressId).toBeUndefined();
        });
    });

    describe('8. Tax intra-state default', () => {
        it('does not treat missing origin as intra-state when destination is present', () => {
            const effectiveTax = {
                useGST: true,
                cgst: 0.09,
                sgst: 0.09,
                igst: 0.18,
                inclusive: false,
            };
            // Origin is missing (''), Destination is 'Karnataka' -> Defaults to inter-state IGST
            const result = TaxService.computeItemTax(effectiveTax, 100, 'Karnataka', '');
            expect(result.igst).toBe(18);
            expect(result.cgst).toBe(0);
            expect(result.sgst).toBe(0);
        });

        it('treats identical origin and destination as intra-state', () => {
            const effectiveTax = {
                useGST: true,
                cgst: 0.09,
                sgst: 0.09,
                igst: 0.18,
                inclusive: false,
            };
            const result = TaxService.computeItemTax(effectiveTax, 100, 'Karnataka', 'Karnataka');
            expect(result.cgst).toBe(9);
            expect(result.sgst).toBe(9);
            expect(result.igst).toBe(0);
        });

        it('treats different states as inter-state', () => {
            const effectiveTax = {
                useGST: true,
                cgst: 0.09,
                sgst: 0.09,
                igst: 0.18,
                inclusive: false,
            };
            const result = TaxService.computeItemTax(effectiveTax, 100, 'Karnataka', 'Maharashtra');
            expect(result.igst).toBe(18);
            expect(result.cgst).toBe(0);
            expect(result.sgst).toBe(0);
        });
    });

    describe('9. Fallback dedupe broken', () => {
        it('returns timestamp: null when carrier webhook payload omits timestamp', async () => {
            const shiprocket = new ShiprocketProvider({
                settings: { webhookHeaderValue: 'test-secret' },
                credentials: {},
            });
            const event1 = await shiprocket.handleWebhook({
                awb: 'AWB12345',
                current_status: 'IN TRANSIT',
            });
            expect(event1.timestamp).toBeNull();

            const ekart = new EkartProvider({
                settings: { webhookHeaderValue: 'test-secret' },
                credentials: {},
            });
            const event2 = await ekart.handleWebhook({
                awb: 'EKART123',
                status: 'out_for_delivery',
            });
            expect(event2.timestamp).toBeNull();
        });
    });

    describe('10. Rank flap + stale insert', () => {
        it('strictly prevents backward status regression from triggering updates or stale events', async () => {
            const mockShipmentRecord = {
                id: 'shipment-1',
                awb: 'SR123456789',
                status: 'delivered',
                statusHistory: [],
                orderId: 'order-1',
                order: { id: 'order-1' },
                fulfillment: { id: 'ful-1', status: 'delivered' },
                update: vi.fn(),
            };

            const mockProviderRecord = {
                id: 'provider-1',
                code: 'shiprocket',
                enabled: true,
                webhookSecret: 'test-secret',
                settings: { webhookHeaderValue: 'test-secret' },
                credentials: {},
            };

            vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue(mockProviderRecord);
            vi.spyOn(Shipment, 'findOne').mockResolvedValue(mockShipmentRecord);
            const createEventSpy = vi.spyOn(ShipmentEvent, 'create').mockResolvedValue({ id: 'evt-1' });

            const result = await ShippingWebhookService.processWebhook('shiprocket', {
                awb: 'SR123456789',
                current_status: 'IN TRANSIT',
                scan_id: 'SCAN-REGRESS',
            }, { 'x-api-key': 'test-secret' });

            expect(result.ignored).toBe(true);
            expect(result.reason).toBe('stale_status');
            expect(createEventSpy).not.toHaveBeenCalled();
            expect(mockShipmentRecord.update).not.toHaveBeenCalled();
        });
    });

    describe('11. Crypto silent fallback', () => {
        it('throws AppError on corrupted credential ciphertext instead of silent empty object', () => {
            const corruptedData = {
                ciphertext: 'corrupted-hex-string',
                iv: '12345678901234567890123456789012',
                tag: '12345678901234567890123456789012',
            };
            expect(() => decryptCredentials(corruptedData)).toThrowError(
                expect.objectContaining({
                    code: 'CREDENTIAL_DECRYPTION_FAILED',
                    statusCode: 500,
                })
            );
        });

        it('throws AppError on corrupted webhook secret ciphertext instead of returning plaintext', () => {
            const corruptedSecret = {
                ciphertext: 'corrupted-hex-string',
                iv: '12345678901234567890123456789012',
                tag: '12345678901234567890123456789012',
            };
            expect(() => decryptSecret(corruptedSecret)).toThrowError(
                expect.objectContaining({
                    code: 'SECRET_DECRYPTION_FAILED',
                    statusCode: 500,
                })
            );
        });
    });

    describe('12. Recheck coverage before accepting an existing quote', () => {
        it('rejects an existing quote when destination pincode is newly blocked in store settings', async () => {
            const foundQuote = {
                id: 'quote-active-1',
                userId: 'user-1',
                serviceable: true,
                codAvailable: true,
                shippingCost: 50,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000),
                cartHash: 'cart-hash-1',
                addressHash: 'addr-hash-1',
                paymentMethod: 'razorpay',
                couponHash: 'coupon-hash-1',
                inputSnapshot: {
                    shippingSettingsHash: 'prev-settings-hash',
                    coverageHash: 'prev-coverage-hash',
                },
            };

            vi.spyOn(ShippingQuote, 'findOne').mockResolvedValue(foundQuote);
            vi.spyOn(Setting, 'findAll').mockResolvedValue([
                { group: 'shipping', key: 'serviceablePincodes', value: '' },
                { group: 'shipping', key: 'blockedPincodes', value: '560002' },
            ]);
            vi.spyOn(Address, 'findOne').mockResolvedValue({
                id: 'addr-1',
                postalCode: '560002',
                country: 'India',
                state: 'Karnataka',
                fullName: 'Test User',
                toJSON: () => ({ id: 'addr-1', postalCode: '560002', country: 'India', state: 'Karnataka' }),
            });
            vi.spyOn(Cart, 'findOne').mockResolvedValue({
                items: [{
                    productId: 'prod-1',
                    quantity: 1,
                    product: { id: 'prod-1', name: 'Shirt', weightGrams: 200, requiresShipping: true },
                }],
            });

            await expect(ShippingService.validateQuoteForOrder('user-1', {
                shippingQuoteId: 'quote-active-1',
                shippingAddressId: 'addr-1',
                paymentMethod: 'razorpay',
            })).rejects.toThrow();
        });
    });

    describe('13. Apply storewide coverage in admin test path', () => {
        it('reports destination as unserviceable when pincode is blocked, even if rule would match', async () => {
            vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue({
                id: 'prov-1',
                code: 'manual',
                name: 'Standard Courier',
                enabled: true,
                isDefault: true,
            });
            vi.spyOn(ShippingRule, 'findAll').mockResolvedValue([]);
            vi.spyOn(Setting, 'findAll').mockResolvedValue([
                { group: 'shipping', key: 'warehousePincode', value: '560001' },
                { group: 'shipping', key: 'blockedPincodes', value: '560099' },
            ]);

            const result = await ShippingService.testCalculation({
                pincode: '560099',
                subtotal: 1500,
                weightGrams: 500,
            });

            expect(result.decision.serviceable).toBe(false);
            expect(result.decision.message).toContain('unavailable to this pincode');
        });
    });

    describe('14. Resolve free-shipping coupons with the quoted cost', () => {
        it('preserves freeShipping flag and eliminates shippingCost when resolved against quoted shipping', async () => {
            const freeShippingCoupon = {
                id: 'coup-fs-1',
                code: 'FREESHIP',
                name: 'Free Delivery',
                type: 'free_shipping',
                value: 0,
                isActive: true,
                campaignStatus: 'active',
                applicableTo: 'all',
                minOrderAmount: 0,
                perUserLimit: 10,
                toJSON: () => ({
                    id: 'coup-fs-1',
                    code: 'FREESHIP',
                    name: 'Free Delivery',
                    type: 'free_shipping',
                    value: 0,
                    isActive: true,
                    campaignStatus: 'active',
                    applicableTo: 'all',
                    minOrderAmount: 0,
                    perUserLimit: 10,
                }),
            };

            vi.spyOn(SettingsService, 'getFeatures').mockResolvedValue({ features: { coupons: true } });
            vi.spyOn(Coupon, 'findOne').mockResolvedValue(freeShippingCoupon);
            vi.spyOn(Coupon, 'findAll').mockResolvedValue([]);
            vi.spyOn(Setting, 'findOne').mockResolvedValue({ value: 'true' });

            const resolved = await CouponService.resolveCoupons(['FREESHIP'], 'user-1', {
                cartSubtotal: 500,
                cartItems: [{ lineSubtotal: 500 }],
                shippingCost: 80,
            });

            expect(resolved.freeShipping).toBe(true);
            expect(resolved.shippingDiscount).toBe(80);
            expect(resolved.totalDiscount).toBe(80);
        });

        it('retains freeShipping true even if initial evaluation was performed with shippingCost: 0', async () => {
            const freeShippingCoupon = {
                id: 'coup-fs-2',
                code: 'FREEZERO',
                name: 'Free Zero',
                type: 'free_shipping',
                value: 0,
                isActive: true,
                campaignStatus: 'active',
                applicableTo: 'all',
                minOrderAmount: 0,
                perUserLimit: 10,
                toJSON: () => ({
                    id: 'coup-fs-2',
                    code: 'FREEZERO',
                    name: 'Free Zero',
                    type: 'free_shipping',
                    value: 0,
                    isActive: true,
                    campaignStatus: 'active',
                    applicableTo: 'all',
                    minOrderAmount: 0,
                    perUserLimit: 10,
                }),
            };

            vi.spyOn(SettingsService, 'getFeatures').mockResolvedValue({ features: { coupons: true } });
            vi.spyOn(Coupon, 'findOne').mockResolvedValue(freeShippingCoupon);
            vi.spyOn(Coupon, 'findAll').mockResolvedValue([]);
            vi.spyOn(Setting, 'findOne').mockResolvedValue({ value: 'true' });

            const resolvedWithZero = await CouponService.resolveCoupons(['FREEZERO'], 'user-1', {
                cartSubtotal: 500,
                cartItems: [{ lineSubtotal: 500 }],
                shippingCost: 0,
            });

            expect(resolvedWithZero.freeShipping).toBe(true);
        });
    });

    describe('15. Reject COD when an order has no collectible shipment', () => {
        it('rejects COD payment method when cart contains only digital goods', async () => {
            vi.spyOn(Cart, 'findOne').mockResolvedValue({
                items: [{
                    productId: 'digital-p1',
                    quantity: 1,
                    product: {
                        id: 'digital-p1',
                        name: 'E-Book PDF',
                        requiresShipping: false,
                        status: 'published',
                        isEnabled: true,
                        toJSON: () => ({ id: 'digital-p1', name: 'E-Book PDF', requiresShipping: false }),
                    },
                }],
            });

            await expect(OrderService.placeOrder('user-1', {
                paymentMethod: 'cod',
            })).rejects.toThrowError(
                expect.objectContaining({
                    code: 'COD_UNAVAILABLE',
                    statusCode: 400,
                })
            );
        });
    });

    describe('16. Allocate targeted discounts only to eligible tax lines', () => {
        it('allocates line discounts only to eligible items preventing GST distortion on ineligible supplies', async () => {
            const targetedCoupon = {
                id: 'coup-target-1',
                code: 'BOOK20',
                name: '20 Off Books',
                type: 'fixed_amount',
                value: 20,
                isActive: true,
                campaignStatus: 'active',
                applicableTo: 'category',
                applicableIds: ['cat-books'],
                minOrderAmount: 0,
                perUserLimit: 10,
                toJSON: () => ({
                    id: 'coup-target-1',
                    code: 'BOOK20',
                    name: '20 Off Books',
                    type: 'fixed_amount',
                    value: 20,
                    isActive: true,
                    campaignStatus: 'active',
                    applicableTo: 'category',
                    applicableIds: ['cat-books'],
                    minOrderAmount: 0,
                    perUserLimit: 10,
                }),
            };

            vi.spyOn(SettingsService, 'getFeatures').mockResolvedValue({ features: { coupons: true } });
            vi.spyOn(Coupon, 'findOne').mockResolvedValue(targetedCoupon);
            vi.spyOn(Coupon, 'findAll').mockResolvedValue([]);
            vi.spyOn(Setting, 'findOne').mockResolvedValue({ value: 'true' });

            const resolved = await CouponService.resolveCoupons(['BOOK20'], 'user-1', {
                cartSubtotal: 200,
                cartItems: [
                    {
                        productId: 'book-1',
                        lineSubtotal: 100,
                        unitPrice: 100,
                        quantity: 1,
                        product: { id: 'book-1', name: 'Novel', categories: [{ id: 'cat-books' }] },
                    },
                    {
                        productId: 'phone-1',
                        lineSubtotal: 100,
                        unitPrice: 100,
                        quantity: 1,
                        product: { id: 'phone-1', name: 'Earphones', categories: [{ id: 'cat-electronics' }] },
                    },
                ],
                shippingCost: 0,
            });

            expect(resolved.orderDiscount).toBe(20);
            expect(resolved.lineDiscounts['book-1']).toBe(20);
            expect(resolved.lineDiscounts['phone-1']).toBeUndefined();
        });
    });

    describe('17. Allow delivery retries after a failed attempt', () => {
        it('permits delivery_failed -> out_for_delivery retry transition via webhook without dropping as stale status', async () => {
            const mockShipmentRecord = {
                id: 'ship-failed-1',
                awb: 'SR-RETRY-123',
                status: 'delivery_failed',
                orderId: 'ord-retry-1',
                fulfillmentId: 'ful-retry-1',
                statusHistory: [{ status: 'delivery_failed', at: new Date().toISOString() }],
                update: vi.fn().mockImplementation(async (updates) => Object.assign(mockShipmentRecord, updates)),
            };

            const mockFulfillmentRecord = {
                id: 'ful-retry-1',
                status: 'delivery_failed',
                update: vi.fn().mockImplementation(async (updates) => Object.assign(mockFulfillmentRecord, updates)),
            };

            const mockOrderRecord = {
                id: 'ord-retry-1',
                orderShippingStatus: 'delivery_failed',
                shipmentStatus: 'delivery_failed',
                userId: 'user-retry-1',
                update: vi.fn().mockImplementation(async (updates) => Object.assign(mockOrderRecord, updates)),
            };

            vi.spyOn(ShippingProvider, 'findOne').mockResolvedValue({
                id: 'prov-sr',
                code: 'shiprocket',
                name: 'Shiprocket',
                enabled: true,
                webhookSecret: 'test-secret',
            });
            vi.spyOn(Shipment, 'findOne').mockResolvedValue(mockShipmentRecord);
            vi.spyOn(Fulfillment, 'findByPk').mockResolvedValue(mockFulfillmentRecord);
            vi.spyOn(Order, 'findByPk').mockResolvedValue(mockOrderRecord);
            vi.spyOn(Shipment, 'findAll').mockResolvedValue([mockShipmentRecord]);
            vi.spyOn(ShipmentEvent, 'findOne').mockResolvedValue(null);
            vi.spyOn(ShipmentEvent, 'create').mockResolvedValue({ id: 'evt-retry-1' });

            const result = await ShippingWebhookService.processWebhook('shiprocket', {
                awb: 'SR-RETRY-123',
                current_status: 'OUT FOR DELIVERY',
                scan_id: 'SCAN-RETRY-1',
            }, { 'x-api-key': 'test-secret' });

            expect(result.accepted).toBe(true);
            expect(result.ignored).toBeUndefined();
            expect(mockShipmentRecord.update).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'out_for_delivery' }),
                expect.anything()
            );
        });
    });
});
