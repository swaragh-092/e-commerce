import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createProductSchema, catalogCreateProductSchema, updateProductSchema } = require('../../src/modules/product/product.validation');

const productPayload = {
  name: 'QA product',
  type: 'simple',
  quantity: 1,
  price: 25,
  metaTitle: 'Seed product meta title',
  metaDescription: 'Seed product meta description',
};

describe('product SEO metadata validation', () => {
  it.each([createProductSchema, catalogCreateProductSchema])('preserves SEO metadata when creating a product', (schema) => {
    const { error, value } = schema.validate(productPayload, { stripUnknown: true });
    expect(error).toBeUndefined();
    expect(value.metaTitle).toBe(productPayload.metaTitle);
    expect(value.metaDescription).toBe(productPayload.metaDescription);
  });

  it('preserves SEO metadata when updating a product', () => {
    const { error, value } = updateProductSchema.validate({
      metaTitle: productPayload.metaTitle,
      metaDescription: productPayload.metaDescription,
    }, { stripUnknown: true });
    expect(error).toBeUndefined();
    expect(value.metaTitle).toBe(productPayload.metaTitle);
    expect(value.metaDescription).toBe(productPayload.metaDescription);
  });
});
