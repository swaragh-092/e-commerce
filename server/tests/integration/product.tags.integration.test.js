import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Opt in only against the dedicated temporary PostgreSQL instance documented in
// docs/plans/product-tags.md. Never use the project's configured database.
const socket = process.env.TAG_TEST_POSTGRES_SOCKET;
if (socket) {
  process.env.NODE_ENV = 'test';
  process.env.DB_HOST = socket;
  process.env.DB_PORT = '55438';
  process.env.DB_USER = 'tag_test_admin';
  process.env.DB_PASSWORD = '';
  process.env.DB_NAME = 'ecommerce_tags';
}
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const tags = require('../../src/modules/product/tag.service');
const originalMigration = require('../../migrations/20260228100010-create-tags');
const descriptionMigration = require('../../migrations/20261028100000-add-tag-description');
const legacyTagId = randomUUID();

describe.skipIf(!socket)('product tags against isolated PostgreSQL', () => {
  beforeAll(async () => {
    await db.sequelize.query("CREATE TABLE products (id UUID PRIMARY KEY, deleted_at TIMESTAMPTZ, status VARCHAR(20) NOT NULL DEFAULT 'published', is_enabled BOOLEAN NOT NULL DEFAULT TRUE)");
    const queryInterface = db.sequelize.getQueryInterface();
    await originalMigration.up(queryInterface, db.Sequelize);
    await db.sequelize.query("INSERT INTO tags (id, name, slug) VALUES (:id, 'Legacy tag', 'legacy-tag')", { replacements: { id: legacyTagId } });
    await descriptionMigration.up(queryInterface, db.Sequelize);
  });
  afterAll(async () => { await db.sequelize.close(); });

  it('migrates existing tags with an empty description while preserving names and slugs', async () => {
    const legacy = await db.Tag.findByPk(legacyTagId);
    expect(legacy.name).toBe('Legacy tag');
    expect(legacy.slug).toBe('legacy-tag');
    expect(legacy.description).toBe('');
    await legacy.destroy();
  });

  it('reuses concurrent case variants, counts live products, preserves links after rename and deletes only associations', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    await db.sequelize.query('INSERT INTO products (id, deleted_at) VALUES (:a, NULL), (:b, NULL), (:c, NOW())', {
      replacements: { a: ids[0], b: ids[1], c: ids[2] },
    });
    const products = ids.map((id) => db.Product.build({ id }, { isNewRecord: false }));
    await Promise.all(products.map((product, index) => db.sequelize.transaction((transaction) => tags.syncProductTags(product, [index % 2 ? 'SUMMER' : ' Summer '], transaction))));
    expect(await db.Tag.count()).toBe(1);
    expect(await db.ProductTag.count()).toBe(3);
    const dictionary = await tags.listTags({ page: 1, limit: 20 });
    const tag = dictionary.rows[0];
    expect(tag.get('productCount')).toBe(2);
    const originalSlug = tag.slug;
    await tags.renameTag(tag.id, 'Warm Season');
    expect((await db.Tag.findByPk(tag.id)).slug).toBe(originalSlug);
    const predicate = tags.buildTagFilter(originalSlug);
    const [filtered] = await db.sequelize.query(`SELECT "Product".id FROM products AS "Product" WHERE "Product".deleted_at IS NULL AND ${predicate.val}`);
    expect(filtered.map((product) => product.id).sort()).toEqual(ids.slice(0, 2).sort());
    const before = await db.ProductTag.count();
    await db.sequelize.transaction((transaction) => tags.syncProductTags(products[0], undefined, transaction));
    expect(await db.ProductTag.count()).toBe(before);
    await db.sequelize.transaction((transaction) => tags.syncProductTags(products[0], [], transaction));
    expect(await db.ProductTag.count()).toBe(2);
    await tags.deleteTag(tag.id);
    expect(await db.Tag.count()).toBe(0);
    expect(await db.ProductTag.count()).toBe(0);
    const [remaining] = await db.sequelize.query('SELECT COUNT(*)::int AS count FROM products');
    expect(remaining[0].count).toBe(3);
  });
  it('bulk edits preserve unrelated tags, roll back limit failures and serialize overlapping selections', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    await db.sequelize.query('INSERT INTO products (id, deleted_at) VALUES (:a, NULL), (:b, NULL), (:c, NOW())', {
      replacements: { a: ids[0], b: ids[1], c: ids[2] },
    });
    const products = ids.slice(0, 2).map((id) => db.Product.build({ id }, { isNewRecord: false }));
    const labels = async (product) => (await product.getTags()).map((tag) => tag.name).sort();
    await db.sequelize.transaction((transaction) => tags.syncProductTags(products[0], ['Organic'], transaction));
    await db.sequelize.transaction((transaction) => tags.syncProductTags(products[1], ['Rare'], transaction));
    const payload = { productIds: ids.slice(0, 2), action: 'add', tags: ['Summer'] };
    expect(await tags.bulkUpdateProductTags(payload)).toEqual({ selectedCount: 2, updatedCount: 2, changedCount: 2 });
    expect(await labels(products[0])).toEqual(['Organic', 'Summer']);
    expect(await labels(products[1])).toEqual(['Rare', 'Summer']);
    expect(await tags.bulkUpdateProductTags(payload)).toEqual({ selectedCount: 2, updatedCount: 0, changedCount: 0 });
    expect(await tags.bulkUpdateProductTags({ ...payload, action: 'remove', tags: ['organic'] })).toEqual({ selectedCount: 2, updatedCount: 1, changedCount: 1 });
    expect(await labels(products[0])).toEqual(['Summer']);
    expect(await labels(products[1])).toEqual(['Rare', 'Summer']);
    const count = await db.Tag.count();
    await tags.bulkUpdateProductTags({ ...payload, action: 'remove', tags: ['Unknown removal'] });
    expect(await db.Tag.count()).toBe(count);

    await db.sequelize.transaction((transaction) => tags.syncProductTags(products[0], ['Summer', ...Array.from({ length: 49 }, (_, n) => `Limit ${n}`)], transaction));
    await expect(tags.bulkUpdateProductTags({ ...payload, tags: ['Rollback label'] })).rejects.toMatchObject({ statusCode: 400 });
    expect(await db.Tag.findOne({ where: { name: 'Rollback label' } })).toBeNull();
    expect(await labels(products[1])).toEqual(['Rare', 'Summer']);
    await expect(tags.bulkUpdateProductTags({ ...payload, productIds: [ids[0], ids[2]], tags: ['Missing product label'] })).rejects.toMatchObject({ statusCode: 409 });
    expect(await db.Tag.findOne({ where: { name: 'Missing product label' } })).toBeNull();

    await db.sequelize.transaction((transaction) => tags.syncProductTags(products[0], [], transaction));
    await Promise.all([
      tags.bulkUpdateProductTags({ ...payload, tags: ['Batch A'] }),
      tags.bulkUpdateProductTags({ ...payload, productIds: [...payload.productIds].reverse(), tags: ['Batch B'] }),
    ]);
    expect(await labels(products[0])).toEqual(['Batch A', 'Batch B']);
    expect(await labels(products[1])).toEqual(['Batch A', 'Batch B', 'Rare', 'Summer']);
  });

  it('publishes tag metadata only when at least one attached product is visible', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    await db.sequelize.query("INSERT INTO products (id, status, is_enabled, deleted_at) VALUES (:a, 'published', TRUE, NULL), (:b, 'published', FALSE, NULL), (:c, 'draft', TRUE, NULL), (:d, 'published', TRUE, NOW())", {
      replacements: { a: ids[0], b: ids[1], c: ids[2], d: ids[3] },
    });
    const visible = await tags.addTag('Public collection', 'Introduction to the collection.');
    const hidden = await tags.addTag('Internal collection', 'Private campaign.');
    const unused = await tags.addTag('Unused collection');
    const products = ids.map((id) => db.Product.build({ id }, { isNewRecord: false }));
    await db.sequelize.transaction((transaction) => tags.syncProductTags(products[0], [visible.name], transaction));
    for (const product of products.slice(1)) await db.sequelize.transaction((transaction) => tags.syncProductTags(product, [hidden.name], transaction));
    expect((await tags.getPublicTagBySlug(visible.slug)).description).toBe('Introduction to the collection.');
    await expect(tags.getPublicTagBySlug(hidden.slug)).rejects.toMatchObject({ statusCode: 404 });
    await expect(tags.getPublicTagBySlug(unused.slug)).rejects.toMatchObject({ statusCode: 404 });
    const publicSlugs = (await tags.getPublicTags()).map((tag) => tag.slug);
    expect(publicSlugs).toContain(visible.slug);
    expect(publicSlugs).not.toContain(hidden.slug);
    expect(publicSlugs).not.toContain(unused.slug);
    await tags.renameTag(visible.id, 'Updated collection', 'New introduction');
    expect((await tags.getPublicTagBySlug(visible.slug)).description).toBe('New introduction');
  });

  it('prioritizes canonical slugs over another tag with a matching legacy name', async () => {
    const ids = [randomUUID(), randomUUID()];
    await db.sequelize.query('INSERT INTO products (id) VALUES (:a), (:b)', { replacements: { a: ids[0], b: ids[1] } });
    const canonical = await db.Tag.create({ name: 'Gift Box', slug: 'gift-box' });
    const legacy = await db.Tag.create({ name: 'gift-box', slug: 'gift-box-1' });
    await db.ProductTag.bulkCreate([{ productId: ids[0], tagId: canonical.id }, { productId: ids[1], tagId: legacy.id }]);
    const predicate = tags.buildTagFilter('gift-box');
    const [matches] = await db.sequelize.query(`SELECT "Product".id FROM products AS "Product" WHERE ${predicate.val}`);
    expect(matches.map((product) => product.id)).toEqual([ids[0]]);
  });

});
