import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { validateShippingSetting } = require('../../src/modules/shipping/shipping.settings');

describe('Shipping configuration validation', () => {
    it.each([
        ['pricingMode', 'legacy'], ['method', 'unknown'], ['flatRate', -1],
        ['flatRate', ''], ['freeThreshold', null], ['flatRate', Infinity],
        ['serviceablePincodes', '560001,123'], ['blockedPincodes', ['560001', '']],
        ['blockedPincodes', {}],
    ])('rejects malformed %s', (key, value) => {
        expect(() => validateShippingSetting(key, value)).toThrow();
    });
    it.each([
        ['pricingMode', 'standard'], ['pricingMode', 'rules'], ['flatRate', 0],
        ['freeThreshold', 500], ['serviceablePincodes', ''],
        ['blockedPincodes', ' 560001, 600001 '], ['serviceablePincodes', ['560001']],
        ['defaultPackageId', 'box-medium'], ['defaultPackageId', ''],
        ['defaultPackageId', null],
    ])('accepts valid %s', (key, value) => {
        expect(() => validateShippingSetting(key, value)).not.toThrow();
    });
    it.each([
        ['defaultPackageId', 42], ['defaultPackageId', '   '],
        ['defaultPackageId', 'x'.repeat(101)],
    ])('rejects malformed %s', (key, value) => {
        expect(() => validateShippingSetting(key, value)).toThrow();
    });
});
