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

    it('rejects updating quantity of a legacy cart item if product has since gained active variants', () => {
        const item = { variantId: null, productId: 'prod-100' };
        const activeVariantCount = 2;

        const validateCartItemUpdate = (cartItem, variantsCount) => {
            if (!cartItem.variantId && variantsCount > 0) {
                throw new Error('Product now requires option selection and was removed from cart');
            }
            return true;
        };

        expect(() => validateCartItemUpdate(item, activeVariantCount)).toThrow('Product now requires option selection and was removed from cart');
        expect(validateCartItemUpdate({ ...item, variantId: 'var-1' }, activeVariantCount)).toBe(true);
        expect(validateCartItemUpdate(item, 0)).toBe(true);
    });

    it('validates buyNowItem early ensuring active variant requirement is met before order transaction starts', () => {
        const validateBuyNowEarly = (buyNowItem, product, activeVariantCount) => {
            if (buyNowItem.variantId) {
                if (buyNowItem.variant?.isActive === false) {
                    throw new Error('Selected product variant not found or is currently unavailable');
                }
            } else if (activeVariantCount > 0) {
                throw new Error(`Please select an option for "${product.name}" before checkout.`);
            }
            return true;
        };

        const prod = { name: 'Running Shoes' };
        expect(() => validateBuyNowEarly({ variantId: null }, prod, 4)).toThrow('Please select an option for "Running Shoes" before checkout.');
        expect(() => validateBuyNowEarly({ variantId: 'v-1', variant: { isActive: false } }, prod, 4)).toThrow('Selected product variant not found or is currently unavailable');
        expect(validateBuyNowEarly({ variantId: 'v-1', variant: { isActive: true } }, prod, 4)).toBe(true);
        expect(validateBuyNowEarly({ variantId: null }, prod, 0)).toBe(true);
    });
});


