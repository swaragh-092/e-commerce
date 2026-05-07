import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
    canCloseOrder,
    getAllowedNextStatuses,
    isPaymentSettled,
    normalizePaymentStatus,
} = require('../../src/utils/orderWorkflow');

describe('Order workflow - COD payment rules', () => {
    it('keeps delivered COD orders open until COD payment is explicitly settled', () => {
        const order = {
            paymentMethod: 'cod',
            paymentStatus: 'pending_cod',
            orderShippingStatus: 'delivered',
        };

        expect(isPaymentSettled('pending_cod', 'cod')).toBe(false);
        expect(canCloseOrder({ order, orderShippingStatus: 'delivered' })).toBe(false);
        expect(canCloseOrder({
            order,
            payment: { provider: 'cod', status: 'paid_cod' },
            orderShippingStatus: 'delivered',
        })).toBe(true);
    });

    it('allows only the guarded pending_cod to paid_cod payment transition', () => {
        expect(normalizePaymentStatus('pending', 'cod')).toBe('pending_cod');
        expect(getAllowedNextStatuses('payment', 'pending_cod')).toEqual(['paid_cod']);
        expect(getAllowedNextStatuses('payment', 'paid_cod')).toEqual([]);
    });
});
