import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { buildSearchPattern, normalizeSearchQuery } = require('../../src/modules/search/search.utils');

describe('search utilities', () => {
  it('normalizes Unicode, controls, invisible characters, and whitespace', () => {
    expect(normalizeSearchQuery('  Ｆruit\t\u200B  market  ')).toBe('Fruit market');
  });

  it('escapes SQL LIKE wildcard characters in partial-match patterns', () => {
    expect(buildSearchPattern('20%_off\\')).toBe('%20\\%\\_off\\\\%');
  });
});
