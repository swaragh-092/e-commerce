import { describe, expect, it } from 'vitest';
import normalizeSearchQuery from '../../utils/searchQuery';

describe('normalizeSearchQuery', () => {
  it('normalizes Unicode, controls, invisible characters, and whitespace', () => {
    expect(normalizeSearchQuery('  Ｆruit\t\u200B  market  ')).toBe('Fruit market');
  });

  it('returns an empty query for non-string values', () => {
    expect(normalizeSearchQuery(null)).toBe('');
    expect(normalizeSearchQuery(12)).toBe('');
  });
});
