import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const tags = require('../../src/modules/product/tag.service');
const { tagWriteSchema, tagSlugSchema } = require('../../src/modules/product/tag.validation');
const migration = require('../../migrations/20261028100000-add-tag-description');
afterEach(() => vi.restoreAllMocks());

describe('public tag visibility', () => {
  it('limits lookups and sitemap tags to published, enabled, undeleted products', async () => {
    const tag = { id: 'tag', name: 'Summer', slug: 'summer', description: 'Warm-weather products' };
    vi.spyOn(db.Tag, 'findOne').mockResolvedValue(tag);
    vi.spyOn(db.Tag, 'findAll').mockResolvedValue([]);
    expect(await tags.getPublicTagBySlug('summer')).toBe(tag);
    await tags.getPublicTags();
    const lookup = db.Tag.findOne.mock.calls[0][0];
    const sitemap = db.Tag.findAll.mock.calls[0][0];
    expect(lookup.attributes).toEqual(['id', 'name', 'slug', 'description', 'imageId']);
    const sql = lookup.where[db.Sequelize.Op.and][0].val;
    expect(sql).toContain("p.status = 'published'");
    expect(sql).toContain('p.is_enabled = TRUE');
    expect(sql).toContain('p.deleted_at IS NULL');
    expect(sitemap.where[db.Sequelize.Op.and][0].val).toBe(sql);
  });
  it('returns 404 for unknown and non-public tags', async () => {
    vi.spyOn(db.Tag, 'findOne').mockResolvedValue(null);
    await expect(tags.getPublicTagBySlug('internal')).rejects.toMatchObject({ statusCode: 404 });
  });
  it('exposes only the slug lookup before authentication, keeping the dictionary protected', () => {
    const router = require('../../src/modules/product/tag.routes');
    const { authenticate } = require('../../src/middleware/auth.middleware');
    const authIndex = router.stack.findIndex((layer) => layer.handle === authenticate);
    const publicIndex = router.stack.findIndex((layer) => layer.route?.path === '/public/:slug');
    const dictionaryIndex = router.stack.findIndex((layer) => layer.route?.path === '/');
    expect(publicIndex).toBeLessThan(authIndex);
    expect(dictionaryIndex).toBeGreaterThan(authIndex);
    expect(router.stack.filter((layer, index) => index < authIndex && layer.route).map((layer) => layer.route.path)).toEqual(['/public/:slug']);
  });
});

describe('tag descriptions and migration', () => {
  it('accepts a bounded optional description and validates public slugs', () => {
    expect(tagWriteSchema.validate({ name: 'Summer', description: '  Warm weather  ' }).value.description).toBe('Warm weather');
    expect(tagWriteSchema.validate({ name: 'Summer', description: '' }).error).toBeUndefined();
    expect(tagWriteSchema.validate({ name: 'Summer', description: null }).error).toBeUndefined();
    expect(tagWriteSchema.validate({ name: 'Summer', description: 'x'.repeat(2001) }).error).toBeDefined();
    expect(tagSlugSchema.validate({ slug: 'summer-planting' }).error).toBeUndefined();
    for (const slug of ['../secret', 'summer/extra', 'x'.repeat(101)]) expect(tagSlugSchema.validate({ slug }).error).toBeDefined();
  });
  it('persists and explicitly clears descriptions while preserving slugs', async () => {
    const transaction = {};
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback(transaction));
    vi.spyOn(db.sequelize, 'query').mockResolvedValue([]);
    vi.spyOn(db.Tag, 'findOne').mockResolvedValue(null);
    vi.spyOn(db.Tag, 'create').mockImplementation(async (data) => data);
    const existing = { id: 'tag', update: vi.fn() };
    vi.spyOn(db.Tag, 'findByPk').mockResolvedValue(existing);
    expect(await tags.addTag('Summer', 'Warm weather')).toMatchObject({ description: 'Warm weather', slug: 'summer' });
    await tags.renameTag('tag', 'Summer', 'New introduction');
    expect(existing.update).toHaveBeenLastCalledWith({ name: 'Summer', description: 'New introduction' }, { transaction });
    await tags.renameTag('tag', 'Summer', null);
    expect(existing.update).toHaveBeenLastCalledWith({ name: 'Summer', description: '' }, { transaction });
  });
  it('adds a safe default for existing rows and defines a reversible migration', async () => {
    const queryInterface = { addColumn: vi.fn(), removeColumn: vi.fn() };
    await migration.up(queryInterface, db.Sequelize);
    expect(queryInterface.addColumn).toHaveBeenCalledWith('tags', 'description', { type: db.Sequelize.TEXT, allowNull: false, defaultValue: '' });
    await migration.down(queryInterface);
    expect(queryInterface.removeColumn).toHaveBeenCalledWith('tags', 'description');
  });
  it('validates images, preserves omitted images, and permits removal', async () => {
    const transaction = {};
    vi.spyOn(db.sequelize, 'transaction').mockImplementation(async (callback) => callback(transaction));
    vi.spyOn(db.sequelize, 'query').mockResolvedValue([]);
    vi.spyOn(db.Tag, 'findOne').mockResolvedValue(null);
    const existing = { id: 'tag', update: vi.fn() };
    vi.spyOn(db.Tag, 'findByPk').mockResolvedValue(existing);
    const image = vi.spyOn(db.Media, 'findByPk').mockResolvedValue({ type: 'image', mimeType: 'image/jpeg' });
    await tags.renameTag('tag', 'Summer', undefined, 'image');
    expect(existing.update).toHaveBeenLastCalledWith({ name: 'Summer', imageId: 'image' }, { transaction });
    await tags.renameTag('tag', 'Summer');
    expect(existing.update).toHaveBeenLastCalledWith({ name: 'Summer' }, { transaction });
    await tags.renameTag('tag', 'Summer', undefined, null);
    expect(existing.update).toHaveBeenLastCalledWith({ name: 'Summer', imageId: null }, { transaction });
    image.mockResolvedValue(null);
    await expect(tags.renameTag('tag', 'Summer', undefined, 'missing')).rejects.toMatchObject({ statusCode: 400 });
    image.mockResolvedValue({ type: 'font', mimeType: 'font/woff2' });
    await expect(tags.renameTag('tag', 'Summer', undefined, 'font')).rejects.toMatchObject({ statusCode: 400 });
    expect(tagWriteSchema.validate({ name: 'Summer', imageId: 'invalid' }).error).toBeDefined();
    expect(tagWriteSchema.validate({ name: 'Summer', imageId: null }).error).toBeUndefined();
  });
  it('adds a nullable media reference which clears when media is deleted', async () => {
    const imageMigration = require('../../migrations/20261029120000-add-tag-image');
    const transaction = {};
    const queryInterface = { sequelize: { transaction: async (fn) => fn(transaction) }, addColumn: vi.fn(), addIndex: vi.fn(), removeColumn: vi.fn() };
    await imageMigration.up(queryInterface, db.Sequelize);
    expect(queryInterface.addColumn).toHaveBeenCalledWith('tags', 'image_id', expect.objectContaining({ allowNull: true, onDelete: 'SET NULL', references: { model: 'media', key: 'id' } }), { transaction });
    await imageMigration.down(queryInterface);
    expect(queryInterface.removeColumn).toHaveBeenCalledWith('tags', 'image_id');
  });

});
