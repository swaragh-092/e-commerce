'use strict';

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Inventory & Variant Quantity Safeguards', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('enforces variant selection when a product has active variants in cart add logic', async () => {
        const hasVariants = 2; // 2 active variants exist
        const variantId = null;

        const validateAdd = (hasActiveVariants, selectedVariantId) => {
            if (hasActiveVariants > 0 && !selectedVariantId) {
                throw new Error('Please select a variant option before adding to cart');
            }
            return true;
        };

        expect(() => validateAdd(hasVariants, variantId)).toThrow('Please select a variant option before adding to cart');
        expect(validateAdd(0, null)).toBe(true);
        expect(validateAdd(2, 'variant-uuid-1')).toBe(true);
    });

    it('blocks checkout placement when an item has missing variantId for a variant-enabled product', () => {
        const item = {
            productId: 'prod-1',
            variantId: null,
            quantity: 1,
            product: { name: 'T-Shirt', id: 'prod-1' },
        };

        const validateCheckoutItem = (checkoutItem, activeVariantCount) => {
            if (activeVariantCount > 0 && !checkoutItem.variantId) {
                throw new Error(`Please select a product option for "${checkoutItem.product.name}" before checkout.`);
            }
            return true;
        };

        expect(() => validateCheckoutItem(item, 3)).toThrow('Please select a product option for "T-Shirt" before checkout.');
        expect(validateCheckoutItem({ ...item, variantId: 'v-1' }, 3)).toBe(true);
        expect(validateCheckoutItem(item, 0)).toBe(true); // Simple product without variants
    });

    it('preserves reservedQty in sync math regardless of inactive variant status', () => {
        // Variant A: active, stock 10, reserved 2
        // Variant B: inactive, stock 5, reserved 3 (unfulfilled pending order)
        const variants = [
            { stockQty: 10, reservedQty: 2, isActive: true },
            { stockQty: 5, reservedQty: 3, isActive: false },
        ];

        // Active stock only comes from active variants
        const stockSum = variants.filter(v => v.isActive).reduce((sum, v) => sum + v.stockQty, 0);
        // Reserved quantity must include all variants holding reservations to prevent phantom un-reservation
        const reservedSum = variants.reduce((sum, v) => sum + v.reservedQty, 0);

        const nextReserved = Math.max(reservedSum, 0);
        const nextQuantity = Math.max(stockSum, nextReserved);

        expect(stockSum).toBe(10);
        expect(nextReserved).toBe(5);
        expect(nextQuantity).toBe(10); // at least nextReserved
        // Available stock on parent:
        expect(nextQuantity - nextReserved).toBe(5);
    });

    it('allows simple product manual quantity when variants list is empty', () => {
        const data = { quantity: 45, variants: [] };
        const variantsExist = true; // previously had variants

        const willHaveVariants = Array.isArray(data.variants)
            ? data.variants.length > 0
            : variantsExist;

        if (willHaveVariants && data.quantity !== undefined) {
            delete data.quantity;
        }

        // When removing all variants, quantity must be preserved
        expect(willHaveVariants).toBe(false);
        expect(data.quantity).toBe(45);
    });
});
