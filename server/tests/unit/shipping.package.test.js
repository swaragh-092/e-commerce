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
        },
    ];

    it('validates package profiles schema correctly', () => {
        expect(() => validatePackageProfiles(null)).toThrow('must be a list');
        expect(() => validatePackageProfiles([{ id: 'p1' }])).toThrow();
        expect(validatePackageProfiles(profiles)).toHaveLength(2);
    });

    it('drops legacy per-product fit rules instead of enforcing them', () => {
        const legacy = [{ ...profiles[0], fits: [{ productId: 'prod-1', maxQuantity: 1 }] }];
        const validated = validatePackageProfiles(legacy);
        expect(validated[0].fits).toBeUndefined();
    });

    it('packs remainders into the smallest suitable box without increasing parcel count', () => {
        const items = [{ productId: 'prod-1', name: 'Widget', lengthCm: 5, breadthCm: 5, heightCm: 5, weightGrams: 100, quantity: 11, requiresShipping: true }];
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
            { productId: 'prod-1', name: 'Widget', lengthCm: 5, breadthCm: 5, heightCm: 5, weightGrams: 100, quantity: 2, requiresShipping: true },
        ];
        const parcels = planParcels(items, profiles);
        expect(parcels).toHaveLength(1);
        expect(parcels[0].items[0].productId).toBe('prod-1');
    });

    it('throws when no package fits the product', () => {
        const items = [{ productId: 'unknown-prod', name: 'Unknown', lengthCm: 99, breadthCm: 99, heightCm: 99, weightGrams: 100, quantity: 1, requiresShipping: true }];
        expect(() => planParcels(items, profiles)).toThrow('No configured package is confirmed to fit');
    });

    it('enforces per-parcel item limits across variants without fit rules', () => {
        const mixProfiles = [
            {
                id: 'pkg-mix',
                name: 'Mix Box',
                lengthCm: 20,
                breadthCm: 15,
                heightCm: 10,
                emptyWeightGrams: 50,
                maxItems: 2,
                maxContentsWeightGrams: 2000,
            },
        ];
        const items = [
            { productId: 'prod-shirt', variantId: 'var-red', name: 'Shirt Red', lengthCm: 10, breadthCm: 8, heightCm: 4, weightGrams: 100, quantity: 2, requiresShipping: true },
            { productId: 'prod-shirt', variantId: 'var-blue', name: 'Shirt Blue', lengthCm: 10, breadthCm: 8, heightCm: 4, weightGrams: 100, quantity: 2, requiresShipping: true },
        ];
        const parcels = planParcels(items, mixProfiles);
        // Per-parcel limit is 2, so 4 total units must not be packed into a single parcel.
        expect(parcels.length).toBe(2);
        expect(parcels[0].items.reduce((s, i) => s + i.quantity, 0)).toBe(2);
        expect(parcels[1].items.reduce((s, i) => s + i.quantity, 0)).toBe(2);
    });

    it('rejects planning when no measured package catalog exists', () => {
        const items = [{ productId: 'prod-no-profile', name: 'Book', weightGrams: 100, quantity: 1, requiresShipping: true }];
        // No presets and no legacy single-box fallback: merchants must add
        // measured box presets instead of relying on an invented fit.
        expect(() => planParcels(items, [])).toThrow('No active package types are configured');
        expect(() => planParcels(items, [{ ...profiles[0], enabled: false }])).toThrow('No active package types are configured');
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
            },
        ];
        const items = [
            { productId: 'prod-shirt', name: 'Shirt', lengthCm: 10, breadthCm: 8, heightCm: 4, weightGrams: 150, quantity: 2, requiresShipping: true },
            { productId: 'prod-mug', name: 'Mug', lengthCm: 8, breadthCm: 8, heightCm: 8, weightGrams: 300, quantity: 1, requiresShipping: true },
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
            },
        ];
        const items = [
            { productId: 'prod-chemicals', name: 'Cleaner', lengthCm: 10, breadthCm: 8, heightCm: 8, weightGrams: 500, quantity: 1, mixGroup: 'hazardous', requiresShipping: true },
            { productId: 'prod-food', name: 'Snack', lengthCm: 10, breadthCm: 8, heightCm: 8, weightGrams: 200, quantity: 1, mixGroup: 'edible', requiresShipping: true },
        ];
        const parcels = planParcels(items, incompatibleProfiles);
        // Incompatible mix groups must be packed into separate parcels
        expect(parcels).toHaveLength(2);
    });

    it('isolates restricted products marked separate from ordinary goods', () => {
        const boxPresets = [
            {
                id: 'std-box',
                name: 'Standard Box',
                lengthCm: 30,
                breadthCm: 25,
                heightCm: 20,
                emptyWeightGrams: 100,
                maxItems: 10,
                maxContentsWeightGrams: 5000,
            },
        ];
        const items = [
            { productId: 'prod-restricted', name: 'Restricted', lengthCm: 10, breadthCm: 8, heightCm: 8, weightGrams: 200, quantity: 1, packingMode: 'separate', requiresShipping: true },
            { productId: 'prod-ordinary', name: 'Ordinary', lengthCm: 10, breadthCm: 8, heightCm: 8, weightGrams: 200, quantity: 1, requiresShipping: true },
        ];
        const parcels = planParcels(items, boxPresets);
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

    it('regression: two 9x9x9 cm items in 10x10x10 cm box split into 2 parcels due to cumulative volume overflow', () => {
        const boxPresets = [
            {
                id: 'box-10',
                name: '10cm Cube Box',
                lengthCm: 10,
                breadthCm: 10,
                heightCm: 10,
                emptyWeightGrams: 50,
                maxItems: 10,
                maxContentsWeightGrams: 5000,
            },
        ];
        const items = [
            {
                productId: 'prod-cube-9',
                name: '9cm Cube Item',
                lengthCm: 9,
                breadthCm: 9,
                heightCm: 9,
                weightGrams: 100,
                quantity: 2,
                requiresShipping: true,
            },
        ];
        // 2 items * 729 cm³ = 1458 cm³ > 1000 cm³ (box volume).
        // Must split into 2 parcels rather than cramming both into one 1000 cm³ box.
        const parcels = planParcels(items, boxPresets);
        expect(parcels).toHaveLength(2);
        expect(parcels[0].packageId).toBe('box-10');
        expect(parcels[1].packageId).toBe('box-10');
        expect(parcels[0].items[0].quantity).toBe(1);
        expect(parcels[1].items[0].quantity).toBe(1);
    });

    it('prefers one suitable larger box over several smaller boxes when available', () => {
        const boxPresets = [
            {
                id: 'small-box',
                name: 'Small Box',
                lengthCm: 10,
                breadthCm: 10,
                heightCm: 10,
                emptyWeightGrams: 50,
                maxItems: 10,
                maxContentsWeightGrams: 5000,
            },
            {
                id: 'medium-box',
                name: 'Medium Box',
                lengthCm: 20,
                breadthCm: 10,
                heightCm: 10,
                emptyWeightGrams: 90,
                maxItems: 10,
                maxContentsWeightGrams: 5000,
            },
        ];
        const items = [
            {
                productId: 'prod-cube-9',
                name: '9cm Cube Item',
                lengthCm: 9,
                breadthCm: 9,
                heightCm: 9,
                weightGrams: 100,
                quantity: 2,
                requiresShipping: true,
            },
        ];
        // Medium Box (2000 cm³) can hold both items (1458 cm³).
        // Small Box (1000 cm³) would require 2 boxes.
        // Planner must score and pick 1 Medium Box.
        const parcels = planParcels(items, boxPresets);
        expect(parcels).toHaveLength(1);
        expect(parcels[0].packageId).toBe('medium-box');
        expect(parcels[0].items[0].quantity).toBe(2);
    });

    it('splits into individual parcels when packingMode is separate', () => {
        const boxPresets = [
            {
                id: 'large-crate',
                name: 'Large Crate',
                lengthCm: 50,
                breadthCm: 50,
                heightCm: 50,
                emptyWeightGrams: 100,
                maxItems: 20,
                maxContentsWeightGrams: 10000,
            },
        ];
        const items = [
            {
                productId: 'fragile-mirror',
                name: 'Delicate Framed Mirror',
                lengthCm: 20,
                breadthCm: 20,
                heightCm: 5,
                weightGrams: 500,
                quantity: 3,
                packingMode: 'separate',
                requiresShipping: true,
            },
        ];
        // Even though Large Crate has plenty of capacity for 3 mirrors,
        // packingMode: 'separate' forces 1 parcel per unit.
        const parcels = planParcels(items, boxPresets);
        expect(parcels).toHaveLength(3);
        expect(parcels.every((p) => p.packageId === 'large-crate')).toBe(true);
        expect(parcels.every((p) => p.items[0].quantity === 1)).toBe(true);
    });

    it('enforces interior usable dimensions when configured', () => {
        const boxPresets = [
            {
                id: 'padded-box',
                name: 'Padded Box',
                lengthCm: 20,
                breadthCm: 20,
                heightCm: 20,
                innerLengthCm: 10,
                innerBreadthCm: 10,
                innerHeightCm: 10,
                emptyWeightGrams: 100,
                maxItems: 5,
                maxContentsWeightGrams: 5000,
            },
        ];
        // Item is 12x10x10. It fits exterior (20x20x20), but exceeds interior length (10).
        const items = [
            {
                productId: 'item-12cm',
                name: '12cm Item',
                lengthCm: 12,
                breadthCm: 10,
                heightCm: 10,
                weightGrams: 300,
                quantity: 1,
                requiresShipping: true,
            },
        ];
        expect(() => planParcels(items, boxPresets)).toThrow('No configured package is confirmed to fit');
    });

    it('produces deterministic parcel ids for separate packing across runs', () => {
        const boxPresets = [
            {
                id: 'std-box',
                name: 'Standard Box',
                lengthCm: 30,
                breadthCm: 30,
                heightCm: 30,
                emptyWeightGrams: 100,
                maxItems: 10,
                maxContentsWeightGrams: 10000,
            },
        ];
        const items = [
            {
                productId: 'solo-item',
                name: 'Solo Item',
                lengthCm: 10,
                breadthCm: 10,
                heightCm: 10,
                weightGrams: 200,
                quantity: 2,
                packingMode: 'separate',
                requiresShipping: true,
            },
        ];
        const first = planParcels(items, boxPresets);
        const second = planParcels(items, boxPresets);
        expect(first).toHaveLength(2);
        // Quote idempotency hashes the parcel plan: random ids would break it.
        expect(second.map((p) => p.parcelId)).toEqual(first.map((p) => p.parcelId));
        expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    });

    it('refuses to guess a preset-box fit for items without dimensions', () => {
        const boxPresets = [
            {
                id: 'preset-only',
                name: 'Preset Only',
                lengthCm: 30,
                breadthCm: 30,
                heightCm: 30,
                emptyWeightGrams: 100,
                maxItems: 10,
                maxContentsWeightGrams: 10000,
            },
        ];
        // No dimensions, no legacy fit rule, no legacy default package:
        // must fail loudly instead of assuming the preset box fits.
        const items = [{ productId: 'mystery', name: 'Mystery', weightGrams: 100, quantity: 1, requiresShipping: true }];
        expect(() => planParcels(items, boxPresets)).toThrow('No configured package is confirmed to fit');
    });

    it('prefers the merchant default box only on exact candidate ties', () => {
        const twinA = {
            id: 'box-a',
            name: 'Box A',
            lengthCm: 20,
            breadthCm: 20,
            heightCm: 20,
            emptyWeightGrams: 100,
            maxItems: 5,
            maxContentsWeightGrams: 5000,
        };
        const twinB = { ...twinA, id: 'box-b', name: 'Box B' };
        const items = [
            {
                productId: 'widget',
                name: 'Widget',
                lengthCm: 10,
                breadthCm: 10,
                heightCm: 10,
                weightGrams: 200,
                quantity: 1,
                requiresShipping: true,
            },
        ];
        const withoutDefault = planParcels(items, [twinA, twinB]);
        expect(withoutDefault[0].packageId).toBe('box-a');
        const withDefault = planParcels(items, [twinA, twinB], { defaultPackageId: 'box-b' });
        expect(withDefault[0].packageId).toBe('box-b');
        // Unknown default ids are ignored safely.
        const unknownDefault = planParcels(items, [twinA, twinB], { defaultPackageId: 'nope' });
        expect(unknownDefault[0].packageId).toBe('box-a');
    });
});

