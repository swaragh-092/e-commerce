'use strict';

const { ProductAttribute, AttributeTemplate, AttributeValue, Product, sequelize } = require('../index');
const AppError = require('../../utils/AppError');
const { assertVariableProduct } = require('../product/productType');
const { groupKey } = require('./productAttributeOrder');

const ATTRIBUTE_TEMPLATE_FIELDS = ['id', 'name', 'slug', 'sortOrder', 'displayType', 'valueType', 'unit', 'unitCategory'];
const ATTRIBUTE_VALUE_FIELDS = ['id', 'value', 'slug', 'sortOrder', 'displayLabel', 'swatchColor', 'imageUrl', 'unitLabel', 'metadata'];

// ── Shared include for full attribute+value detail ──────────────────────────
const fullInclude = [
    {
        model: AttributeTemplate,
        as: 'attribute',
        attributes: ATTRIBUTE_TEMPLATE_FIELDS,
        paranoid: false,
    },
    {
        model: AttributeValue,
        as: 'value',
        attributes: ATTRIBUTE_VALUE_FIELDS,
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
        order: [['sortOrder', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
    });
};

/**
 * Add a display attribute to a product.
 * Two modes:
 *   Global: { attributeId, valueId, isVariantAttr?, sortOrder? }
 *   Custom: { customName, customValue, isVariantAttr?, sortOrder? }
 */
const addProductAttribute = async (productId, data) => sequelize.transaction(async (transaction) => {
    const product = await Product.findByPk(productId, { attributes: ['id', 'type'], transaction, lock: transaction.LOCK.UPDATE });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    if (data.isVariantAttr) assertVariableProduct(product);
    const lastOrder = await ProductAttribute.max('sortOrder', { where: { productId }, transaction });
    const sortOrder = data.sortOrder ?? (lastOrder == null ? 0 : Number(lastOrder) + 1);

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
            sortOrder,
        }, { transaction });
    }

    // Custom attribute
    return ProductAttribute.create({
        productId,
        customName: data.customName,
        customValue: data.customValue,
        isVariantAttr: data.isVariantAttr ?? false,
        sortOrder,
    }, { transaction });
});

/**
 * Update a single product attribute row (value swap, sort order, isVariantAttr toggle).
 */
const updateProductAttribute = async (productId, attrId, data) => {
    const row = await ProductAttribute.findOne({ where: { id: attrId, productId } });
    if (!row) throw new AppError('NOT_FOUND', 404, 'Product attribute not found');
    if (data.isVariantAttr) {
        const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
        if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
        assertVariableProduct(product);
    }

    // Reject mode crossing: custom attributes cannot receive valueId, and template attributes cannot receive customValue
    if (data.valueId && !row.attributeId) {
        throw new AppError('VALIDATION_ERROR', 400, 'Cannot set valueId on a custom attribute');
    }
    if (data.customValue !== undefined && row.attributeId) {
        throw new AppError('VALIDATION_ERROR', 400, 'Cannot set customValue on a global attribute template');
    }

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
    reorderProductAttributes: async (productId, rowIds) => sequelize.transaction(async (transaction) => {
        const product = await Product.findByPk(productId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
        const rows = await ProductAttribute.findAll({ where: { productId }, transaction, lock: transaction.LOCK.UPDATE });
        const byId = new Map(rows.map((row) => [row.id, row]));
        if (!Array.isArray(rowIds) || rowIds.length !== rows.length || new Set(rowIds).size !== rows.length || rowIds.some((id) => !byId.has(id))) {
            throw new AppError('CONFLICT', 409, 'Product attributes changed. Refresh the attributes and try ordering them again.');
        }
        const seenGroups = new Set();
        let previous;
        for (const id of rowIds) {
            const key = groupKey(byId.get(id));
            if (key !== previous && seenGroups.has(key)) throw new AppError('VALIDATION_ERROR', 400, 'Keep values of each attribute together.');
            seenGroups.add(key); previous = key;
        }
        for (const [sortOrder, id] of rowIds.entries()) await ProductAttribute.update({ sortOrder }, { where: { id, productId }, transaction });
        return ProductAttribute.findAll({ where: { productId }, include: fullInclude, order: [['sortOrder', 'ASC'], ['id', 'ASC']], transaction });
    }),
};
