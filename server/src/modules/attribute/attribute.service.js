'use strict';

const {
    AttributeTemplate, AttributeValue, CategoryAttribute, Category,
    Product, ProductAttribute, ProductVariant, VariantOption, sequelize,
} = require('../index');
const { generateSlug } = require('../../utils/slugify');
const AppError = require('../../utils/AppError');

// ── Reusable include for variant detail ──────────────────────────────────────
const variantInclude = [
    {
        model: VariantOption,
        as: 'options',
        include: [
            { model: AttributeTemplate, as: 'attribute', attributes: ['id', 'name', 'slug'] },
            { model: AttributeValue,    as: 'value',     attributes: ['id', 'value', 'slug'] },
        ],
    },
];

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
    await getAttributeById(attributeId);
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
    if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');

    await getAttributeById(attributeId);

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
 * Get attributes for a category with optional ancestor inheritance.
 */
const getCategoryAttributes = async (categoryId, inherit = false) => {
    const category = await Category.findByPk(categoryId);
    if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');

    let categoryIds = [categoryId];

    if (inherit) {
        let current = category;
        while (current.parentId) {
            categoryIds.push(current.parentId);
            current = await Category.findByPk(current.parentId);
            if (!current) break;
        }
    }

    const links = await CategoryAttribute.findAll({
        where: { categoryId: categoryIds },
        attributes: ['attributeId'],
    });

    const uniqueAttrIds = [...new Set(links.map((l) => l.attributeId))];
    if (uniqueAttrIds.length === 0) return [];

    return AttributeTemplate.findAll({
        where: { id: uniqueAttrIds },
        include: [{ model: AttributeValue, as: 'values', attributes: ['id', 'value', 'slug', 'sortOrder'] }],
        order: [['sortOrder', 'ASC'], [{ model: AttributeValue, as: 'values' }, 'sortOrder', 'ASC']],
    });
};

/**
 * Bulk Variant Generator — NEW implementation using variant_options.
 *
 * Reads all product_attributes with is_variant_attr=true, builds the Cartesian
 * product of their values, then creates one product_variants row per combination
 * and the appropriate variant_options rows linking them.
 *
 * Accepts optional overrides:
 *   defaultPrice    — applied to all generated variants (defaults to product.price)
 *   defaultStockQty — applied to all generated variants (defaults to 0)
 */
