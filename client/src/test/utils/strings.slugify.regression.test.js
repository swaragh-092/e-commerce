import { describe, expect, it } from 'vitest';
import { generateSlug } from '../../utils/strings';

describe('generateSlug', () => {
  it('converts underscores to hyphens for product names', () => {
    expect(generateSlug('QA_TEST_Product_01')).toBe('qa-test-product-01');
  });
});
