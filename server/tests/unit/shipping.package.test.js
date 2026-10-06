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

    it('counts product-wide package limits across all variants when fit omits variantId', () => {
        const mixProfiles = [
            {
                id: 'pkg-mix',
                name: 'Mix Box',
                lengthCm: 20,
                breadthCm: 15,
                heightCm: 10,
                emptyWeightGrams: 50,
                maxItems: 10,
                maxContentsWeightGrams: 2000,
                fits: [{ productId: 'prod-shirt', maxQuantity: 2, mixGroup: 'apparel' }],
            },
        ];
        const items = [
            { productId: 'prod-shirt', variantId: 'var-red', name: 'Shirt Red', weightGrams: 100, quantity: 2, requiresShipping: true },
            { productId: 'prod-shirt', variantId: 'var-blue', name: 'Shirt Blue', weightGrams: 100, quantity: 2, requiresShipping: true },
        ];
        const parcels = planParcels(items, mixProfiles);
        // Product-wide limit is 2, so 4 total units must not be packed into a single parcel.
        expect(parcels.length).toBe(2);
        expect(parcels[0].items.reduce((s, i) => s + i.quantity, 0)).toBe(2);
        expect(parcels[1].items.reduce((s, i) => s + i.quantity, 0)).toBe(2);
    });

    it('guards fallback candidate without fit when default package is used', () => {
        const items = [{ productId: 'prod-no-profile', name: 'Book', weightGrams: 100, quantity: 1, requiresShipping: true }];
        const defaultPackage = {
            id: 'legacy-box',
            name: 'Default Box',
            enabled: true,
            lengthCm: 25,
            breadthCm: 20,
            heightCm: 10,
            maxItems: 5,
            maxContentsWeightGrams: 3000,
            emptyWeightGrams: 50,
        };
        const parcels = planParcels(items, profiles, { defaultPackage });
        expect(parcels).toHaveLength(1);
        expect(parcels[0].packageId).toBe('legacy-box');
    });

    it('allows different products without mixGroup to share a package up to capacity', () => {
        const sharedProfiles = [
            {
                id: 'pkg-medium',
                name: 'Medium Box',
                lengthCm: 25,
                breadthCm: 20,
                heightCm: 15,
                emptyWeightGrams: 80,
                maxItems: 5,
                maxContentsWeightGrams: 3000,
                fits: [
                    { productId: 'prod-shirt', maxQuantity: 3 },
                    { productId: 'prod-mug', maxQuantity: 2 },
                ],
            },
        ];
        const items = [
            { productId: 'prod-shirt', name: 'Shirt', weightGrams: 150, quantity: 2, requiresShipping: true },
            { productId: 'prod-mug', name: 'Mug', weightGrams: 300, quantity: 1, requiresShipping: true },
        ];
        const parcels = planParcels(items, sharedProfiles);
        // Both items should share 1 parcel because capacity (maxItems: 5, maxWeight: 3000g) allows it
        expect(parcels).toHaveLength(1);
        expect(parcels[0].packageId).toBe('pkg-medium');
        expect(parcels[0].items).toHaveLength(2);
    });

    it('separates products with explicitly incompatible mix groups', () => {
        const incompatibleProfiles = [
            {
                id: 'pkg-standard',
                name: 'Standard Box',
                lengthCm: 30,
                breadthCm: 25,
                heightCm: 20,
                emptyWeightGrams: 100,
                maxItems: 10,
                maxContentsWeightGrams: 5000,
                fits: [
                    { productId: 'prod-chemicals', maxQuantity: 5, mixGroup: 'hazardous' },
                    { productId: 'prod-food', maxQuantity: 5, mixGroup: 'edible' },
                ],
            },
        ];
        const items = [
            { productId: 'prod-chemicals', name: 'Cleaner', weightGrams: 500, quantity: 1, requiresShipping: true },
            { productId: 'prod-food', name: 'Snack', weightGrams: 200, quantity: 1, requiresShipping: true },
        ];
        const parcels = planParcels(items, incompatibleProfiles);
        // Incompatible mix groups must be packed into separate parcels
        expect(parcels).toHaveLength(2);
    });

    it('marks multi-parcel orders with carriers as eligible in resolveWorkflow', () => {
        const workflow = ShippingService.resolveWorkflow({
            parcelCount: 2,
            provider: { code: 'shiprocket', name: 'Shiprocket' },
            manualSelected: false,
        });
        expect(workflow.status).toBe('eligible');
        expect(workflow.workflow).toBe('multi_parcel_carrier');
    });

    it('2-item blank-group cart => 1 parcel, serviceable true', () => {
        const boxPresets = [
            {
                id: 'preset-standard',
                name: 'Standard Box',
                lengthCm: 30,
                breadthCm: 25,
                heightCm: 15,
                emptyWeightGrams: 50,
                maxItems: 10,
                maxContentsWeightGrams: 5000,
                fits: [], // Inverted model: no mandatory product fit matrix
            },
        ];
        const items = [
            { productId: 'prod-shirt', name: 'Shirt', lengthCm: 20, breadthCm: 15, heightCm: 3, weightGrams: 200, quantity: 1, requiresShipping: true },
            { productId: 'prod-cap', name: 'Cap', lengthCm: 18, breadthCm: 14, heightCm: 8, weightGrams: 150, quantity: 1, requiresShipping: true },
        ];
        // Both items have blank / undefined mixGroup
        const parcels = planParcels(items, boxPresets);
        expect(parcels).toHaveLength(1);
        expect(parcels[0].packageId).toBe('preset-standard');
        expect(parcels[0].items).toHaveLength(2);

        const workflow = ShippingService.resolveWorkflow({
            parcelCount: parcels.length,
            provider: { code: 'shiprocket', name: 'Shiprocket' },
            manualSelected: false,
        });
        expect(workflow.status).toBe('eligible');
        expect(workflow.workflow).toBe('ordinary_shipment');
    });

    it('auto-selects smallest fitting box by volume without explicit product fit rules (Shopify model)', () => {
        const boxPresets = [
            {
                id: 'large-crate',
                name: 'Large Crate',
                lengthCm: 50,
                breadthCm: 40,
                heightCm: 30,
                emptyWeightGrams: 200,
                maxItems: 20,
                maxContentsWeightGrams: 10000,
                fits: [],
            },
            {
                id: 'small-box',
                name: 'Small Box',
                lengthCm: 20,
                breadthCm: 15,
                heightCm: 10,
                emptyWeightGrams: 40,
                maxItems: 5,
                maxContentsWeightGrams: 2000,
                fits: [],
            },
        ];
        const items = [
            { productId: 'prod-mug', name: 'Coffee Mug', lengthCm: 12, breadthCm: 10, heightCm: 9, weightGrams: 350, quantity: 1, requiresShipping: true },
        ];
        const parcels = planParcels(items, boxPresets);
        expect(parcels).toHaveLength(1);
        // Small Box has smaller volume (3,000 cm³ vs 60,000 cm³), so it must be selected
        expect(parcels[0].packageId).toBe('small-box');
    });
});
