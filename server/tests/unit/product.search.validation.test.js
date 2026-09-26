import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { productListQuerySchema } = require('../../src/modules/product/product.validation');
const { searchQuerySchema } = require('../../src/modules/search/search.validation');

describe('product-list search query validation', () => {
  it('applies the shared minimum after normalization', () => {
    const productListResult = productListQuerySchema.validate({ search: 'a' });
    const fullSearchResult = searchQuerySchema.validate({ q: 'a' });
    const normalizedProductListResult = productListQuerySchema.validate({ search: 'a\u200B' });
    const normalizedFullSearchResult = searchQuerySchema.validate({ q: 'a\u200B' });
    const validProductListResult = productListQuerySchema.validate({ search: 'ab' });
    const validFullSearchResult = searchQuerySchema.validate({ q: 'ab' });

    expect(productListResult.error).toBeDefined();
    expect(fullSearchResult.error).toBeDefined();
    expect(normalizedProductListResult.error).toBeDefined();
    expect(normalizedFullSearchResult.error).toBeDefined();
    expect(validProductListResult.error).toBeUndefined();
    expect(validFullSearchResult.error).toBeUndefined();
  });

  it('accepts raw input longer than 100 characters when normalization reduces it to 100', () => {
    const rawQuery = `  ${'x'.repeat(100)}  `;
    const productListResult = productListQuerySchema.validate({ search: rawQuery });
    const fullSearchResult = searchQuerySchema.validate({ q: rawQuery });
    const tooLongQuery = 'x'.repeat(101);

    expect(productListQuerySchema.validate({ search: tooLongQuery }).error).toBeDefined();
    expect(searchQuerySchema.validate({ q: tooLongQuery }).error).toBeDefined();
    expect(productListResult.error).toBeUndefined();
    expect(productListResult.value.search).toBe('x'.repeat(100));
    expect(fullSearchResult.error).toBeUndefined();
    expect(fullSearchResult.value.q).toBe('x'.repeat(100));
  });

  it('still permits an omitted or empty product-list search filter', () => {
    expect(productListQuerySchema.validate({}).error).toBeUndefined();
    expect(productListQuerySchema.validate({ search: '' }).error).toBeUndefined();
  });
});
