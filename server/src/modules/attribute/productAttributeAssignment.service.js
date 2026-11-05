'use strict';

const { Op, fn, col, where } = require('sequelize');
const { sequelize, Product, ProductAttribute, AttributeTemplate, AttributeValue } = require('../index');
const { lockUnitSettings, readUnitSettings } = require('../settings/unitCatalog');
const { validateAttributeCategory, validateValueUnit } = require('./attributeUnits');
const { generateSlug } = require('../../utils/slugify');
const AppError = require('../../utils/AppError');
const { assertVariableProduct } = require('../product/productType');
const { lockProductVariantChanges, assertAttributeNotUsedByVariants } = require('./productAttributeUsage');

const normalize = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

// Create the template, its new values, and product assignments together. A
// rejected value rolls everything back; retries reuse existing assignments.
const assignProductAttribute = async (productId, data) => sequelize.transaction(async (transaction) => {
    const isVariantAttr = data.isVariantAttr ?? false;
    await lockUnitSettings(transaction);
    await lockProductVariantChanges(productId, transaction);
    const product = await Product.findByPk(productId, { attributes: ['id', 'type'], transaction, lock: transaction.LOCK.UPDATE });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Save the product before assigning attributes.');
    if (isVariantAttr) assertVariableProduct(product);
    const settings = await readUnitSettings(transaction);
    let template;
    if (data.attributeId) {
        template = await AttributeTemplate.findByPk(data.attributeId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!template) throw new AppError('NOT_FOUND', 404, 'This attribute no longer exists. Choose another attribute.');
    } else {
        const name = data.attribute.name.trim().replace(/\s+/g, ' ');
        const existing = await AttributeTemplate.findOne({ where: where(fn('lower', fn('btrim', col('name'))), normalize(name)), transaction });
        const unitCategory = validateAttributeCategory(data.attribute.unitCategory, settings);
        if (existing) {
            const existingCategory = existing.unitCategory || settings.units.find((unit) => normalize(unit.value) === normalize(existing.unit))?.category || null;
            if (existingCategory !== unitCategory) throw new AppError('CONFLICT', 409, 'An attribute with this name has a different unit category. Select the existing attribute or choose another name.');
            template = existing;
        } else {
            const slug = await generateSlug(name, AttributeTemplate, 'slug', { transaction, paranoid: true });
            template = await AttributeTemplate.create({ name, slug, unitCategory, valueType: data.attribute.valueType || 'auto', displayType: 'auto' }, { transaction });
        }
    }
    const available = await AttributeValue.findAll({ where: { attributeId: template.id }, transaction });
    const allRows = await ProductAttribute.findAll({ where: { productId }, transaction });
    let nextSortOrder = Math.max(-1, ...allRows.map((row) => Number(row.sortOrder || 0))) + 1;
    const selected = new Map();
    for (const item of data.values) {
        let value;
        if (item.valueId) {
            value = available.find((candidate) => candidate.id === item.valueId);
            if (!value) throw new AppError('VALIDATION_ERROR', 400, 'A selected value no longer belongs to this attribute. Refresh the values and try again.');
        } else {
            const unitLabel = validateValueUnit(template, item.unitLabel || template.unit, settings);
            value = available.find((candidate) => normalize(candidate.value) === normalize(item.value));
            if (value && normalize(value.unitLabel || template.unit) !== normalize(unitLabel)) {
                throw new AppError('CONFLICT', 409, `“${item.value}” already exists with another unit. Use a distinct value label.`);
            }
            if (!value) {
                const slug = await generateSlug(item.value, AttributeValue, 'slug', { where: { attributeId: template.id }, transaction });
                value = await AttributeValue.create({
                    attributeId: template.id, value: item.value.trim(), slug, unitLabel,
                    displayLabel: item.displayLabel || null, swatchColor: item.swatchColor || null,
                }, { transaction });
                available.push(value);
            }
        }
        selected.set(value.id, value);
    }
    const existingRows = await ProductAttribute.findAll({ where: { productId, attributeId: template.id, valueId: { [Op.in]: [...selected.keys()] } }, transaction });
    if (!isVariantAttr && existingRows.some((row) => row.attributeId === template.id && selected.has(row.valueId) && row.isVariantAttr)) {
        await assertAttributeNotUsedByVariants(productId, template.id, transaction);
    }
    for (const value of selected.values()) {
        const existing = existingRows.find((row) => row.valueId === value.id);
        if (existing) {
            if (existing.isVariantAttr !== isVariantAttr) await existing.update({ isVariantAttr }, { transaction });
        } else {
            await ProductAttribute.create({ productId, attributeId: template.id, valueId: value.id, isVariantAttr, sortOrder: nextSortOrder++ }, { transaction });
        }
    }
    return ProductAttribute.findAll({ where: { productId }, include: [{ model: AttributeTemplate, as: 'attribute', paranoid: false }, { model: AttributeValue, as: 'value' }], order: [['sortOrder', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']], transaction });
});

module.exports = { assignProductAttribute };
