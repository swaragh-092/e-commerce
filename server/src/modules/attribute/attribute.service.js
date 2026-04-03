'use strict';

const { AttributeTemplate, AttributeValue, CategoryAttribute, Category, Product, ProductVariant, sequelize } = require('../index');
const { generateSlug } = require('../../utils/slugify');
const AppError = require('../../utils/AppError');

/**
 * Attribute Template CRUD
 */
const createAttribute = async (data) => {
    const slug = await generateSlug(data.name, AttributeTemplate);
    return AttributeTemplate.create({ ...data, slug });
};

const getAllAttributes = async (page = 1, limit = 20) => {
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, Math.max(1, parseInt(limit, 10)));
    const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
    return AttributeTemplate.findAndCountAll({
        include: [{ model: AttributeValue, as: 'values', attributes: ['id', 'value', 'slug', 'sortOrder'] }],
        order: [['sortOrder', 'ASC'], [{ model: AttributeValue, as: 'values' }, 'sortOrder', 'ASC']],
        limit: safeLimit,
        offset,
        distinct: true,
    });
};

const getAttributeById = async (id) => {
    const attr = await AttributeTemplate.findByPk(id, {
        include: [{ model: AttributeValue, as: 'values', attributes: ['id', 'value', 'slug', 'sortOrder'] }],
    });
    if (!attr) throw new AppError('NOT_FOUND', 404, 'Attribute not found');
    return attr;
};

const updateAttribute = async (id, data) => {
    const attr = await getAttributeById(id);
    if (data.name && data.name !== attr.name) {
        data.slug = await generateSlug(data.name, AttributeTemplate);
    }
    await attr.update(data);
    return attr;
};

const deleteAttribute = async (id) => {
    const attr = await getAttributeById(id);
    await attr.destroy();
};

/**
 * Attribute Value CRUD
 */
const addValue = async (attributeId, data) => {
    await getAttributeById(attributeId); // ensure attribute exists
    const slug = await generateSlug(data.value, AttributeValue);
    return AttributeValue.create({ ...data, attributeId, slug });
};

const removeValue = async (attributeId, valueId) => {
    const val = await AttributeValue.findOne({ where: { id: valueId, attributeId } });
    if (!val) throw new AppError('NOT_FOUND', 404, 'Attribute value not found');
    await val.destroy();
};

/**
 * Category-Attribute linking
 */
const linkAttributeToCategory = async (categoryId, attributeId) => {
    const category = await Category.findByPk(categoryId);
    if (!category) throw { statusCode: 404, message: 'Category not found' };

    await getAttributeById(attributeId); // ensure attribute exists

    const existing = await CategoryAttribute.findOne({ where: { categoryId, attributeId } });
    if (existing) throw new AppError('CONFLICT', 409, 'Attribute already linked to this category');

    return CategoryAttribute.create({ categoryId, attributeId });
};

const unlinkAttributeFromCategory = async (categoryId, attributeId) => {
    const link = await CategoryAttribute.findOne({ where: { categoryId, attributeId } });
    if (!link) throw new AppError('NOT_FOUND', 404, 'Attribute link not found');
    await link.destroy();
};

/**
 * Get attributes for a category with inheritance.
 * Walks UP the category tree and collects all linked attributes.
 * Deduplicates by attribute ID.
 */
const getCategoryAttributes = async (categoryId, inherit = false) => {
    const category = await Category.findByPk(categoryId);
    if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');

    let categoryIds = [categoryId];

    if (inherit) {
        // Walk up the parent chain
        let current = category;
        while (current.parentId) {
            categoryIds.push(current.parentId);
            current = await Category.findByPk(current.parentId);
            if (!current) break;
        }
    }

    // Get all attribute IDs linked to these categories
    const links = await CategoryAttribute.findAll({
        where: { categoryId: categoryIds },
        attributes: ['attributeId'],
    });

    // Deduplicate
    const uniqueAttrIds = [...new Set(links.map((l) => l.attributeId))];

    if (uniqueAttrIds.length === 0) return [];

    // Fetch full attributes with values
    return AttributeTemplate.findAll({
        where: { id: uniqueAttrIds },
        include: [{ model: AttributeValue, as: 'values', attributes: ['id', 'value', 'slug', 'sortOrder'] }],
        order: [['sortOrder', 'ASC'], [{ model: AttributeValue, as: 'values' }, 'sortOrder', 'ASC']],
    });
};

