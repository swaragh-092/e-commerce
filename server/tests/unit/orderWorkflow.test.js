import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
    canCloseOrder,
    getAllowedNextStatuses,
    isPaymentSettled,
    normalizePaymentStatus,
    normalizePutBackRecordStatus,
    PUT_BACK_RECORD_STATUS_VALUES,
    LEGACY_PUT_BACK_STATUS_VALUES,
} = require('../../src/utils/orderWorkflow');

describe('Order workflow - COD payment rules', () => {
    it('keeps delivered COD orders open until COD payment is explicitly settled', () => {
        const order = {
            paymentMethod: 'cod',
            paymentStatus: 'pending_cod',
            orderShippingStatus: 'delivered',
            total: 100,
        };

        expect(isPaymentSettled('pending_cod', 'cod')).toBe(false);
        expect(canCloseOrder({ order, orderShippingStatus: 'delivered' })).toBe(false);
        expect(canCloseOrder({
            order,
            payment: { provider: 'cod', status: 'paid_cod', metadata: { codCollectedAmount: 100 } },
            orderShippingStatus: 'delivered',
        })).toBe(true);
    });

    it('allows only the guarded pending_cod to paid_cod payment transition', () => {
        expect(normalizePaymentStatus('pending', 'cod')).toBe('pending_cod');
        expect(getAllowedNextStatuses('payment', 'pending_cod')).toEqual(['paid_cod']);
        expect(getAllowedNextStatuses('payment', 'paid_cod')).toEqual([]);
    });

    it('allows pickup statuses in return request validation values', () => {
        expect(PUT_BACK_RECORD_STATUS_VALUES).toContain('pickup_scheduled');
        expect(PUT_BACK_RECORD_STATUS_VALUES).toContain('pickup_completed');
        expect(getAllowedNextStatuses('return', 'return_approved')).toEqual(['pickup_scheduled']);
        expect(getAllowedNextStatuses('return', 'pickup_scheduled')).toEqual(['pickup_completed']);
    });

    it('normalizes legacy return and replacement statuses', () => {
        expect(LEGACY_PUT_BACK_STATUS_VALUES).toContain('approved');
        expect(normalizePutBackRecordStatus('approved', 'return')).toBe('return_approved');
        expect(normalizePutBackRecordStatus('completed', 'return')).toBe('return_completed');
        expect(normalizePutBackRecordStatus('approved', 'replacement')).toBe('replacement_approved');
        expect(normalizePutBackRecordStatus('completed', 'replacement')).toBe('replacement_completed');
    });
});
