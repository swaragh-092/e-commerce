import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { cancelOrderSchema } = require('../../src/modules/order/order.validation');

describe('Customer order cancellation validation', () => {
    it('requires a supported cancellation reason', () => {
        expect(cancelOrderSchema.validate({}).error).toBeDefined();
        expect(cancelOrderSchema.validate({ reason: 'not_a_reason' }).error).toBeDefined();
        expect(cancelOrderSchema.validate({ reason: 'changed_mind' }).error).toBeUndefined();
    });

    it('requires a short explanation for Other and limits optional details', () => {
        expect(cancelOrderSchema.validate({ reason: 'other' }).error).toBeDefined();
        expect(cancelOrderSchema.validate({ reason: 'other', reasonDetails: '  no  ' }).error).toBeDefined();
        expect(cancelOrderSchema.validate({ reason: 'other', reasonDetails: '  My reason  ' }).value.reasonDetails).toBe('My reason');
        expect(cancelOrderSchema.validate({ reason: 'changed_mind', reasonDetails: 'x'.repeat(501) }).error).toBeDefined();
    });
});
