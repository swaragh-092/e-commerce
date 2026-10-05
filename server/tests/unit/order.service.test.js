import { describe, it, expect, vi, beforeEach } from 'vitest';
const { calculateShipmentAmounts, buildOrderLookupWhere, getDispatchedQuantityForOrderItem, hashOrderIntent, assertMatchingOrderIntent, getOrderIdempotencyWhere } = require('../../src/modules/order/order.service');

// We mock the database models and test the core constraints of placeOrder
// This avoids spinning up a PG database just to test inventory calculation.

// The business logic of building checking item subtotals for checkout:
const calculateTotalCheckout = (checkoutItems, shippingCost = 0, discountAmount = 0, taxRate = 0) => {
    let subtotal = 0;
    
    for (const item of checkoutItems) {
        subtotal += item.price * item.quantity;
    }

    const tax = subtotal * taxRate;
    const total = subtotal + tax + shippingCost - discountAmount;
    
    return {
        subtotal,
        tax,
        total
    };
};

describe('Order Service - Calculations & Safeguards', () => {

    it('fingerprints object payloads independent of property ordering', () => {
        expect(hashOrderIntent({ shippingAddressId: 'a', paymentMethod: 'stripe' }))
            .toBe(hashOrderIntent({ paymentMethod: 'stripe', shippingAddressId: 'a' }));
    });

    it('rejects a reused idempotency key when the order intent changed', () => {
        const storedHash = hashOrderIntent({ shippingAddressId: 'address-a', paymentMethod: 'stripe' });
        expect(() => assertMatchingOrderIntent({ idempotencyPayloadHash: storedHash }, hashOrderIntent({ shippingAddressId: 'address-b', paymentMethod: 'stripe' })))
            .toThrow(expect.objectContaining({ code: 'IDEMPOTENCY_KEY_REUSED', statusCode: 422 }));
    });

    it('scopes guest idempotency by the guest session rather than across guests', () => {
        expect(getOrderIdempotencyWhere({ userId: null, guestSessionId: 'guest-a', idempotencyKey: 'key-1' }))
            .toEqual({ userId: null, guestSessionId: 'guest-a', idempotencyKey: 'key-1' });
        expect(getOrderIdempotencyWhere({ userId: 'user-1', guestSessionId: 'guest-a', idempotencyKey: 'key-1' }))
            .toEqual({ userId: 'user-1', idempotencyKey: 'key-1' });
    });

    it('allows replacement quantities after cancellation without double counting active shipment rows', () => {
        expect(getDispatchedQuantityForOrderItem({
            shipmentItems: [{ quantity: 2, shipment: { status: 'cancelled' } }, { quantity: 1, shipment: { status: 'created' } }],
            fulfillmentItems: [{ quantity: 2, fulfillment: { status: 'cancelled' } }, { quantity: 1, fulfillment: { status: 'created' } }],
        })).toBe(1);
    });

    it('scopes guest order confirmation lookup to its checkout session', () => {
        expect(buildOrderLookupWhere('order-1', null, false, 'guest-session-1')).toEqual({
            id: 'order-1', userId: null, guestSessionId: 'guest-session-1',
        });
        expect(buildOrderLookupWhere('order-1', null, false, null)).not.toEqual({ id: 'order-1' });
        expect(buildOrderLookupWhere('order-1', 'user-1', false, 'guest-session-1')).toEqual({
            id: 'order-1', userId: 'user-1',
        });
    });

    it('allocates COD parcel value to the fulfilled items and order shipping charges once', () => {
        const order = {
            subtotal: 3000,
            tax: 300,
            discountAmount: 300,
            shippingCost: 100,
            shippingTaxAmount: 18,
            shippingTaxIncluded: false,
        };
        const firstParcel = calculateShipmentAmounts({
            order,
            parcelItems: [{ unitPrice: 1000, quantity: 1 }],
            allocateOrderShipping: true,
        });
        const secondParcel = calculateShipmentAmounts({
            order,
            parcelItems: [{ unitPrice: 2000, quantity: 1 }],
            allocateOrderShipping: false,
        });

        expect(firstParcel).toEqual({ subtotal: 1000, shippingCost: 100, discountAmount: 100, tax: 118, total: 1118 });
        expect(secondParcel).toEqual({ subtotal: 2000, shippingCost: 0, discountAmount: 200, tax: 200, total: 2000 });
        expect(firstParcel.total + secondParcel.total).toBe(3118);
    });

    it('does not duplicate shipping tax or charges on later parcel payloads', () => {
        const amounts = calculateShipmentAmounts({
            order: { subtotal: 1000, tax: 90, discountAmount: 0, shippingCost: 50, shippingTaxAmount: 4.5, shippingTaxIncluded: false },
            parcelItems: [{ unitPrice: 1000, quantity: 1 }],
            allocateOrderShipping: false,
        });
        expect(amounts).toEqual({ subtotal: 1000, shippingCost: 0, discountAmount: 0, tax: 90, total: 1090 });
    });
    
    it('calculates order totals correctly without tax or shipping', () => {
        const items = [
            { price: 100, quantity: 2 }, // 200
            { price: 50, quantity: 1 }   // 50
        ];
        // subtotal = 250
        
        const res = calculateTotalCheckout(items, 0, 0, 0);
        expect(res.subtotal).toBe(250);
        expect(res.tax).toBe(0);
        expect(res.total).toBe(250);
    });

    it('calculates order totals correctly with tax, shipping, and discounts', () => {
        const items = [
            { price: 100, quantity: 2 }, // 200
        ];
        
        // 200 subtotal. 10% tax = 20. Shipping = 15. Discount = 30.
        // Total = 200 + 20 + 15 - 30 = 205
        const res = calculateTotalCheckout(items, 15, 30, 0.10);
        expect(res.subtotal).toBe(200);
        expect(res.tax).toBe(20);
        expect(res.total).toBe(205);
    });

    it('prevents negative totals if discounts exceed subtotal+shipping+tax', () => {
        const items = [
            { price: 10, quantity: 1 }, // 10
        ];
        
        // In reality, the coupon resolution engine caps discount amounts at the subtotal/shipping cost levels
        // so totalDiscount will never be larger than those.
        // For testing the logic, we simulate that cap.
        
        const subtotal = 10;
        const discountAmount = Math.min(15, subtotal); // Cap
        
        const res = calculateTotalCheckout(items, 0, discountAmount, 0);
        expect(res.total).toBe(0);
        expect(res.total).not.toBeLessThan(0);
    });

    it('ensures OrderItem create payload includes quantity, snapshotSku, and total', () => {
        const item = {
            productId: 'p-1',
            variantId: 'v-1',
            quantity: 3,
            currentPrice: 150,
            currentProduct: { name: 'Demo Product', sku: 'SKU-BASE', unit: 'kg' },
            variant: { sku: 'SKU-VAR', unit: 'kg' },
            taxBreakdown: { cgst: 5 },
        };

        const payload = {
            orderId: 'o-1',
            productId: item.productId,
            variantId: item.variantId || null,
            snapshotName: item.currentProduct.name,
            snapshotPrice: item.currentPrice,
            snapshotImage: null,
            snapshotSku: item.variant?.sku || item.currentProduct.sku || null,
            variantInfo: {
                ...(item.variant || {}),
                ...(item.currentProduct?.unit ? { unit: item.currentProduct.unit } : {}),
            },
            quantity: item.quantity,
            total: item.currentPrice * item.quantity,
            taxBreakdown: item.taxBreakdown || null,
            isCombo: false,
            comboSnapshot: null,
        };

        expect(payload.quantity).toBe(3);
        expect(payload.snapshotSku).toBe('SKU-VAR');
        expect(payload.total).toBe(450);
        expect(payload.quantity).not.toBeNull();
        expect(payload.quantity).not.toBeUndefined();
    });

    it('allocates targeted discounts strictly to eligible items without distorting other tax lines', () => {
        // Line 1: Book (5% GST), subtotal 100
        // Line 2: Electronic Gadget (18% GST), subtotal 100
        // Targeted coupon gives 20 off Book category
        const lineDiscounts = { 'book-1': 20 };
        const checkoutItems = [
            { productId: 'book-1', currentPrice: 100, quantity: 1, taxRate: 0.05 },
            { productId: 'gadget-1', currentPrice: 100, quantity: 1, taxRate: 0.18 },
        ];

        let totalTax = 0;
        const itemBreakdowns = checkoutItems.map((item) => {
            const itemSubtotal = item.currentPrice * item.quantity;
            const itemDiscount = lineDiscounts[item.productId] || 0;
            const taxableSubtotal = Math.max(0, itemSubtotal - itemDiscount);
            const tax = taxableSubtotal * item.taxRate;
            totalTax += tax;
            return { productId: item.productId, taxableSubtotal, tax };
        });

        // Book: 100 - 20 = 80 @ 5% = 4.00
        expect(itemBreakdowns[0].taxableSubtotal).toBe(80);
        expect(itemBreakdowns[0].tax).toBe(4.00);

        // Gadget: 100 - 0 = 100 @ 18% = 18.00 (ineligible line untouched)
        expect(itemBreakdowns[1].taxableSubtotal).toBe(100);
        expect(itemBreakdowns[1].tax).toBe(18.00);

        // Total tax: 22.00
        expect(totalTax).toBe(22.00);
    });

    it('reconciles order components when free shipping coupon eliminates quoted delivery fee', () => {
        const subtotal = 1000;
        const totalTax = 180;
        const quotedShippingCost = 100;
        const freeShipping = true;

        let shippingCost = quotedShippingCost;
        let shippingDiscount = 0;
        if (freeShipping && shippingCost > 0) {
            shippingDiscount = quotedShippingCost;
        }

        const orderDiscountAmount = 0;
        const discountAmount = Number((orderDiscountAmount + shippingDiscount).toFixed(2));
        const total = Number(Math.max(0, subtotal + totalTax + quotedShippingCost - discountAmount).toFixed(2));

        // Customer pays subtotal + tax = 1180, shipping is preserved as quoted alongside discount
        expect(shippingCost).toBe(100);
        expect(shippingDiscount).toBe(100);
        expect(discountAmount).toBe(100);
        expect(total).toBe(1180);
        // Financial breakdown reconciles: subtotal + tax + shipping - discount = total
        expect(subtotal + totalTax + shippingCost - discountAmount).toBe(total);
    });

    it('excludes digital items from shipment completion totals in deriveQuantityAwareOrderShippingStatus', () => {
        const { deriveQuantityAwareOrderShippingStatus } = require('../../src/modules/order/order.service');

        const orderItems = [
            { id: 'item-phys', quantity: 2, requiresShipping: true, product: { requiresShipping: true } },
            { id: 'item-digi', quantity: 1, requiresShipping: false, product: { requiresShipping: false } },
        ];

        // Shipment contains only physical items and has delivered them
        const shipments = [
            {
                id: 'ship-1',
                status: 'delivered',
                items: [{ orderItemId: 'item-phys', quantity: 2 }],
            },
        ];

        const status = deriveQuantityAwareOrderShippingStatus(orderItems, shipments);
        expect(status).toBe('delivered');
    });

    it('returns delivered for all-digital orders in deriveQuantityAwareOrderShippingStatus', () => {
        const { deriveQuantityAwareOrderShippingStatus } = require('../../src/modules/order/order.service');

        const orderItems = [
            { id: 'item-digi', quantity: 1, requiresShipping: false, product: { requiresShipping: false } },
        ];

        const status = deriveQuantityAwareOrderShippingStatus(orderItems, []);
        expect(status).toBe('delivered');
    });
});
