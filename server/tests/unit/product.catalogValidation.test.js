import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { createProductSchema, updateProductSchema, getProductWriteSchema } = require('../../src/modules/product/product.validation');
const product = { name: 'Catalog item', type: 'simple', quantity: 0 };

describe('product pricing validation by resolved features', () => {
  it('defaults an unpriced catalog product to zero without accepting negative prices', () => {
    const schema = getProductWriteSchema(createProductSchema, { pricing: false, showPrice: false });
    expect(schema.validate(product).error).toBeUndefined();
    expect(schema.validate(product).value.price).toBe(0);
    expect(schema.validate({ ...product, price: -1 }).error).toBeDefined();
  });
  it.each([{ pricing: true, showPrice: false }, { pricing: false, showPrice: true }, {}])('requires positive MRP with %j', (features) => {
    const schema = getProductWriteSchema(createProductSchema, features);
    expect(schema.validate(product).error).toBeDefined();
    expect(schema.validate({ ...product, price: 0 }).error).toBeDefined();
    expect(schema.validate({ ...product, price: 100 }).error).toBeUndefined();
  });
  it.each(['simple', 'variable', 'combo'])('accepts a %s creation payload with pricing hidden or shown', (type) => {
    for (const showPrice of [false, true]) {
      const schema = getProductWriteSchema(createProductSchema, { pricing: false, showPrice });
      const payload = { name: 'Test item', type, price: showPrice ? 100 : 0, requiresShipping: false };
      if (type === 'simple') payload.quantity = 0;
      expect(schema.validate(payload).error).toBeUndefined();
      if (type !== 'simple') expect(schema.validate({ ...payload, quantity: 0 }).error).toBeDefined();
    }
  });
  it('preserves existing prices on catalog updates when omitted', () => {
    const schema = getProductWriteSchema(updateProductSchema, { pricing: false, showPrice: false });
    expect(schema.validate({ name: 'Renamed' }).value).not.toHaveProperty('price');
    expect(schema.validate({ price: 0 }).error).toBeUndefined();
    expect(schema.validate({ price: -1 }).error).toBeDefined();
  });
});
