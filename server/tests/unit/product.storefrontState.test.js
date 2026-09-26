import { createRequire } from 'node:module';
import Joi from 'joi';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { createProductSchema, updateProductSchema, bulkUpdateSchema } = require('../../src/modules/product/product.validation');
const {
  applyProductStorefrontFilters,
  buildProductStorefrontCountsWhere,
  mapProductStorefrontCounts,
} = require('../../src/modules/product/product.storefrontState');
const { Product } = require('../../src/modules');

describe('product storefront state validation', () => {
  it('rejects Archived on create while accepting it for update and bulk update', () => {
    const createResult = createProductSchema.validate({
      name: 'Legacy item',
      price: 10,
      type: 'simple',
      status: 'archived',
      quantity: 1,
    });
    const updateResult = updateProductSchema.validate({ status: 'archived' });
    const bulkResult = bulkUpdateSchema.validate({
      productIds: ['5f4dcc3b-5aa7-4d6a-bdb6-46fd5e7edaa1'],
      data: { status: 'archived', isEnabled: false },
    });

    expect(createResult.error).toBeInstanceOf(Joi.ValidationError);
    expect(updateResult.error).toBeUndefined();
    expect(bulkResult.error).toBeUndefined();
  });

  it('rejects unknown states for product updates', () => {
    expect(updateProductSchema.validate({ status: 'paused' }).error).toBeInstanceOf(Joi.ValidationError);
    expect(bulkUpdateSchema.validate({
      productIds: ['5f4dcc3b-5aa7-4d6a-bdb6-46fd5e7edaa1'],
      data: { status: 'paused' },
    }).error).toBeInstanceOf(Joi.ValidationError);
  });
});

describe('product model status validation', () => {
  it('allows Archived for existing products and rejects unsupported states', async () => {
    await expect(Product.build({ status: 'archived' }).validate({ fields: ['status'] })).resolves.toBeDefined();
    await expect(Product.build({ status: 'paused' }).validate({ fields: ['status'] })).rejects.toThrow();
  });
});

describe('product storefront list filters', () => {
  it('keeps public listings published and enabled', () => {
    expect(applyProductStorefrontFilters({}, { status: 'archived' }, false)).toEqual({
      status: 'published',
      isEnabled: true,
    });
  });

  it.each([
    ['published', { status: 'published', isEnabled: true }],
    ['paused', { status: 'published', isEnabled: false }],
    ['draft', { status: 'draft' }],
    ['archived', { status: 'archived' }],
    ['', {}],
  ])('applies the admin %s filter', (status, expected) => {
    expect(applyProductStorefrontFilters({}, { status }, true)).toEqual(expected);
  });

  it('lets an explicit isEnabled filter override the derived published filter', () => {
    expect(applyProductStorefrontFilters({}, { status: 'published', isEnabled: 'false' }, true)).toEqual({
      status: 'published',
      isEnabled: false,
    });
  });
});

describe('product storefront count query filters', () => {
  it.each([
    ['published', { status: 'published', isEnabled: true, search: 'item' }, { search: 'item' }],
    ['paused', { status: 'published', isEnabled: false, categoryId: 'category-id' }, { categoryId: 'category-id' }],
    ['archived', { status: 'archived', isEnabled: false }, { isEnabled: false }],
  ])('preserves shared filters and counts all states for %s', (status, where, expected) => {
    expect(buildProductStorefrontCountsWhere(where, { status })).toEqual(expected);
  });
});

describe('product storefront summary counts', () => {
  it('splits published counts by enabled state and preserves other statuses', () => {
    expect(mapProductStorefrontCounts([
      { status: 'published', isEnabled: true, count: '4' },
      { status: 'published', isEnabled: 'false', count: '2' },
      { status: 'draft', isEnabled: true, count: '3' },
      { status: 'archived', isEnabled: false, count: 1 },
    ])).toEqual({ published: 4, paused: 2, draft: 3, archived: 1 });
  });

  it('returns zeroed state counts when the database has no grouped rows', () => {
    expect(mapProductStorefrontCounts()).toEqual({ published: 0, paused: 0, draft: 0, archived: 0 });
  });
});