/**
 * Bulk Variant Generator.
 * Takes selected attribute name/value combos and generates the cartesian product
 * as product_variants rows.
 *
 * Example: Color: [Red, Dark Red], Size: [Small, Medium]
 * → 4 variants: Red+Small, Red+Medium, Dark Red+Small, Dark Red+Medium
 */
const bulkGenerateVariants = async (productId, attributes) => {
    const product = await Product.findByPk(productId);
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');

    const t = await sequelize.transaction();
    try {
        // Clear existing variants for this product
        await ProductVariant.destroy({ where: { productId }, transaction: t });

        // Create unique name+value pairs (deduplicated)
        const seen = new Set();
        const createdVariants = [];

        for (const attr of attributes) {
            for (const value of attr.values) {
                const key = `${attr.name}::${value}`;
                if (seen.has(key)) continue;
                seen.add(key);

                const variant = await ProductVariant.create({
                    productId,
                    name: attr.name,
                    value: value,
                    priceModifier: 0,
                    quantity: 0,
                }, { transaction: t });
                createdVariants.push(variant);
            }
        }

        await t.commit();
        return createdVariants;
    } catch (err) {
        await t.rollback();
        throw err;
    }
};

/**
 * Clone variants from one product to another.
 */
const cloneVariants = async (targetProductId, sourceProductId) => {
    const sourceProduct = await Product.findByPk(sourceProductId);
    if (!sourceProduct) throw new AppError('NOT_FOUND', 404, 'Source product not found');

    const targetProduct = await Product.findByPk(targetProductId);
    if (!targetProduct) throw new AppError('NOT_FOUND', 404, 'Target product not found');

    const sourceVariants = await ProductVariant.findAll({ where: { productId: sourceProductId } });
    if (sourceVariants.length === 0) throw new AppError('VALIDATION_ERROR', 400, 'Source product has no variants to clone');

    const t = await sequelize.transaction();
    try {
        const cloned = [];
        for (const sv of sourceVariants) {
            const variant = await ProductVariant.create({
                productId: targetProductId,
                name: sv.name,
                value: sv.value,
                priceModifier: sv.priceModifier,
                quantity: 0, // quantities don't carry over — must be set per product
                sku: null,   // SKU must be unique, so don't clone it
            }, { transaction: t });
            cloned.push(variant);
        }

        await t.commit();
        return cloned;
    } catch (err) {
        await t.rollback();
        throw err;
    }
};

/**
 * Helper: Cartesian product of attribute arrays.
 * Input:  [{ name: 'Color', values: ['Red', 'Blue'] }, { name: 'Size', values: ['S', 'M'] }]
 * Output: [[{name:'Color',value:'Red'},{name:'Size',value:'S'}], ...]
 */
const cartesian = (attributes) => {
    if (attributes.length === 0) return [[]];

    const [first, ...rest] = attributes;
    const restCombos = cartesian(rest);

    const result = [];
    for (const value of first.values) {
        for (const combo of restCombos) {
            result.push([{ name: first.name, value }, ...combo]);
        }
    }
    return result;
};

/**
 * Per-product variant CRUD (single row operations)
 */
const getProductVariants = async (productId) => {
    const product = await Product.findByPk(productId);
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    return ProductVariant.findAll({
        where: { productId },
        order: [['createdAt', 'ASC']],
    });
};

const addProductVariant = async (productId, data) => {
    const product = await Product.findByPk(productId);
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    return ProductVariant.create({ ...data, productId });
};

const updateProductVariant = async (productId, variantId, data) => {
    const variant = await ProductVariant.findOne({ where: { id: variantId, productId } });
    if (!variant) throw new AppError('NOT_FOUND', 404, 'Variant not found');
    await variant.update(data);
    return variant;
};

const deleteProductVariant = async (productId, variantId) => {
    const variant = await ProductVariant.findOne({ where: { id: variantId, productId } });
    if (!variant) throw new AppError('NOT_FOUND', 404, 'Variant not found');
    await variant.destroy();
};

module.exports = {
    createAttribute,
    getAllAttributes,
    getAttributeById,
    updateAttribute,
    deleteAttribute,
    addValue,
    removeValue,
    linkAttributeToCategory,
    unlinkAttributeFromCategory,
    getCategoryAttributes,
    bulkGenerateVariants,
    cloneVariants,
    getProductVariants,
    addProductVariant,
    updateProductVariant,
    deleteProductVariant,
};
