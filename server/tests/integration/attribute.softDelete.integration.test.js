import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Opt in against a disposable localhost PostgreSQL instance, never the project database.
const port = process.env.ATTRIBUTE_TEST_POSTGRES_PORT;
const databaseBase = `attribute_soft_delete_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
if (port) {
    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = port;
    process.env.DB_USER = 'postgres';
    process.env.DB_PASSWORD = '';
    process.env.DB_NAME = databaseBase;
}
const require = createRequire(import.meta.url);
const db = require('../../src/modules');
const service = require('../../src/modules/attribute/attribute.service');
const productAttributes = require('../../src/modules/attribute/productAttribute.service');
const assignment = require('../../src/modules/attribute/productAttributeAssignment.service');
const templateMigration = require('../../migrations/20260314120000-create-attribute-templates');
const valueMigration = require('../../migrations/20260314120001-create-attribute-values');
const metadataMigration = require('../../migrations/20260511120000-add-attribute-display-metadata');
const migration = require('../../migrations/20261030170000-soft-delete-attribute-templates');
const repairMigration = require('../../migrations/20261030180000-restore-attached-attribute-templates');

describe.skipIf(!port)('attribute soft deletion against isolated PostgreSQL', () => {
    let qi;
    let legacyId;
    const createFixtureTable = async (model) => {
        // Include real model columns without requiring unrelated application tables or fixtures.
        const columns = Object.fromEntries(Object.values(model.rawAttributes).map((attribute) => [attribute.field, {
            type: attribute.type, allowNull: attribute.allowNull !== false, primaryKey: attribute.primaryKey,
            ...(attribute.defaultValue !== undefined ? { defaultValue: attribute.defaultValue } : {}),
        }]));
        await qi.createTable(model.getTableName(), columns);
    };
    beforeAll(async () => {
        const admin = new db.Sequelize('postgres', 'postgres', '', { host: '127.0.0.1', port, dialect: 'postgres', logging: false });
        try { await admin.query(`CREATE DATABASE "${databaseBase}_test"`); }
        finally { await admin.close(); }
        qi = db.sequelize.getQueryInterface();
        await templateMigration.up(qi, db.Sequelize);
        await valueMigration.up(qi, db.Sequelize);
        await metadataMigration.up(qi, db.Sequelize);
        await qi.addColumn('attribute_templates', 'unit_category', { type: db.Sequelize.STRING(50), allowNull: true });
        // Include a legacy standalone unique index as well as the original constraints.
        await qi.addIndex('attribute_templates', ['name'], { unique: true, name: 'legacy_attribute_name_unique' });
        const [legacy] = await db.sequelize.query("INSERT INTO attribute_templates (name, slug) VALUES ('Legacy', 'legacy') RETURNING id");
        legacyId = legacy[0].id;
        await migration.up(qi, db.Sequelize);
        for (const model of [db.Setting, db.Product, db.ProductVariant, db.Media, db.ProductImage, db.ProductAttribute, db.VariantOption, db.Category, db.CategoryAttribute]) {
            await createFixtureTable(model);
        }
        for (const table of ['product_attributes', 'variant_options']) {
            await qi.addConstraint(table, { fields: ['attribute_id'], type: 'foreign key',
                references: { table: 'attribute_templates', field: 'id' }, onDelete: 'CASCADE' });
        }
    }, 30000);
    afterAll(async () => { await db.sequelize.close(); });

    it('preserves existing templates and safely round-trips the schema before names are reused', async () => {
        expect((await service.getAttributeById(legacyId)).name).toBe('Legacy');
        await migration.down(qi, db.Sequelize);
        expect((await qi.describeTable('attribute_templates')).deleted_at).toBeUndefined();
        await migration.up(qi, db.Sequelize);
        expect((await service.getAttributeById(legacyId)).slug).toBe('legacy');
    });

    it('blocks an attached template until its product is deleted, then preserves history and allows name reuse', async () => {
        const template = await service.createAttribute({ name: 'Size', unitCategory: null });
        const value = await service.addValue(template.id, { value: 'Large' });
        const product = await db.Product.create({ name: 'Seeds', slug: 'seeds', type: 'variable', price: 100 });
        const variant = await db.ProductVariant.create({ productId: product.id, price: 100, stockQty: 5, sku: 'SEED-L' });
        await db.ProductAttribute.create({ productId: product.id, attributeId: template.id, valueId: value.id, isVariantAttr: true });
        await db.VariantOption.create({ variantId: variant.id, attributeId: template.id, valueId: value.id });
        const category = await db.Category.create({ name: 'Seeds', slug: 'seeds' });
        await db.CategoryAttribute.create({ categoryId: category.id, attributeId: template.id });
        const before = await service.previewVariantGeneration(product.id);

        await expect(service.deleteAttribute(template.id)).rejects.toMatchObject({ statusCode: 409 });
        expect(await db.AttributeTemplate.findByPk(template.id)).not.toBeNull();
        expect(await service.previewVariantGeneration(product.id)).toEqual(before);
        await product.destroy();
        await service.deleteAttribute(template.id);
        expect(await db.AttributeTemplate.findByPk(template.id)).toBeNull();
        expect((await db.AttributeTemplate.findByPk(template.id, { paranoid: false })).deletedAt).toBeInstanceOf(Date);
        expect(await db.AttributeValue.count({ where: { attributeId: template.id } })).toBe(1);
        expect(await db.ProductAttribute.count({ where: { attributeId: template.id } })).toBe(1);
        expect(await db.VariantOption.count({ where: { attributeId: template.id } })).toBe(1);
        expect(await db.CategoryAttribute.count({ where: { attributeId: template.id } })).toBe(1);
        expect((await service.getAllAttributes({ search: 'Size' })).count).toBe(0);
        expect(await service.getCategoryAttributes(category.id)).toEqual([]);
        const detail = await db.ProductAttribute.findOne({ where: { productId: product.id }, include: [
            { model: db.AttributeTemplate, as: 'attribute', paranoid: false }, { model: db.AttributeValue, as: 'value' },
        ] });
        expect(detail.attribute.name).toBe('Size');
        expect(detail.value.value).toBe('Large');
        const existing = await db.ProductVariant.findByPk(variant.id, { include: [{ model: db.VariantOption, as: 'options', include: [
            { model: db.AttributeTemplate, as: 'attribute', paranoid: false }, { model: db.AttributeValue, as: 'value' },
        ] }] });
        expect(existing.options[0].attribute.name).toBe('Size');
        expect(existing.options[0].value.value).toBe('Large');
        expect(existing).toMatchObject({ sku: 'SEED-L', stockQty: 5 });

        const replacement = await service.createAttribute({ name: 'Size', unitCategory: null });
        expect(replacement.id).not.toBe(template.id);
        expect(replacement.slug).toBe('size');
        expect((await service.getAttributeById(replacement.id)).values).toHaveLength(0);
        const newValue = await service.addValue(replacement.id, { value: 'Large' });
        expect(newValue.id).not.toBe(value.id);
        expect((await db.ProductAttribute.findOne({ where: { productId: product.id } })).valueId).toBe(value.id);
        expect((await service.getAllAttributes({ search: 'Size' })).rows.map(row => row.id)).toEqual([replacement.id]);
        await expect(service.createAttribute({ name: 'Size' })).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('active attribute template') });
        await expect(db.AttributeTemplate.create({ name: 'Other name', slug: 'size' })).rejects.toMatchObject({ name: 'SequelizeUniqueConstraintError' });
        await expect(migration.down(qi, db.Sequelize)).rejects.toThrow('Cannot undo attribute soft deletion');
        expect((await qi.describeTable('attribute_templates')).deleted_at).toBeDefined();
        expect(await db.AttributeTemplate.count({ paranoid: false, where: { name: 'Size' } })).toBe(2);
    });

    it.each(['draft', 'published', 'archived'])('blocks deletion for non-deleted %s products even when hidden', async status => {
        const template = await service.createAttribute({ name: `Attached ${status}` });
        const value = await service.addValue(template.id, { value: 'Value' });
        const product = await db.Product.create({ name: `Product ${status}`, slug: `product-${status}`, type: 'simple', status, isEnabled: false });
        await db.ProductAttribute.create({ productId: product.id, attributeId: template.id, valueId: value.id });
        await expect(service.deleteAttribute(template.id)).rejects.toMatchObject({ statusCode: 409 });
        expect(await db.AttributeTemplate.findByPk(template.id)).not.toBeNull();
        await product.destroy();
        await service.deleteAttribute(template.id);
        expect(await db.AttributeTemplate.findByPk(template.id)).toBeNull();
    });

    it('blocks variant-only links, including inactive variants, until no live variant uses the attribute', async () => {
        const template = await service.createAttribute({ name: 'Variant only' });
        const value = await service.addValue(template.id, { value: 'Value' });
        const product = await db.Product.create({ name: 'Variant parent', slug: 'variant-parent', type: 'variable', price: 100 });
        const variant = await db.ProductVariant.create({ productId: product.id, price: 100, stockQty: 0, isActive: false });
        await db.VariantOption.create({ variantId: variant.id, attributeId: template.id, valueId: value.id });
        await expect(service.deleteAttribute(template.id)).rejects.toMatchObject({ statusCode: 409 });
        await variant.destroy();
        await service.deleteAttribute(template.id);
        expect(await db.VariantOption.count({ where: { attributeId: template.id } })).toBe(1);
        expect(await db.Product.findByPk(product.id)).not.toBeNull();
    });

    it('ignores deleted products but still blocks any remaining product assignment until detached', async () => {
        const template = await service.createAttribute({ name: 'Shared attribute' });
        const value = await service.addValue(template.id, { value: 'Value' });
        const removed = await db.Product.create({ name: 'Removed parent', slug: 'removed-parent', type: 'simple' });
        const remaining = await db.Product.create({ name: 'Remaining parent', slug: 'remaining-parent', type: 'simple' });
        await db.ProductAttribute.create({ productId: removed.id, attributeId: template.id, valueId: value.id });
        const link = await db.ProductAttribute.create({ productId: remaining.id, attributeId: template.id, valueId: value.id });
        await removed.destroy();
        await expect(service.deleteAttribute(template.id)).rejects.toMatchObject({ statusCode: 409 });
        await productAttributes.deleteProductAttribute(remaining.id, link.id);
        await service.deleteAttribute(template.id);
        expect(await db.ProductAttribute.count({ where: { attributeId: template.id } })).toBe(1);
        expect(await db.Product.findByPk(remaining.id)).not.toBeNull();
    });

    it('rejects stale editing and assignment requests for a deleted template without modifying its values', async () => {
        const template = await service.createAttribute({ name: 'Deleted height', unitCategory: null });
        const value = await service.addValue(template.id, { value: 'Tall' });
        const product = await db.Product.create({ name: 'Other seeds', slug: 'other-seeds', type: 'variable', price: 100 });
        await service.deleteAttribute(template.id);
        for (const action of [
            () => service.getAttributeById(template.id),
            () => service.updateAttribute(template.id, { name: 'Changed' }),
            () => service.addValue(template.id, { value: 'Short' }),
            () => service.updateValue(template.id, value.id, { value: 'Changed' }),
            () => service.removeValue(template.id, value.id),
            () => service.reorderValues(template.id, [value.id]),
            () => productAttributes.addProductAttribute(product.id, { attributeId: template.id, valueId: value.id }),
            () => assignment.assignProductAttribute(product.id, { attributeId: template.id, values: [{ valueId: value.id }] }),
        ]) await expect(action()).rejects.toMatchObject({ statusCode: 404 });
        expect((await db.AttributeValue.findByPk(value.id)).value).toBe('Tall');
        expect(await db.ProductAttribute.count({ where: { productId: product.id } })).toBe(0);

        await assignment.assignProductAttribute(product.id, { attribute: { name: 'Deleted height' }, values: [{ value: 'Short' }] });
        const replacement = await db.AttributeTemplate.findOne({ where: { name: 'Deleted height' } });
        expect(replacement.id).not.toBe(template.id);
        expect(replacement.slug).toBe('deleted-height');
    });

    it('repairs earlier soft deletions on attached templates so existing products can add values again', async () => {
        const template = await service.createAttribute({ name: 'Repair attached' });
        const value = await service.addValue(template.id, { value: 'Old value' });
        const product = await db.Product.create({ name: 'Repair parent', slug: 'repair-parent', type: 'variable', price: 100 });
        await db.ProductAttribute.create({ productId: product.id, attributeId: template.id, valueId: value.id });
        await template.destroy(); // Simulate the earlier behavior before usage protection.
        await repairMigration.up(qi);
        expect((await service.getAttributeById(template.id)).name).toBe('Repair attached');
        await assignment.assignProductAttribute(product.id, { attributeId: template.id, values: [{ value: 'New value' }] });
        const rows = await productAttributes.getProductAttributes(product.id);
        expect(rows.map(row => row.value.value).sort()).toEqual(['New value', 'Old value']);
        await expect(service.deleteAttribute(template.id)).rejects.toMatchObject({ statusCode: 409 });
        await repairMigration.down(qi);
        expect(await db.AttributeTemplate.findByPk(template.id)).not.toBeNull();
    });

    it('does not overwrite an active replacement while repairing an attached template with a reused name', async () => {
        const template = await service.createAttribute({ name: 'Repair conflict' });
        const value = await service.addValue(template.id, { value: 'Old value' });
        const product = await db.Product.create({ name: 'Conflict parent', slug: 'conflict-parent', type: 'simple' });
        await db.ProductAttribute.create({ productId: product.id, attributeId: template.id, valueId: value.id });
        await template.destroy();
        const replacement = await service.createAttribute({ name: 'Repair conflict' });
        await expect(repairMigration.up(qi)).rejects.toThrow('Resolve the duplicate name/slug');
        expect(await db.AttributeTemplate.findByPk(template.id)).toBeNull();
        expect((await db.AttributeTemplate.findByPk(replacement.id)).name).toBe('Repair conflict');
        expect(await db.ProductAttribute.count({ where: { attributeId: template.id } })).toBe(1);
    });
});
