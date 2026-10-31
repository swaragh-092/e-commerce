'use strict';

const { ProductAttribute, AttributeTemplate, AttributeValue, Product, sequelize } = require('../index');
const AppError = require('../../utils/AppError');
const { assertVariableProduct } = require('../product/productType');
const { groupKey } = require('./productAttributeOrder');
const { lockProductVariantChanges, assertAttributeNotUsedByVariants, assertAttributeRemovalAllowed } = require('./productAttributeUsage');

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
const updateProductAttribute = async (productId, attrId, data) => sequelize.transaction(async (transaction) => {
    await lockProductVariantChanges(productId, transaction);
    const row = await ProductAttribute.findOne({ where: { id: attrId, productId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw new AppError('NOT_FOUND', 404, 'Product attribute not found');
    if (data.isVariantAttr) {
        const product = await Product.findByPk(productId, { attributes: ['id', 'type'], transaction });
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

    if (data.isVariantAttr === false || (data.valueId && data.valueId !== row.valueId)) {
        await assertAttributeNotUsedByVariants(productId, row.attributeId, transaction);
    }

    // If swapping to a new global value, validate the new attributeValue belongs to the same template
    if (data.valueId && row.attributeId) {
        const attrValue = await AttributeValue.findOne({
            where: { id: data.valueId, attributeId: row.attributeId },
            attributes: ['id'],
            transaction,
        });
        if (!attrValue) throw new AppError('VALIDATION_ERROR', 400, 'Value does not belong to this attribute template');
    }

    // Whitelist updatable fields
    const allowed = ['valueId', 'customValue', 'isVariantAttr', 'sortOrder'];
    const updates = {};
    for (const field of allowed) {
        if (data[field] !== undefined) updates[field] = data[field];
    }

    await row.update(updates, { transaction });
    return ProductAttribute.findByPk(row.id, { include: fullInclude, transaction });
});

const loadAttributeGroup = async (productId, attrId, transaction) => {
    const product = await Product.findByPk(productId, { attributes: ['id', 'type'], transaction, lock: transaction.LOCK.UPDATE });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    const rows = await ProductAttribute.findAll({ where: { productId }, transaction, lock: transaction.LOCK.UPDATE });
    const row = rows.find((item) => item.id === attrId);
    if (!row) throw new AppError('NOT_FOUND', 404, 'Product attribute not found');
    const group = rows.filter((item) => groupKey(item) === groupKey(row));
    return { product, group };
};

// Change every value together, including groups larger than assignment requests.
const updateProductAttributeGroup = async (productId, attrId, { isVariantAttr }) => sequelize.transaction(async (transaction) => {
    await lockProductVariantChanges(productId, transaction);
    const { product, group } = await loadAttributeGroup(productId, attrId, transaction);
    if (isVariantAttr) {
        assertVariableProduct(product);
        if (!group[0].attributeId) throw new AppError('VALIDATION_ERROR', 400, 'Custom specifications cannot be used for variants.');
    } else {
        await assertAttributeNotUsedByVariants(productId, group[0].attributeId, transaction);
    }
    for (const row of group) await row.update({ isVariantAttr }, { transaction });
    return ProductAttribute.findAll({ where: { productId }, include: fullInclude, order: [['sortOrder', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']], transaction });
});

/** Remove a value or its entire attribute, only after variant use is disabled. */
const deleteProductAttribute = async (productId, attrId, { wholeGroup = false } = {}) => sequelize.transaction(async (transaction) => {
    await lockProductVariantChanges(productId, transaction);
    const { group } = await loadAttributeGroup(productId, attrId, transaction);
    await assertAttributeRemovalAllowed(productId, group, transaction);
    for (const item of wholeGroup ? group : group.filter((row) => row.id === attrId)) await item.destroy({ transaction });
});

module.exports = {
    getProductAttributes,
    addProductAttribute,
    updateProductAttribute,
    updateProductAttributeGroup,
    deleteProductAttribute,
    deleteProductAttributeGroup: (productId, attrId) => deleteProductAttribute(productId, attrId, { wholeGroup: true }),
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