describe('Variant measurement inheritance', () => {
    const { resolveUnitDimensions, resolveUnitWeight } = ShippingService;
    const product = { id: 'prod-1', lengthCm: 10, breadthCm: 8, heightCm: 4, weightGrams: 200 };

    it('inherits the full dimension tuple when the variant has none', () => {
        expect(resolveUnitDimensions(null, product, {})).toEqual({ lengthCm: 10, breadthCm: 8, heightCm: 4 });
        expect(resolveUnitDimensions({}, product, {})).toEqual({ lengthCm: 10, breadthCm: 8, heightCm: 4 });
        expect(resolveUnitWeight(null, product, {})).toBe(200);
    });

    it.each([
        [{ lengthCm: 12 }],
        [{ lengthCm: 12, breadthCm: 8 }],
        [{ lengthCm: 0, breadthCm: 8, heightCm: 4 }],
        [{ lengthCm: -2, breadthCm: 8, heightCm: 4 }],
        [{ lengthCm: 'x', breadthCm: 8, heightCm: 4 }],
    ])('rejects partial or invalid variant dimensions %j instead of mixing with product sides', (variant) => {
        expect(() => resolveUnitDimensions(variant, product, { productId: 'prod-1', variantId: 'var-1' })).toThrow('incomplete or invalid shipping dimensions');
    });

    it.each([
        [{ weightGrams: 0 }],
        [{ weightGrams: -50 }],
        [{ weightGrams: 'heavy' }],
    ])('rejects invalid variant weight %j instead of inheriting', (variant) => {
        expect(() => resolveUnitWeight(variant, product, { productId: 'prod-1', variantId: 'var-1' })).toThrow('invalid shipping weight');
    });
});

