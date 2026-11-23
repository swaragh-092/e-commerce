import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createProductSchema, catalogCreateProductSchema, updateProductSchema } = require('../../src/modules/product/product.validation');

const validProduct = {
  name: 'QA product',
  type: 'simple',
  quantity: 1,
  price: 25,
};

// Regression: BUG-13 — blank optional SKUs reached the unique index as "".
// Found by /qa on 2026-11-23.
// Report: user-provided live browser screenshots in this conversation.
describe('optional product SKU validation', () => {
  it.each([createProductSchema, catalogCreateProductSchema])('removes an empty SKU on create', (schema) => {
    const { error, value } = schema.validate({ ...validProduct, sku: '' }, { stripUnknown: true });

    expect(error).toBeUndefined();
    expect(value.sku).toBeUndefined();
  });

  it.each([createProductSchema, catalogCreateProductSchema])('removes a whitespace-only SKU on create', (schema) => {
    const { error, value } = schema.validate({ ...validProduct, sku: '   ' }, { stripUnknown: true });

    expect(error).toBeUndefined();
    expect(value.sku).toBeUndefined();
  });

  it('keeps explicit null when clearing an SKU on update', () => {
    const { error, value } = updateProductSchema.validate({ sku: null }, { stripUnknown: true });

    expect(error).toBeUndefined();
    expect(value.sku).toBeNull();
  });
});
