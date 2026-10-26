import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const { createProductSchema, catalogCreateProductSchema, updateProductSchema, getProductWriteSchema } = require('../../src/modules/product/product.validation');
const product = { name: 'Catalog item', type: 'simple', quantity: 0 };
const settingsService = require('../../src/modules/settings/settings.service');
const productRoutes = require('../../src/modules/product/product.routes');

afterEach(() => vi.restoreAllMocks());

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

  it.each([false, true])('lets the POST route save a Variable product before variants (pricing=%s)', async (pricing) => {
    vi.spyOn(settingsService, 'getFeatures').mockResolvedValue({ features: { pricing } });
    const route = productRoutes.stack.find((layer) => layer.route?.path === '/' && layer.route.methods.post).route;
    const validateWrite = route.stack[2].handle;
    const req = { body: { name: 'Shirt', type: 'variable', price: pricing ? 100 : 0, requiresShipping: false } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await validateWrite(req, res, next);
    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
    expect(req.validated.type).toBe('variable');
    expect(req.validated).not.toHaveProperty('quantity');
    expect(req.validated).not.toHaveProperty('variants');
  });

  it('allows catalog variants later while keeping their option and stock validation', () => {
    const payload = { name: 'Shirt', type: 'variable', requiresShipping: false };
    expect(catalogCreateProductSchema.validate(payload).error).toBeUndefined();
    expect(catalogCreateProductSchema.validate({ ...payload, variants: [] }).error).toBeUndefined();
    const variant = { options: [{ attributeId: '11111111-1111-4111-8111-111111111111', valueId: '22222222-2222-4222-8222-222222222222' }] };
    const result = catalogCreateProductSchema.validate({ ...payload, variants: [variant] });
    expect(result.error).toBeUndefined();
    expect(result.value.variants[0].price).toBe(0);
    expect(catalogCreateProductSchema.validate({ ...payload, variants: [{ options: [] }] }).error).toBeDefined();
    expect(catalogCreateProductSchema.validate({ ...payload, variants: [{ ...variant, stockQty: -1 }] }).error).toBeDefined();
    expect(catalogCreateProductSchema.validate({ ...payload, quantity: 10 }).error).toBeDefined();
    expect(catalogCreateProductSchema.validate({ ...product, variants: [] }).error).toBeDefined();
  });
});
