'use strict';

const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const { Product, ProductVariant, VariantOption, ProductAttribute, AttributeValue, sequelize } = require('../index');
const AppError = require('../../utils/AppError');
const { assertVariableProduct } = require('../product/productType');
const { orderedRows } = require('./productAttributeOrder');
const { syncParentProductFromVariants } = require('../inventory/inventory.service');

const pair = (option) => `${option.attributeId}:${option.valueId}`;
const signature = (options) => options.map(pair).sort().join('|');
const dimensions = (options) => options.map((option) => option.attributeId).sort().join('|');

const cloneProductVariants = async (targetId, sourceId) => {
    if (targetId === sourceId) throw new AppError('VALIDATION_ERROR', 400, 'Choose another product as the copy source.');
    return sequelize.transaction(async (transaction) => {
        const ids = [targetId, sourceId].sort();
        for (const productId of ids) await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:scope), hashtext(:productId))', { replacements: { scope: 'product-variant-generation', productId }, transaction });
        // Match inventory's variant-before-parent lock order, including cross-copy requests.
        const variants = await ProductVariant.findAll({
            where: { productId: { [Op.in]: ids } }, include: [{ model: VariantOption, as: 'options' }],
            order: [['productId', 'ASC'], ['id', 'ASC']], transaction,
            lock: { level: transaction.LOCK.UPDATE, of: ProductVariant },
        });
        const products = await Product.findAll({ where: { id: { [Op.in]: ids } }, order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE });
        const target = products.find((product) => product.id === targetId);
        const source = products.find((product) => product.id === sourceId);
        if (!target || !source) throw new AppError('NOT_FOUND', 404, 'Source or target product no longer exists.');
        assertVariableProduct(target);
        if (source.type === 'combo') throw new AppError('VALIDATION_ERROR', 400, 'Choose a product with variants, not a bundle.');
        const sourceVariants = variants.filter((variant) => variant.productId === sourceId).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.id).localeCompare(String(b.id)));
        const targetVariants = variants.filter((variant) => variant.productId === targetId);
        if (!sourceVariants.length) throw new AppError('VALIDATION_ERROR', 400, 'Source product has no variants to copy.');
        const required = new Map();
        const sourceDimensions = dimensions(sourceVariants[0].options || []);
        for (const variant of sourceVariants) {
            const options = variant.options || [];
            if (!options.length || options.some((option) => !option.attributeId || !option.valueId)
                || new Set(options.map((option) => option.attributeId)).size !== options.length || dimensions(options) !== sourceDimensions) {
                throw new AppError('VALIDATION_ERROR', 400, 'Source variants have incomplete or inconsistent options. Fix the source combinations before copying.');
            }
            options.forEach((option) => required.set(pair(option), option));
        }
        if (targetVariants.some((variant) => dimensions(variant.options || []) !== sourceDimensions)) {
            throw new AppError('VALIDATION_ERROR', 400, 'Existing target variants use different attributes. Choose a target with matching combinations or an empty Variable Product.');
        }
        const values = await AttributeValue.findAll({ where: { id: { [Op.in]: [...required.values()].map((option) => option.valueId) } }, transaction });
        const validPairs = new Set(values.map((value) => `${value.attributeId}:${value.id}`));
        if ([...required.keys()].some((key) => !validPairs.has(key))) throw new AppError('VALIDATION_ERROR', 400, 'A source option no longer belongs to its attribute. Refresh and fix the source product.');
        const assignments = await ProductAttribute.findAll({ where: { productId: { [Op.in]: ids } }, transaction, lock: transaction.LOCK.UPDATE });
        const targetRows = assignments.filter((row) => row.productId === targetId);
        const sourceRows = orderedRows(assignments.filter((row) => row.productId === sourceId));
        const sourceAttributeIds = new Set([...required.values()].map((option) => option.attributeId));
        if (targetRows.some((row) => row.isVariantAttr && row.attributeId && !sourceAttributeIds.has(row.attributeId))) {
            throw new AppError('VALIDATION_ERROR', 400, 'The target has other attributes enabled for variants. Turn those off before copying these combinations.');
        }
        const seen = new Set(targetVariants.map((variant) => signature(variant.options || [])));
        const additions = sourceVariants.filter((variant) => {
            const key = signature(variant.options);
            if (seen.has(key)) return false;
            seen.add(key); return true;
        });
        if (targetVariants.length + additions.length > 500) throw new AppError('VALIDATION_ERROR', 400, 'Copying would exceed 500 variants. Choose a smaller source or target product.');
        const ranks = new Map(sourceRows.map((row, index) => [pair(row), index]));
        let attributeOrder = Math.max(-1, ...targetRows.map((row) => Number(row.sortOrder || 0))) + 1;
        let addedAssignments = 0;
        for (const option of [...required.values()].sort((a, b) => (ranks.get(pair(a)) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(pair(b)) ?? Number.MAX_SAFE_INTEGER))) {
            const existing = targetRows.find((row) => pair(row) === pair(option));
            if (existing) {
                if (!existing.isVariantAttr) await existing.update({ isVariantAttr: true }, { transaction });
            } else {
                await ProductAttribute.create({ productId: targetId, attributeId: option.attributeId, valueId: option.valueId, isVariantAttr: true, sortOrder: attributeOrder++ }, { transaction });
                addedAssignments++;
            }
        }
        let variantOrder = Math.max(-1, ...targetVariants.map((variant) => Number(variant.sortOrder || 0))) + 1;
        const baseSku = String(target.sku || target.name || 'VAR').trim().replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 63) || 'VAR';
        for (const variant of additions) {
            const created = await ProductVariant.create({
                productId: targetId, price: variant.price, stockQty: 0, reservedQty: 0,
                sku: `${baseSku}-${randomUUID().replace(/-/g, '').toUpperCase()}`,
                sortOrder: variantOrder++, isActive: variant.isActive !== false,
                weightGrams: variant.weightGrams ?? null, lengthCm: variant.lengthCm ?? null,
                breadthCm: variant.breadthCm ?? null, heightCm: variant.heightCm ?? null,
            }, { transaction });
            await VariantOption.bulkCreate(variant.options.map((option) => ({ variantId: created.id, attributeId: option.attributeId, valueId: option.valueId })), { transaction });
        }
        await syncParentProductFromVariants(targetId, transaction);
        return { createdCount: additions.length, skippedCount: sourceVariants.length - additions.length, addedAssignments };
    });
};

module.exports = { cloneProductVariants };
