import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { createProductSchema, catalogCreateProductSchema, updateProductSchema, getProductWriteSchema } = require('../../src/modules/product/product.validation');
const product = { name: 'Catalog item', type: 'simple', quantity: 0 };

describe('product pricing validation by resolved features', () => {
  it('defaults an unpriced catalog product to null and accepts zero placeholders', () => {
    const schema = getProductWriteSchema(createProductSchema, { pricing: false, showPrice: false });
    expect(schema.validate(product).error).toBeUndefined();
    expect(schema.validate(product).value.price).toBeNull();
    expect(schema.validate({ ...product, price: null }).error).toBeUndefined();
    expect(schema.validate({ ...product, price: 0 }).error).toBeUndefined();
    expect(schema.validate({ ...product, price: -1 }).error).toBeDefined();
  });
  it.each([{ pricing: true, showPrice: false }, {}])('requires positive MRP with %j', (features) => {
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
    expect(schema.validate({ price: null }).error).toBeUndefined();
    expect(schema.validate({ price: -1 }).error).toBeDefined();
  });
  it('accepts null or zero from catalog create clients and defaults missing price to null', () => {
    for (const price of [undefined, null, 0]) {
      const payload = { name: 'Catalog item', type: 'simple', quantity: 0 };
      if (price !== undefined) payload.price = price;
      const result = catalogCreateProductSchema.validate(payload);
      expect(result.error).toBeUndefined();
      expect(result.value.price).toBe(price ?? null);
    }
    expect(catalogCreateProductSchema.validate({ ...product, price: -1 }).error).toBeDefined();
  });
});
