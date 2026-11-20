import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const seo = require('../../src/modules/seo/seo.service');
const gate = require('../../src/middleware/featureGate.middleware');
const brands = require('../../src/modules/brand/brand.service');
const galleries = require('../../src/modules/gallery/gallery.service');
const { createBrandSchema, updateBrandSchema } = require('../../src/modules/brand/brand.validation');
const { createGallerySchema, updateGallerySchema } = require('../../src/modules/gallery/gallery.validation');
const migration = require('../../migrations/20261120100000-add-brand-gallery-seo');
const meta = { metaTitle: 'Custom title', metaDescription: 'Custom description', metaKeywords: 'seeds, gardens', ogImage: '/uploads/share.jpg' };

beforeEach(() => {
  vi.spyOn(seo, '_getGlobalDefaults').mockResolvedValue({ title: 'Shop', description: 'Default', canonicalBaseUrl: 'https://shop.test' });
  vi.spyOn(db.SeoOverride, 'findOne').mockResolvedValue(null);
  vi.spyOn(gate, 'getResolvedFeature').mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks());

describe('Brand and gallery SEO persistence', () => {
  it.each([
    [createBrandSchema, { name: 'Brand' }], [updateBrandSchema, {}],
    [createGallerySchema, { title: 'Album', slug: 'album' }], [updateGallerySchema, {}],
  ])('validates custom fields and allows clearing them', (schema, required) => {
    expect(schema.validate({ ...required, ...meta }).error).toBeUndefined();
    expect(schema.validate({ ...required, metaTitle: null, ogImage: '' }).error).toBeUndefined();
    expect(schema.validate({ ...required, metaDescription: 'x'.repeat(501) }).error).toBeDefined();
    expect(schema.validate({ ...required, ogImage: 'javascript:alert(1)' }).error).toBeDefined();
  });

  it('updates brand SEO, preserves omitted fields, and supports clearing', async () => {
    const tx = { commit: vi.fn(), rollback: vi.fn() };
    vi.spyOn(db.Brand.sequelize, 'transaction').mockResolvedValue(tx);
    const update = vi.fn();
    vi.spyOn(db.Brand, 'findByPk').mockResolvedValue({ name: 'Brand', slug: 'brand', ...meta, update });
    await brands.updateBrand('brand', { metaTitle: 'New title', ogImage: null });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ metaTitle: 'New title', ogImage: null }), { transaction: tx });
    expect(update.mock.calls[0][0]).not.toHaveProperty('metaDescription');
  });

  it('passes gallery SEO through create and public detail reads', async () => {
    vi.spyOn(db.Gallery, 'findOne').mockResolvedValue(null);
    const create = vi.spyOn(db.Gallery, 'create').mockResolvedValue({ id: 'album' });
    await galleries.createGallery({ title: 'Album', slug: 'album', ...meta });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ ...meta, isShowcase: true }));
    db.Gallery.findOne.mockResolvedValue({ id: 'album', ...meta });
    vi.spyOn(db.GalleryItem, 'findAndCountAll').mockResolvedValue({ rows: [], count: 0 });
    expect((await galleries.getPublicGallery('album', 1, 20)).gallery).toMatchObject(meta);
  });

  it('adds nullable fields and rolls back both tables in one transaction', async () => {
    const transaction = {};
    const query = { sequelize: { transaction: vi.fn(fn => fn(transaction)) }, addColumn: vi.fn(), removeColumn: vi.fn() };
    await migration.up(query, db.Sequelize);
    expect(query.addColumn).toHaveBeenCalledTimes(8);
    expect(query.addColumn).toHaveBeenCalledWith('galleries', 'meta_title', expect.objectContaining({ allowNull: true }), { transaction });
    await migration.down(query);
    expect(query.removeColumn).toHaveBeenCalledTimes(8);
  });
});

describe('Public SEO metadata', () => {
  it('uses custom brand fields for crawler metadata', async () => {
    vi.spyOn(db.Brand, 'findOne').mockResolvedValue({ name: 'Brand', ...meta });
    expect(await seo.getMetadataByPath('/brands/brand')).toMatchObject({ title: meta.metaTitle, description: meta.metaDescription, keywords: meta.metaKeywords, ogImage: 'https://shop.test/uploads/share.jpg' });
  });
  it('resolves an album query without collapsing it to the gallery listing', async () => {
    const find = vi.spyOn(db.Gallery, 'findOne').mockResolvedValue({ title: 'Album', ...meta });
    const data = await seo.getMetadataByPath('/demo-orbis-seeds-v1-html/gallery-detail.html?album=fresh-fruits&page=2');
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ where: { slug: 'fresh-fruits', isActive: true, isShowcase: true } }));
    expect(data).toMatchObject({ title: meta.metaTitle, description: meta.metaDescription, schemaType: 'ImageGallery', canonicalUrl: 'https://shop.test/demo-orbis-seeds-v1-html/gallery-detail.html?album=fresh-fruits' });
  });
  it('keeps legacy album links canonical and uses fallbacks for empty SEO', async () => {
    vi.spyOn(db.Gallery, 'findOne').mockResolvedValue({ title: 'Flowers', description: 'Flower photos', coverImage: { url: '/flowers.jpg' } });
    expect(await seo.getMetadataByPath('/gallery.html?album=flowers')).toMatchObject({ title: 'Flowers', description: 'Flower photos', ogImage: 'https://shop.test/flowers.jpg', canonicalUrl: 'https://shop.test/gallery-detail.html?album=flowers' });
  });
  it('never exposes hidden albums or disabled galleries through metadata', async () => {
    const find = vi.spyOn(db.Gallery, 'findOne').mockResolvedValue(null);
    await expect(seo.getMetadataByPath('/gallery-detail.html?album=hidden')).rejects.toMatchObject({ statusCode: 404 });
    gate.getResolvedFeature.mockResolvedValue(false);
    find.mockClear();
    await expect(seo.getMetadataByPath('/gallery-detail.html?album=flowers')).rejects.toMatchObject({ statusCode: 404 });
    expect(find).not.toHaveBeenCalled();
  });
});
