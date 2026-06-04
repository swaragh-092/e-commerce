import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { gatewayIdParamSchema } = require('../../src/modules/payment/payment.validation');

describe('payment gateway param validation', () => {
    it('accepts supported gateway ids', () => {
        const { error } = gatewayIdParamSchema.validate({ id: 'stripe' });
        expect(error).toBeUndefined();
    });

    it('rejects uuid-only expectations for gateway ids', () => {
        const { error } = gatewayIdParamSchema.validate({ id: 'not-a-gateway' });
        expect(error).toBeDefined();
    });
});