const bulkGenerateVariants = async (productId, { defaultPrice, defaultStockQty = 0 } = {}) => {
    const product = await Product.findByPk(productId);
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');

    console.log(`[bulkGenerateVariants] Starting for product: ${productId}`);

    const t = await sequelize.transaction();
    try {
        // -- Pre-processing: Auto-promote custom attributes marked for variations --
        const customVariantAttrs = await ProductAttribute.findAll({
            where: { productId, isVariantAttr: true, attributeId: null },
            transaction: t,
        });

        if (customVariantAttrs.length > 0) {
            console.log(`[bulkGenerateVariants] Promoting ${customVariantAttrs.length} custom attributes to global templates.`);
            for (const customAttr of customVariantAttrs) {
                if (!customAttr.customName || !customAttr.customValue) continue;

                let template = await AttributeTemplate.findOne({ 
                    where: { name: customAttr.customName },
                    transaction: t,
                });
                if (!template) {
                    const slug = await generateSlug(customAttr.customName, AttributeTemplate);
                    template = await AttributeTemplate.create({ name: customAttr.customName, slug }, { transaction: t });
                }

                let val = await AttributeValue.findOne({ 
                    where: { attributeId: template.id, value: customAttr.customValue },
                    transaction: t,
                });
                if (!val) {
                    const slug = await generateSlug(customAttr.customValue, AttributeValue);
                    val = await AttributeValue.create({ attributeId: template.id, value: customAttr.customValue, slug }, { transaction: t });
                }

                await customAttr.update({
                    attributeId: template.id,
                    valueId: val.id,
                    customName: null,
                    customValue: null,
                }, { transaction: t });
            }
        }

        // Load all is_variant_attr=true rows for this product (including newly promoted globals)
        const variantAttrs = await ProductAttribute.findAll({
            where: { productId, isVariantAttr: true },
            include: [
                { model: AttributeTemplate, as: 'attribute', attributes: ['id', 'name'] },
                { model: AttributeValue,    as: 'value',     attributes: ['id', 'value'] },
            ],
            order: [['sortOrder', 'ASC']],
            transaction: t,
        });

        console.log(`[bulkGenerateVariants] Found ${variantAttrs.length} variant-forming attribute rows.`);

        if (variantAttrs.length === 0) {
            throw new AppError(
                'VALIDATION_ERROR', 400,
                'No variant-forming attributes found. Mark at least one product attribute with isVariantAttr=true first.'
            );
        }

        // Group by attributeId → collect all valueIds per attribute
        const attrMap = new Map(); // attributeId → { attribute, values: [{valueId, label}] }
        for (const row of variantAttrs) {
            if (!row.attributeId || !row.valueId) {
                console.warn(`[bulkGenerateVariants] Skipping row ${row.id}: attributeId or valueId is missing even after promotion.`);
                continue;
            }
            if (!attrMap.has(row.attributeId)) {
                attrMap.set(row.attributeId, { attribute: row.attribute, values: [] });
            }
            attrMap.get(row.attributeId).values.push({ valueId: row.valueId, label: row.value?.value || row.customValue || 'Unknown' });
        }

        const attrGroups = Array.from(attrMap.values());
        console.log(`[bulkGenerateVariants] Matrix dimensions: ${attrGroups.length}`);
        attrGroups.forEach(g => console.log(`  - ${g.attribute?.name}: ${g.values.length} values`));

        if (attrGroups.length === 0) {
            throw new AppError(
                'VALIDATION_ERROR', 400,
                'Variant-forming attributes must reference global attribute templates (not custom attributes).'
            );
        }

        // Cartesian product → array of [{attributeId, valueId, label}] combos
        const combos = cartesian(attrGroups);
        console.log(`[bulkGenerateVariants] Total generated combinations: ${combos.length}`);

        const basePrice = defaultPrice ?? Number(product.price);

        // Fetch existing variants to compare (avoid wiping out custom prices/stock/sku)
        const existingVariants = await ProductVariant.findAll({
            where: { productId },
            include: [{ model: VariantOption, as: 'options', attributes: ['valueId'] }],
            transaction: t,
        });

        // Compute signatures (sorted valueIds joined by comma) for the new matrix combinations
        const newComboSignatures = new Set();
        for (const combo of combos) {
             const sig = combo.map(o => o.valueId).sort().join(',');
             newComboSignatures.add(sig);
        }

        // Delete existing variants that NO LONGER match the new matrix
        let deletedCount = 0;
        for (const variant of existingVariants) {
            const signature = variant.options.map(o => o.valueId).sort().join(',');
            if (!newComboSignatures.has(signature)) {
                await variant.destroy({ transaction: t });
                deletedCount++;
            }
        }
        console.log(`[bulkGenerateVariants] Pruned ${deletedCount} obsolete variants.`);

        // Track combinations that already exist so we don't recreate them
        const existingSignatures = new Set(
            existingVariants
                .filter(v => !v.isSoftDeleted) // basic safety
                .map(v => v.options.map(o => o.valueId).sort().join(','))
        );

        let createdCount = 0;
        let sortCounter = existingVariants.length - deletedCount; 

        for (const combo of combos) {
            const signature = combo.map(o => o.valueId).sort().join(',');
            
            // If this combination already exists, leave the existing variant alone (preserving its custom data)
            if (existingSignatures.has(signature)) {
                continue; 
            }

            // Otherwise, create the new variant
            const variant = await ProductVariant.create({
                productId,
                price: basePrice,
                stockQty: defaultStockQty,
                isActive: true,
                sortOrder: sortCounter++,
            }, { transaction: t });

            // Insert one variant_option row per attribute dimension
            for (const { attributeId, valueId } of combo) {
                await VariantOption.create({ variantId: variant.id, attributeId, valueId }, { transaction: t });
            }
            createdCount++;
        }
        console.log(`[bulkGenerateVariants] Created ${createdCount} new variant combinations.`);

        await t.commit();
        console.log(`[bulkGenerateVariants] Transaction committed successfully.`);

        // Return full detail with options
        return ProductVariant.findAll({
            where: { productId },
            include: variantInclude,
            order: [['sortOrder', 'ASC']],
        });
    } catch (err) {
        await t.rollback();
        throw err;
    }
};

/**
 * Clone variants from one product to another (new architecture).
 * Copies variant rows + variant_options, resets stock, leaves SKU null.
 */
