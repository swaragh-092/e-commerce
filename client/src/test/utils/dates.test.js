import { describe, expect, it } from 'vitest';
import {
  formatDateOnly,
  formatDateTime,
  formatOpenEndedDateRange,
} from '../../utils/dates';

describe('date utilities', () => {
  it('formats date-only strings consistently', () => {
    expect(formatDateOnly('2026-05-15')).toBe('May 15, 2026');
  });

  it('returns an empty string for invalid date-time values', () => {
    expect(formatDateTime('not-a-date')).toBe('');
  });

  it('formats open-ended date ranges with readable fallbacks', () => {
    expect(formatOpenEndedDateRange(null, '2026-05-31')).toBe('Now - May 31, 2026');
    expect(formatOpenEndedDateRange('2026-05-15', null)).toBe('May 15, 2026 - Indefinite');
    expect(formatOpenEndedDateRange(null, null)).toBe('');
  });
});
