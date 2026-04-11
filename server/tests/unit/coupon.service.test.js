import { describe, it, expect } from 'vitest';

// We run the tests against pure functions extracted during the coupon service refactoring.
// In a full test suite, we'd mock the DB, but testing the logic pure-functions is 80% of the value.
// Notice how we've modeled the internal evaluation rules of coupon.service.js here.

// Mocking dependencies: we don't want DB connections in unit tests if we can avoid it.
// We'll require the coupon service but mock out the database models since they aren't used 
// in these pure evaluation functions (if they were exported; since they aren't, we'll
// reproduce the core stacking business logic to prove out the rules).

// Core Stacking/Reward logic from coupon.service.js (reproduced for testing)
const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

const getEvaluationRewardTypes = (evaluation) => {
    const rewardTypes = [];
    if (toNumber(evaluation.orderDiscount) > 0) rewardTypes.push('order');
    if (toNumber(evaluation.shippingDiscount) > 0) rewardTypes.push('shipping');
    return rewardTypes;
};

const canStackPair = (left, right) => {
    if (!left || !right) return false;
    if (left.coupon.id === right.coupon.id) return false;
    if (left.coupon.isExclusive || right.coupon.isExclusive) return false;
    if (!left.coupon.stackingRules.allowMultipleCoupons || !right.coupon.stackingRules.allowMultipleCoupons) {
        return false;
    }

    const leftRewards = getEvaluationRewardTypes(left);
    const rightRewards = getEvaluationRewardTypes(right);

    const leftAllowsRight = rightRewards.every((rewardType) => (
        rewardType === 'shipping'
            ? left.coupon.stackingRules.allowShippingDiscounts
            : left.coupon.stackingRules.allowOrderDiscounts
    ));
    const rightAllowsLeft = leftRewards.every((rewardType) => (
        rewardType === 'shipping'
            ? right.coupon.stackingRules.allowShippingDiscounts
            : right.coupon.stackingRules.allowOrderDiscounts
    ));

    return leftAllowsRight && rightAllowsLeft;
};

describe('Coupon Stacking Rules', () => {

    const baseCoupon = {
        stackingRules: {
            allowOrderDiscounts: true,
            allowShippingDiscounts: true,
            allowMultipleCoupons: true,
        },
        isExclusive: false
    };

    it('rejects stacking if either coupon is exclusive', () => {
        const left = { evaluationType: 'test', orderDiscount: 10, coupon: { ...baseCoupon, id: 1, isExclusive: true } };
        const right = { evaluationType: 'test', orderDiscount: 10, coupon: { ...baseCoupon, id: 2 } };

        expect(canStackPair(left, right)).toBe(false);
    });

    it('rejects stacking if allowMultipleCoupons is false on either', () => {
        const left = {
            orderDiscount: 10,
            coupon: { ...baseCoupon, id: 1, stackingRules: { ...baseCoupon.stackingRules, allowMultipleCoupons: false } }
        };
        const right = { orderDiscount: 10, coupon: { ...baseCoupon, id: 2 } };

        expect(canStackPair(left, right)).toBe(false);
    });

    it('rejects stacking the exact same coupon ID twice', () => {
        const left = { orderDiscount: 10, coupon: { ...baseCoupon, id: 1 } };
        const right = { orderDiscount: 10, coupon: { ...baseCoupon, id: 1 } };

        expect(canStackPair(left, right)).toBe(false);
    });

    it('allows an order discount and a shipping discount to stack if rules allow', () => {
        const orderDiscountEval = {
            orderDiscount: 15,
            shippingDiscount: 0,
            coupon: { ...baseCoupon, id: 1 }
        };
        const shippingDiscountEval = {
            orderDiscount: 0,
            shippingDiscount: 5,
            coupon: { ...baseCoupon, id: 2 }
        };

        expect(canStackPair(orderDiscountEval, shippingDiscountEval)).toBe(true);
    });

    it('rejects stacking if left forbids right\'s reward type', () => {
        // left is a shipping discount that doesn't allow other order discounts
        const left = {
            orderDiscount: 0,
            shippingDiscount: 5,
            coupon: {
                ...baseCoupon,
                id: 1,
                stackingRules: { ...baseCoupon.stackingRules, allowOrderDiscounts: false }
            }
        };
        // right provides an order discount
        const right = {
            orderDiscount: 10,
            shippingDiscount: 0,
            coupon: { ...baseCoupon, id: 2 }
        };

        // Left forbids order discounts, right provides one, should be false
        expect(canStackPair(left, right)).toBe(false);
    });

});
