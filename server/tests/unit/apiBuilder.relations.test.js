import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const apiBuilder = require('../../src/modules/apiBuilder/apiBuilder.service');
const SettingsService = require('../../src/modules/settings/settings.service');
const { Op } = db.Sequelize;

beforeEach(() => {
  vi.spyOn(SettingsService, 'getFeatures').mockResolvedValue({ features: {} });
});

afterEach(() => vi.restoreAllMocks());

const execute = (block) => apiBuilder.executeConfig({ includeMeta: false, blocks: [{ key: 'items', ...block }] });

describe('API Builder relation queries', () => {
  it('loads shared media once and maps results without exposing unselected keys', async () => {
    vi.spyOn(db.ProductImage, 'findAll').mockResolvedValue([
      { id: 'image-1', alt: 'First', mediaId: 'media-1' },
      { id: 'image-2', alt: 'Second', mediaId: 'media-2' },
      { id: 'image-3', alt: 'Shared', mediaId: 'media-1' },
      { id: 'image-4', alt: 'Missing', mediaId: 'deleted-media' },
      { id: 'image-5', alt: 'Unset', mediaId: null },
    ]);
    const media = vi.spyOn(db.Media, 'findAll').mockResolvedValue([
      { id: 'media-2', url: '/second.jpg' },
      { id: 'media-1', url: '/first.jpg' },
    ]);

    const result = await execute({
      resource: 'productImages', fields: ['alt'],
      relations: [{ relation: 'media', key: 'asset', fields: ['url'] }],
    });

    expect(result.items).toEqual([
      { alt: 'First', asset: { url: '/first.jpg' } },
      { alt: 'Second', asset: { url: '/second.jpg' } },
      { alt: 'Shared', asset: { url: '/first.jpg' } },
      { alt: 'Missing', asset: null },
      { alt: 'Unset', asset: null },
    ]);
    expect(media).toHaveBeenCalledTimes(1);
  });

  it('skips relation queries when all foreign keys are absent', async () => {
    vi.spyOn(db.ProductImage, 'findAll').mockResolvedValue([{ id: 'image-1', mediaId: null }]);
    const media = vi.spyOn(db.Media, 'findAll').mockResolvedValue([]);

    const result = await execute({ resource: 'productImages', relations: [{ relation: 'media' }] });

    expect(result.items[0].media).toBeNull();
    expect(media).not.toHaveBeenCalled();
  });

  it('batches nested singular relations at each level', async () => {
    vi.spyOn(db.ProductImage, 'findAll').mockResolvedValue([
      { id: 'image-1', variantId: 'variant-1' },
      { id: 'image-2', variantId: 'variant-2' },
    ]);
    const variants = vi.spyOn(db.ProductVariant, 'findAll').mockResolvedValue([
      { id: 'variant-1', sku: 'FIRST', mediaId: 'media-1' },
      { id: 'variant-2', sku: 'SECOND', mediaId: 'media-2' },
    ]);
    const media = vi.spyOn(db.Media, 'findAll').mockResolvedValue([
      { id: 'media-1', url: '/first.jpg' }, { id: 'media-2', url: '/second.jpg' },
    ]);

    const result = await execute({
      resource: 'productImages', fields: ['id'], relations: [{
        relation: 'variant', fields: ['sku'],
        relations: [{ relation: 'media', fields: ['url'] }],
      }],
    });

    expect(result.items.map((item) => item.variant)).toEqual([
      { sku: 'FIRST', media: { url: '/first.jpg' } },
      { sku: 'SECOND', media: { url: '/second.jpg' } },
    ]);
    expect(variants).toHaveBeenCalledTimes(1);
    expect(media).toHaveBeenCalledTimes(1);
  });

  it('keeps selected IDs and public visibility constraints in batched queries', async () => {
    vi.spyOn(db.Product, 'findAll').mockResolvedValue([{ id: 'product-1', brandId: 'brand-1' }]);
    const brands = vi.spyOn(db.Brand, 'findAll').mockResolvedValue([]);

    await execute({
      resource: 'products',
      relations: [{ relation: 'brand', mode: 'selected', selectedIds: ['brand-2'] }],
    });

    const where = brands.mock.calls[0][0].where;
    expect(where[Op.and]).toEqual([
      { [Op.and]: [{ id: { [Op.in]: ['brand-2'] } }, { isActive: true }] },
      { id: { [Op.in]: ['brand-1'] } },
    ]);
  });

  it('uses the same batched lookup for attribute names and values', async () => {
    vi.spyOn(db.ProductAttribute, 'findAll').mockResolvedValue([
      { id: 'assignment-1', attributeId: 'attribute-1', valueId: 'value-1' },
      { id: 'assignment-2', attributeId: 'attribute-1', valueId: 'value-2' },
    ]);
    const attributes = vi.spyOn(db.AttributeTemplate, 'findAll').mockResolvedValue([{ id: 'attribute-1', name: 'Color' }]);
    const values = vi.spyOn(db.AttributeValue, 'findAll').mockResolvedValue([
      { id: 'value-1', value: 'Red' }, { id: 'value-2', value: 'Blue' },
    ]);

    const result = await execute({
      resource: 'productAttributes', fields: ['id'],
      relations: [{ relation: 'attribute', fields: ['name'] }, { relation: 'value', fields: ['value'] }],
    });

    expect(result.items.map(({ attribute, value }) => ({ attribute, value }))).toEqual([
      { attribute: { name: 'Color' }, value: { value: 'Red' } },
      { attribute: { name: 'Color' }, value: { value: 'Blue' } },
    ]);
    expect(attributes).toHaveBeenCalledTimes(1);
    expect(values).toHaveBeenCalledTimes(1);
  });

  it('preserves per-parent pagination for collection relations', async () => {
    vi.spyOn(db.Product, 'findAll').mockResolvedValue([{ id: 'product-1' }, { id: 'product-2' }]);
    const images = vi.spyOn(db.ProductImage, 'findAndCountAll').mockImplementation(async ({ where }) => ({
      rows: [{ id: `image-for-${where.productId}` }], count: 3,
    }));

    const result = await execute({
      resource: 'products', fields: ['id'],
      relations: [{ relation: 'images', fields: ['id'], pagination: { enabled: true, defaultPageSize: 1 } }],
    });

    expect(result.items.map((item) => item.images.rows[0].id)).toEqual(['image-for-product-1', 'image-for-product-2']);
    expect(result.items.map((item) => item.images.pagination.total)).toEqual([3, 3]);
    expect(images).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])('batches nested lookups across collections (pagination: %s)', async (paginated) => {
    vi.spyOn(db.Product, 'findAll').mockResolvedValue([
      { id: 'product-1', name: 'First' },
      { id: 'product-2', name: 'Empty' },
      { id: 'product-3', name: 'Last' },
    ]);
    const rowsByParent = {
      'product-1': [{ id: 'image-1', mediaId: 'media-1' }, { id: 'image-2', mediaId: 'media-2' }],
      'product-2': [],
      'product-3': [{ id: 'image-3', mediaId: 'media-1' }],
    };
    const counts = { 'product-1': 8, 'product-2': 0, 'product-3': 5 };
    const images = vi.spyOn(db.ProductImage, paginated ? 'findAndCountAll' : 'findAll')
      .mockImplementation(async ({ where }) => paginated
        ? { rows: rowsByParent[where.productId], count: counts[where.productId] }
        : rowsByParent[where.productId]);
    const media = vi.spyOn(db.Media, 'findAll').mockImplementation(async ({ where }) =>
      where[Op.and][1].id[Op.in].map((id) => ({ id, url: `/${id}.jpg` })));

    const result = await execute({
      resource: 'products', fields: ['name'], relations: [{
        relation: 'images', fields: ['id'], limit: 2,
        pagination: { enabled: paginated, defaultPage: 2, defaultPageSize: 2 },
        relations: [{ relation: 'media', fields: ['url'] }],
      }],
    });

    expect(media).toHaveBeenCalledTimes(1);
    expect(result.items.map(({ images: value }) => paginated ? value.rows : value)).toEqual([
      [{ id: 'image-1', media: { url: '/media-1.jpg' } }, { id: 'image-2', media: { url: '/media-2.jpg' } }],
      [],
      [{ id: 'image-3', media: { url: '/media-1.jpg' } }],
    ]);
    expect(images).toHaveBeenCalledTimes(3);
    expect(images.mock.calls.map(([query]) => query.limit)).toEqual([2, 2, 2]);
    if (paginated) {
      expect(result.items.map((item) => item.images.pagination.total)).toEqual([8, 0, 5]);
      expect(images.mock.calls.map(([query]) => query.offset)).toEqual([2, 2, 2]);
    }
  });
});
