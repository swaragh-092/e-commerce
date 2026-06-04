import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { normalizeDateOnly, isDateOnOrAfter } = require('../../src/modules/order/orderDate.utils');

describe('order date utilities', () => {
    it('normalizes valid date-like values to yyyy-mm-dd', () => {
        expect(normalizeDateOnly('2026-05-29T15:54:00.000Z')).toBe('2026-05-29');
    });

    it('accepts dates on the same day as the order date', () => {
        expect(isDateOnOrAfter('2026-05-29', '2026-05-29T10:30:00.000Z')).toBe(true);
    });

    it('rejects dates before the order date', () => {
        expect(isDateOnOrAfter('2026-05-28', '2026-05-29T10:30:00.000Z')).toBe(false);
    });
});
