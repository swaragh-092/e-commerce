import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { searchQuerySchema } = require('../../src/modules/search/search.validation');

describe('search query validation', () => {
  it('normalizes before returning a valid query', () => {
    const result = searchQuerySchema.validate({ q: '  Ｆlower\u200B\t market  ' });

    expect(result.error).toBeUndefined();
    expect(result.value.q).toBe('Flower market');
  });

  it('rejects queries outside the normalized length bounds', () => {
    expect(searchQuerySchema.validate({ q: 'a\u200B' }).error).toBeDefined();
    expect(searchQuerySchema.validate({ q: 'ﬀ'.repeat(51) }).error).toBeDefined();
    expect(searchQuerySchema.validate({ q: 'x'.repeat(101) }).error).toBeDefined();
  });
});
