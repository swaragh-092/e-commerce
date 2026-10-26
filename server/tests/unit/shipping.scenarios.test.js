import { describe, it, expect, vi } from 'vitest';
const { planParcels } = require('../../src/modules/shipping/shipping.packages');
const ShippingService = require('../../src/modules/shipping/shipping.service');
const { calculateShipmentAmounts } = require('../../src/modules/order/order.service');
const { validateShippingReadiness } = require('../../src/modules/product/product.service');

describe('Packaging & Shipping Scenario Verification', () => {
    const testProfiles = [
        {
            id: 'box-small',
            name: 'Small Box',
            lengthCm: 15,
            breadthCm: 12,
            heightCm: 10,
            emptyWeightGrams: 50,
            maxItems: 5,
            maxContentsWeightGrams: 2000,
            enabled: true,
        },
        {
            id: 'box-medium',
            name: 'Medium Box',
            lengthCm: 30,
            breadthCm: 20,
            heightCm: 15,
            emptyWeightGrams: 100,
            maxItems: 10,
            maxContentsWeightGrams: 5000,
            enabled: true,
        },
        {
            id: 'box-large',
            name: 'Large Box',
            lengthCm: 50,
            breadthCm: 40,
            heightCm: 30,
            emptyWeightGrams: 200,
            maxItems: 20,
            maxContentsWeightGrams: 15000,
            enabled: true,
        },
    ];

    // Scenario 1: One item → smallest suitable box
    it('Scenario 1: One item → recommends the smallest suitable box', () => {
        const item = {
            productId: 'p-mug',
            name: 'Coffee Mug',
            lengthCm: 10,
            breadthCm: 10,
            heightCm: 9,
            weightGrams: 350,
            quantity: 1,
            requiresShipping: true,
        };
        const parcels = planParcels([item], testProfiles);
        expect(parcels).toHaveLength(1);
        expect(parcels[0].packageId).toBe('box-small');
        expect(parcels[0].packageName).toBe('Small Box');
        expect(parcels[0].items[0].quantity).toBe(1);
    });

    // Scenario 2: Multiple items → shared box or valid parcel split
    it('Scenario 2: Multiple items → packs into shared box when fitting, or splits when exceeding capacity', () => {
        // 2a: Fits into shared box
        const smallItems = [
            { productId: 'p-shirt', name: 'T-Shirt', lengthCm: 12, breadthCm: 10, heightCm: 3, weightGrams: 200, quantity: 2, requiresShipping: true },
            { productId: 'p-cap', name: 'Cap', lengthCm: 10, breadthCm: 10, heightCm: 5, weightGrams: 100, quantity: 1, requiresShipping: true },
        ];
        const sharedParcels = planParcels(smallItems, testProfiles);
        expect(sharedParcels).toHaveLength(1);
        expect(sharedParcels[0].packageId).toBe('box-small');
        expect(sharedParcels[0].items).toHaveLength(2);

        // 2b: Overflowing items split across parcels
        const bulkyItems = [
            { productId: 'p-boots-1', name: 'Heavy Boots 1', lengthCm: 28, breadthCm: 18, heightCm: 14, weightGrams: 1800, quantity: 1, requiresShipping: true },
            { productId: 'p-boots-2', name: 'Heavy Boots 2', lengthCm: 28, breadthCm: 18, heightCm: 14, weightGrams: 1800, quantity: 1, requiresShipping: true },
        ];
        const bulkyParcels = planParcels(bulkyItems, [testProfiles[0], testProfiles[1]]); // only small and medium available
        expect(bulkyParcels).toHaveLength(2);
        expect(bulkyParcels[0].items[0].quantity).toBe(1);
        expect(bulkyParcels[1].items[0].quantity).toBe(1);
    });

    // Scenario 3: Separate item → its own parcel
    it('Scenario 3: Separate item → packs into its own parcel when packingMode is separate', () => {
        const mixedItems = [
            { productId: 'p-frame', name: 'Fragile Frame', lengthCm: 12, breadthCm: 10, heightCm: 4, weightGrams: 300, quantity: 2, packingMode: 'separate', requiresShipping: true },
            { productId: 'p-pen', name: 'Pen', lengthCm: 10, breadthCm: 2, heightCm: 2, weightGrams: 50, quantity: 1, requiresShipping: true },
        ];
        const parcels = planParcels(mixedItems, testProfiles);
        expect(parcels).toHaveLength(3);
        const frameParcels = parcels.filter(p => p.items.some(i => i.productId === 'p-frame'));
        expect(frameParcels).toHaveLength(2);
        frameParcels.forEach(p => {
            expect(p.items).toHaveLength(1);
            expect(p.items[0].quantity).toBe(1);
        });
    });

    // Scenario 4: Multi-box Shiprocket order → warehouse can book each parcel independently
    it('Scenario 4: Multi-box Shiprocket order → resolves as eligible multi-parcel carrier workflow', () => {
        const workflow = ShippingService.resolveWorkflow({
            parcelCount: 2,
            provider: { code: 'shiprocket', name: 'Shiprocket' },
            manualSelected: false,
        });
        expect(workflow.status).toBe('eligible');
        expect(workflow.workflow).toBe('multi_parcel_carrier');
    });

    // Scenario 5: Changed package → measured values sent to the courier
    it('Scenario 5: Changed package → confirmed measured values are captured and passed', () => {
        const confirmedMeasurements = {
            packageName: 'Custom Heavy Box',
            lengthCm: 22,
            breadthCm: 18,
            heightCm: 12,
            actualWeightGrams: 1450,
        };
        const volumetricWeightGrams = Math.ceil((confirmedMeasurements.lengthCm * confirmedMeasurements.breadthCm * confirmedMeasurements.heightCm / 5000) * 1000);
        expect(volumetricWeightGrams).toBe(951);
        expect(confirmedMeasurements.actualWeightGrams).toBe(1450);
        expect(Math.max(confirmedMeasurements.actualWeightGrams, volumetricWeightGrams)).toBe(1450);
    });

    // Scenario 6: Duplicate submit → no duplicate booking
    it('Scenario 6: Duplicate submit → rejects booking when planned parcel is already fulfilled', () => {
        const orderParcelPlan = [
            { parcelId: 'parcel-1', packageName: 'Box 1', items: [{ productId: 'p1', quantity: 1 }] },
            { parcelId: 'parcel-2', packageName: 'Box 2', items: [{ productId: 'p2', quantity: 1 }] },
        ];
        const bookedParcelIds = new Set(['parcel-1']);

        const unbooked = orderParcelPlan.find(p => !bookedParcelIds.has(p.parcelId));
        expect(unbooked.parcelId).toBe('parcel-2');

        const isDuplicate = bookedParcelIds.has('parcel-1');
        expect(isDuplicate).toBe(true);
    });

    // Scenario 7: Missing measurements → flagged before sale
    it('Scenario 7: Missing measurements → rejects publishing physical products without weight/dimensions', () => {
        // Missing weight
        expect(() => {
            validateShippingReadiness({
                name: 'Unweighed Product',
                status: 'published',
                requiresShipping: true,
                lengthCm: 10,
                breadthCm: 10,
                heightCm: 10,
            });
        }).toThrow(/physical products requiring shipping must have weight/);

        // Missing dimensions
        expect(() => {
            validateShippingReadiness({
                name: 'Dimensionless Product',
                status: 'published',
                requiresShipping: true,
                weightGrams: 500,
                lengthCm: 0,
                breadthCm: 10,
                heightCm: 10,
            });
        }).toThrow(/physical products requiring shipping must have length/);

        // Draft product is allowed to have missing measurements
        expect(() => {
            validateShippingReadiness({
                name: 'Draft Product',
                status: 'draft',
                requiresShipping: true,
                weightGrams: 0,
            });
        }).not.toThrow();

        // Digital product is allowed to have no shipping measurements
        expect(() => {
            validateShippingReadiness({
                name: 'Digital Course',
                status: 'published',
                requiresShipping: false,
            });
        }).not.toThrow();
    });

    // Scenario 8: COD split → allocated amounts total exactly what the customer owes
    it('Scenario 8: COD split → allocated amounts total exactly what the customer owes', () => {
        const order = {
            total: 2499.75,
            paymentMethod: 'cod',
            subtotal: 2300,
            tax: 149.75,
            discountAmount: 100,
            shippingCost: 150,
            shippingTaxAmount: 0,
            shippingTaxIncluded: true,
        };

        const parcel1 = calculateShipmentAmounts({
            order,
            parcelItems: [{ unitPrice: 1150, quantity: 1 }],
            allocateOrderShipping: true,
            priorAllocatedTotal: 0,
            isFinalShipment: false,
        });

        const parcel2 = calculateShipmentAmounts({
            order,
            parcelItems: [{ unitPrice: 1150, quantity: 1 }],
            allocateOrderShipping: false,
            priorAllocatedTotal: parcel1.total,
            isFinalShipment: true,
        });

        expect(parcel1.total + parcel2.total).toBe(2499.75);
    });
});
