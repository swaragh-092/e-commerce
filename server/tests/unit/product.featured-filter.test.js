import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const service = require('../../src/modules/product/product.service');
const controller = require('../../src/modules/product/product.controller');
const { productListQuerySchema } = require('../../src/modules/product/product.validation');

afterEach(() => vi.restoreAllMocks());

describe('featured product listing', () => {
  it('validates and forwards the featured filter to the product service', async () => {
    const { value, error } = productListQuerySchema.validate({ featured: 'true', status: 'published' });
    expect(error).toBeUndefined();
    const getProducts = vi.spyOn(service, 'getProducts').mockResolvedValue({
      data: [], totalItems: 0, currentPage: 1, totalPages: 0,
    });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await controller.list({ query: value }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(getProducts).toHaveBeenCalledWith(expect.objectContaining({ featured: true, status: 'published' }), 1, 20, false);
  });

  it('rejects invalid featured filters', () => {
    expect(productListQuerySchema.validate({ featured: 'arbitrary' }).error).toBeDefined();
  });
});