const cloneVariants = async (targetProductId, sourceProductId) => {
    const sourceProduct = await Product.findByPk(sourceProductId);
    if (!sourceProduct) throw new AppError('NOT_FOUND', 404, 'Source product not found');

    const targetProduct = await Product.findByPk(targetProductId);
    if (!targetProduct) throw new AppError('NOT_FOUND', 404, 'Target product not found');

    const sourceVariants = await ProductVariant.findAll({
        where: { productId: sourceProductId },
        include: [{ model: VariantOption, as: 'options' }],
    });
    if (sourceVariants.length === 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Source product has no variants to clone');
    }

    const t = await sequelize.transaction();
    try {
        const cloned = [];
        for (const sv of sourceVariants) {
            const variant = await ProductVariant.create({
                productId: targetProductId,
                price: sv.price,
                stockQty: 0,     // quantities don't carry over
                isActive: sv.isActive,
                sortOrder: sv.sortOrder,
                sku: null,       // SKU must be unique — admin sets per product
            }, { transaction: t });

            for (const opt of sv.options) {
                await VariantOption.create({
                    variantId: variant.id,
                    attributeId: opt.attributeId,
                    valueId: opt.valueId,
                }, { transaction: t });
            }

            cloned.push(variant);
        }

        await t.commit();
        return ProductVariant.findAll({
            where: { productId: targetProductId },
            include: variantInclude,
            order: [['sortOrder', 'ASC']],
        });
    } catch (err) {
        await t.rollback();
        throw err;
    }
};

/**
 * Helper: Cartesian product of attribute groups.
 * Input:  [{ attribute:{id,name}, values:[{valueId,label}] }, ...]
 * Output: [[{attributeId, valueId, label}, ...], ...]
 */
const cartesian = (groups) => {
    if (groups.length === 0) return [[]];
    const [first, ...rest] = groups;
    const restCombos = cartesian(rest);
    const result = [];
    for (const val of first.values) {
        for (const combo of restCombos) {
            result.push([{ attributeId: first.attribute.id, valueId: val.valueId, label: val.label }, ...combo]);
        }
    }
    return result;
};

/**
 * Per-product variant CRUD (new architecture)
 */
const getProductVariants = async (productId) => {
    const product = await Product.findByPk(productId, { attributes: ['id'] });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    return ProductVariant.findAll({
        where: { productId },
        include: variantInclude,
        order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
    });
};

const addProductVariant = async (productId, data) => {
    const product = await Product.findByPk(productId, { attributes: ['id'] });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');

    // Validate each option's attributeId+valueId pair exists and are linked
    for (const opt of data.options) {
        const val = await AttributeValue.findOne({
            where: { id: opt.valueId, attributeId: opt.attributeId },
            attributes: ['id'],
        });
        if (!val) {
            throw new AppError(
                'VALIDATION_ERROR', 400,
                `Value ${opt.valueId} does not belong to attribute ${opt.attributeId}`
            );
        }
    }

    const t = await sequelize.transaction();
    try {
        const variant = await ProductVariant.create({
            productId,
            sku: data.sku ?? null,
            price: data.price,
            stockQty: data.stockQty ?? 0,
            isActive: data.isActive ?? true,
            sortOrder: data.sortOrder ?? 0,
        }, { transaction: t });

        for (const opt of data.options) {
            await VariantOption.create({
                variantId: variant.id,
                attributeId: opt.attributeId,
                valueId: opt.valueId,
            }, { transaction: t });
        }

        await t.commit();
        return ProductVariant.findByPk(variant.id, { include: variantInclude });
    } catch (err) {
        await t.rollback();
        throw err;
    }
};

const updateProductVariant = async (productId, variantId, data) => {
    const variant = await ProductVariant.findOne({ where: { id: variantId, productId } });
    if (!variant) throw new AppError('NOT_FOUND', 404, 'Variant not found');

    // Whitelist updatable scalar fields (options/dimensions are immutable after creation)
    const allowed = ['sku', 'price', 'stockQty', 'isActive', 'sortOrder'];
    const updates = {};
    for (const field of allowed) {
        if (data[field] !== undefined) updates[field] = data[field];
    }

    await variant.update(updates);
    return ProductVariant.findByPk(variantId, { include: variantInclude });
};

const deleteProductVariant = async (productId, variantId) => {
    const variant = await ProductVariant.findOne({ where: { id: variantId, productId } });
    if (!variant) throw new AppError('NOT_FOUND', 404, 'Variant not found');
    await variant.destroy(); // paranoid soft-delete
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
