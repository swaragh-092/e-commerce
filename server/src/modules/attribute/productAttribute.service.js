'use strict';

const { ProductAttribute, AttributeTemplate, AttributeValue, Product, sequelize } = require('../index');
const AppError = require('../../utils/AppError');

// ── Shared include for full attribute+value detail ──────────────────────────
const fullInclude = [
    {
        model: AttributeTemplate,
        as: 'attribute',
        attributes: ['id', 'name', 'slug'],
    },
    {
        model: AttributeValue,
        as: 'value',
        attributes: ['id', 'value', 'slug'],
    },
];

/**
 * List all display attributes for a product, ordered by sort_order.
 */
const getProductAttributes = async (productId) => {
    const product = await Product.findByPk(productId, { attributes: ['id'] });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');

    return ProductAttribute.findAll({
        where: { productId },
        include: fullInclude,
        order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
    });
};

/**
 * Add a display attribute to a product.
 * Two modes:
 *   Global: { attributeId, valueId, isVariantAttr?, sortOrder? }
 *   Custom: { customName, customValue, isVariantAttr?, sortOrder? }
 */
const addProductAttribute = async (productId, data) => {
    const product = await Product.findByPk(productId, { attributes: ['id'] });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');

    const isGlobal = Boolean(data.attributeId);

    if (isGlobal) {
        // Validate that the referenced template + value exist and are linked
        const template = await AttributeTemplate.findByPk(data.attributeId, { attributes: ['id'] });
        if (!template) throw new AppError('NOT_FOUND', 404, 'Attribute template not found');

        const attrValue = await AttributeValue.findOne({
            where: { id: data.valueId, attributeId: data.attributeId },
            attributes: ['id'],
        });
        if (!attrValue) throw new AppError('NOT_FOUND', 404, 'Attribute value not found or does not belong to attribute');

        return ProductAttribute.create({
            productId,
            attributeId: data.attributeId,
            valueId: data.valueId,
            isVariantAttr: data.isVariantAttr ?? false,
            sortOrder: data.sortOrder ?? 0,
        });
    }

    // Custom attribute
    return ProductAttribute.create({
        productId,
        customName: data.customName,
        customValue: data.customValue,
        isVariantAttr: data.isVariantAttr ?? false,
        sortOrder: data.sortOrder ?? 0,
    });
};

/**
 * Update a single product attribute row (value swap, sort order, isVariantAttr toggle).
 */
const updateProductAttribute = async (productId, attrId, data) => {
    const row = await ProductAttribute.findOne({ where: { id: attrId, productId } });
    if (!row) throw new AppError('NOT_FOUND', 404, 'Product attribute not found');

    // If swapping to a new global value, validate the new attributeValue belongs to the same template
    if (data.valueId && row.attributeId) {
        const attrValue = await AttributeValue.findOne({
            where: { id: data.valueId, attributeId: row.attributeId },
            attributes: ['id'],
        });
        if (!attrValue) throw new AppError('VALIDATION_ERROR', 400, 'Value does not belong to this attribute template');
    }

    // Whitelist updatable fields
    const allowed = ['valueId', 'customValue', 'isVariantAttr', 'sortOrder'];
    const updates = {};
    for (const field of allowed) {
        if (data[field] !== undefined) updates[field] = data[field];
    }

    await row.update(updates);
    return ProductAttribute.findByPk(row.id, { include: fullInclude });
};

/**
 * Remove a display attribute from a product.
 */
const deleteProductAttribute = async (productId, attrId) => {
    const row = await ProductAttribute.findOne({ where: { id: attrId, productId } });
    if (!row) throw new AppError('NOT_FOUND', 404, 'Product attribute not found');
    await row.destroy();
};

module.exports = {
    getProductAttributes,
    addProductAttribute,
    updateProductAttribute,
    deleteProductAttribute,
};
