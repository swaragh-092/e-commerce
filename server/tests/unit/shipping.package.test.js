import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const ShippingService = require('../../src/modules/shipping/shipping.service');
const { validateDefaultPackage } = require('../../src/modules/shipping/shipping.package');
const { Product } = require('../../src/modules');

const box = { enabled: true, lengthCm: 20.5, breadthCm: 15.5, heightCm: 8.5, emptyWeightGrams: 80, maxItems: 3, maxContentsWeightGrams: 900 };
const calculate = (items, config = box) => ShippingService.computePackageDimensions(items, 50, { strict: true, defaultPackage: config });

describe('Measured default shipping package', () => {
    it('uses decimal box dimensions and adds tare once without requiring product dimensions', () => {
        const result = calculate([{ product: { weightGrams: 200 }, quantity: 3 }]);
        expect(result).toEqual({ maxL: 20.5, maxB: 15.5, totalH: 8.5, totalWeightGrams: 680, volumeCm3: 20.5 * 15.5 * 8.5 });
    });

    it('accepts exactly the confirmed unit and weight capacity', () => {
        expect(calculate([{ product: { weightGrams: 300 }, quantity: 3 }]).totalWeightGrams).toBe(980);
    });

    it.each([null, 0, -1, Infinity, 'invalid'])('rejects missing or invalid product weight %s', (weightGrams) => {
        expect(() => calculate([{ product: { weightGrams }, quantity: 1 }])).toThrow('Shipping is temporarily unavailable');
    });

    it.each([0, -1, 1.5, Infinity])('rejects invalid quantity %s', (quantity) => {
        expect(() => calculate([{ product: { weightGrams: 100 }, quantity }])).toThrow('positive whole number');
    });

    it('counts all physical items across mixed products for capacity', () => {
        expect(() => calculate([{ product: { weightGrams: 100 }, quantity: 2 }, { product: { weightGrams: 100 }, quantity: 2 }])).toThrow('packaging capacity');
    });

    it('rejects an overweight order even when the item count fits', () => {
        expect(() => calculate([{ product: { weightGrams: 901 }, quantity: 1 }])).toThrow('packaging capacity');
    });

    it('rejects a product whose known dimensions exceed the default package', () => {
        expect(() => calculate([{ product: { weightGrams: 100, lengthCm: 30, breadthCm: 10, heightCm: 5 }, quantity: 1 }])).toThrow('different packaging');
    });

    it('accepts a fitting product after rotating its dimensions', () => {
        expect(calculate([{ product: { weightGrams: 100, lengthCm: 5, breadthCm: 20, heightCm: 10 }, quantity: 1 }]).totalWeightGrams).toBe(180);
    });

    it('excludes digital items from capacity and weight', () => {
        const result = calculate([{ product: { requiresShipping: false }, quantity: 99 }, { product: { weightGrams: 200 }, quantity: 1 }]);
        expect(result.totalWeightGrams).toBe(280);
    });

    it('does not charge packaging weight for an entirely digital cart', () => {
        expect(calculate([{ product: { requiresShipping: false }, quantity: 1 }]).totalWeightGrams).toBe(0);
    });

    it.each([
        { heightCm: 0.5 }, { lengthCm: null }, { breadthCm: Infinity }, { emptyWeightGrams: '' },
        { emptyWeightGrams: -1 }, { maxItems: 1.5 }, { maxContentsWeightGrams: 0 },
    ])('rejects invalid saved package configuration %j', (override) => {
        expect(() => validateDefaultPackage({ ...box, ...override })).toThrow();
    });

    it('keeps legacy product-dimension validation when the package is disabled', () => {
        expect(() => calculate([{ product: { weightGrams: 100 }, quantity: 1 }], { enabled: false })).toThrow('Shipping is temporarily unavailable');
    });

    it('does not invent measurements for newly created products', () => {
        for (const key of ['weightGrams', 'lengthCm', 'breadthCm', 'heightCm']) {
            expect(Product.rawAttributes[key].defaultValue).toBeNull();
        }
    });
});

describe('Parcel planner & remainder box optimization', () => {
    const { planParcels, validatePackageProfiles } = require('../../src/modules/shipping/shipping.packages');

    const profiles = [
        {
            id: 'pkg-large',
            name: 'Large Box',
            lengthCm: 30,
            breadthCm: 20,
            heightCm: 15,
            emptyWeightGrams: 150,
            maxItems: 10,
            maxContentsWeightGrams: 5000,
            fits: [{ productId: 'prod-1', maxQuantity: 10 }],
        },
        {
            id: 'pkg-small',
            name: 'Small Box',
            lengthCm: 15,
            breadthCm: 10,
            heightCm: 5,
            emptyWeightGrams: 50,
            maxItems: 2,
            maxContentsWeightGrams: 1000,
            fits: [{ productId: 'prod-1', maxQuantity: 2 }],
        },
    ];

    it('validates package profiles schema correctly', () => {
        expect(() => validatePackageProfiles(null)).toThrow('must be a list');
        expect(() => validatePackageProfiles([{ id: 'p1' }])).toThrow();
        expect(validatePackageProfiles(profiles)).toHaveLength(2);
    });

    it('packs remainders into the smallest suitable box without increasing parcel count', () => {
        const items = [{ productId: 'prod-1', name: 'Widget', weightGrams: 100, quantity: 11, requiresShipping: true }];
        const parcels = planParcels(items, profiles);

        expect(parcels).toHaveLength(2);
        const smallParcel = parcels.find((p) => p.packageId === 'pkg-small');
        const largeParcel = parcels.find((p) => p.packageId === 'pkg-large');
        expect(smallParcel).toBeDefined();
        expect(largeParcel).toBeDefined();
        expect(smallParcel.items[0].quantity + largeParcel.items[0].quantity).toBe(11);
    });

    it('excludes digital items from planned parcels', () => {
        const items = [
            { productId: 'digital-1', name: 'E-Book', requiresShipping: false, quantity: 5 },
            { productId: 'prod-1', name: 'Widget', weightGrams: 100, quantity: 2, requiresShipping: true },
        ];
        const parcels = planParcels(items, profiles);
        expect(parcels).toHaveLength(1);
        expect(parcels[0].items[0].productId).toBe('prod-1');
    });

    it('throws when no package fits the product', () => {
        const items = [{ productId: 'unknown-prod', name: 'Unknown', weightGrams: 100, quantity: 1, requiresShipping: true }];
        expect(() => planParcels(items, profiles)).toThrow('No configured package is confirmed to fit');
    });
});
