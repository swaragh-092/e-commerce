'use strict';

const { Op, Sequelize } = require('sequelize');
const {
    AttributeTemplate, AttributeValue, CategoryAttribute, Category,
    Product, ProductImage, ProductAttribute, ProductVariant, VariantOption, Media,
    sequelize,
} = require('../index');
const { generateSlug } = require('../../utils/slugify');
const AppError = require('../../utils/AppError');
const { buildVariantGenerationPlan } = require('./variantGenerationPlan');
const { assertVariableProduct } = require('../product/productType');
const { orderProductPresentation } = require('./productAttributeOrder');
const inventoryService = require('../inventory/inventory.service');
const { readUnitSettings, lockUnitSettings } = require('../settings/unitCatalog');
const SettingsService = require('../settings/settings.service');
const { validateAttributeCategory, validateValueUnit, validateCategoryChange } = require('./attributeUnits');

const ATTRIBUTE_TEMPLATE_FIELDS = ['id', 'name', 'slug', 'sortOrder', 'displayType', 'valueType', 'unit', 'unitCategory', 'createdAt'];
const ATTRIBUTE_VALUE_FIELDS = ['id', 'value', 'slug', 'sortOrder', 'displayLabel', 'swatchColor', 'imageUrl', 'unitLabel', 'metadata'];

const syncProductVariantStock = async (productId, transaction = null) => {
    const [stockSum, reservedSum] = await Promise.all([
        ProductVariant.sum('stockQty', {
            where: { productId, isActive: true },
            transaction,
        }),
        ProductVariant.sum('reservedQty', {
            where: { productId },
            paranoid: false,
            transaction,
        }),
    ]);
    const nextReserved = Math.max(Number(reservedSum || 0), 0);
    const nextQuantity = Math.max(Number(stockSum || 0), nextReserved);

    await Product.update(
        { quantity: nextQuantity, reservedQty: nextReserved },
        { where: { id: productId }, transaction }
    );

    return nextQuantity;
};

// ── Reusable include for variant detail ──────────────────────────────────────
const variantInclude = [
    {
        model: VariantOption,
        as: 'options',
        include: [
            { model: AttributeTemplate, as: 'attribute', attributes: ATTRIBUTE_TEMPLATE_FIELDS, paranoid: false },
            { model: AttributeValue,    as: 'value',     attributes: ATTRIBUTE_VALUE_FIELDS },
        ],
    },
    {
        model: Media,
        as: 'media',
    },
    {
        model: ProductImage,
        as: 'images',
        required: false,
        include: [{ model: Media, as: 'media', required: false }],
    },
];

const validateImageRows = async (images = []) => {
    const mediaIds = Array.from(new Set(images.map((img) => img.mediaId || img.media_id || img.media?.id).filter(Boolean)));
    if (mediaIds.length === 0) return;

    const count = await Media.count({ where: { id: mediaIds } });
    if (count !== mediaIds.length) {
        throw new AppError('VALIDATION_ERROR', 400, 'One or more images reference an invalid media ID');
    }
};

const normalizeImageRows = (images = [], { productId, variantId } = {}) => (
    images.map((img, index) => ({
        productId,
        variantId,
        url: img.url || img.media?.url,
        alt: img.alt || null,
        mediaId: img.mediaId || img.media_id || img.media?.id || null,
        sortOrder: Number(img.sortOrder ?? index),
        isPrimary: Boolean(img.isPrimary),
    })).filter((img) => img.url || img.mediaId)
);

const replaceVariantImageRows = async ({ productId, variantId, images = [], transaction }) => {
    const rows = normalizeImageRows(images, { productId, variantId });
    const hasPrimary = rows.some((img) => img.isPrimary);

    await ProductImage.destroy({ where: { productId, variantId }, transaction });

    if (hasPrimary) {
        await ProductImage.update(
            { isPrimary: false },
            { where: { productId }, transaction }
        );
    }

    if (rows.length > 0) {
        await ProductImage.bulkCreate(rows, { transaction });
    }

    const primaryOrFirst = rows.find((img) => img.isPrimary) || rows[0] || null;
    await ProductVariant.update(
        { mediaId: primaryOrFirst?.mediaId || null },
        { where: { id: variantId, productId }, transaction }
    );
};

/**
 * Attribute Template CRUD
 */
const writeAttributeTemplate = async (write) => {
    try { return await write(); }
    catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            throw new AppError('CONFLICT', 409, 'An active attribute template with this name or slug already exists. Choose a different name.');
        }
        throw error;
    }
};

const createAttribute = (data) => writeAttributeTemplate(async () => {
    const slug = await generateSlug(data.name, AttributeTemplate, 'slug', { paranoid: true });
    if (data.unitCategory !== undefined) {
        return sequelize.transaction(async (transaction) => {
            await lockUnitSettings(transaction);
            const settings = await readUnitSettings(transaction);
            const unitCategory = validateAttributeCategory(data.unitCategory, settings);
            return AttributeTemplate.create({ ...data, unitCategory, slug }, { transaction });
        });
    }
    return AttributeTemplate.create({ ...data, slug });
});

const getAllAttributes = async (optionsOrPage = 1, limitArg = 20) => {
    let page = 1;
    let limit = 20;
    let search = '';
    let displayType = '';
    let valueType = '';
    let hasValues = '';
    let sortBy = 'sortOrder';
    let sortOrder = 'ASC';

    if (typeof optionsOrPage === 'object' && optionsOrPage !== null) {
        page = parseInt(optionsOrPage.page, 10) || 1;
        limit = parseInt(optionsOrPage.limit, 10) || 20;
        search = optionsOrPage.search ? String(optionsOrPage.search).trim() : '';
        displayType = optionsOrPage.displayType ? String(optionsOrPage.displayType).trim() : '';
        valueType = optionsOrPage.valueType ? String(optionsOrPage.valueType).trim() : '';
        hasValues = optionsOrPage.hasValues ? String(optionsOrPage.hasValues).trim() : '';
        sortBy = optionsOrPage.sortBy || 'sortOrder';
        sortOrder = (optionsOrPage.sortOrder || 'ASC').toUpperCase();
    } else {
        page = parseInt(optionsOrPage, 10) || 1;
        limit = parseInt(limitArg, 10) || 20;
    }

    const safeLimit = Math.min(100, Math.max(1, limit));
    const offset = (Math.max(1, page) - 1) * safeLimit;

    const where = {};
    const andConditions = [];

    if (search) {
        const searchPattern = `%${search}%`;
        andConditions.push({
            [Op.or]: [
                { name: { [Op.iLike]: searchPattern } },
                { slug: { [Op.iLike]: searchPattern } },
                Sequelize.literal(`EXISTS (
                    SELECT 1 FROM "attribute_values" AS av 
                    WHERE av."attribute_id" = "AttributeTemplate"."id" 
                    AND (av."value" ILIKE ${sequelize.escape(searchPattern)} OR av."display_label" ILIKE ${sequelize.escape(searchPattern)})
                )`),
            ],
        });
    }

    if (displayType && displayType !== 'all') {
        where.displayType = displayType;
    }

    if (valueType && valueType !== 'all') {
        where.valueType = valueType;
    }

    if (hasValues && hasValues !== 'all') {
        const shouldHave = hasValues === 'yes' || hasValues === 'true';
        if (shouldHave) {
            andConditions.push(
                Sequelize.literal(`EXISTS (
                    SELECT 1 FROM "attribute_values" AS av 
                    WHERE av."attribute_id" = "AttributeTemplate"."id"
                )`)
            );
        } else {
            andConditions.push(
                Sequelize.literal(`NOT EXISTS (
                    SELECT 1 FROM "attribute_values" AS av 
                    WHERE av."attribute_id" = "AttributeTemplate"."id"
                )`)
            );
        }
    }

    if (andConditions.length > 0) {
        where[Op.and] = andConditions;
    }

    const validSortFields = ['sortOrder', 'name', 'slug', 'createdAt'];
    const safeSortBy = validSortFields.includes(sortBy) ? sortBy : 'sortOrder';
    const safeSortOrder = sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const order = [
        [safeSortBy, safeSortOrder],
        [{ model: AttributeValue, as: 'values' }, 'sortOrder', 'ASC'],
    ];
    if (safeSortBy !== 'id') {
        order.push(['id', 'ASC']);
    }

    return AttributeTemplate.findAndCountAll({
        where,
        attributes: ATTRIBUTE_TEMPLATE_FIELDS,
        include: [{ model: AttributeValue, as: 'values', attributes: ATTRIBUTE_VALUE_FIELDS }],
        order,
        limit: safeLimit,
        offset,
        distinct: true,
    });
};

const getAttributeById = async (id, transaction) => {
    const attr = await AttributeTemplate.findByPk(id, {
        ...(transaction ? { transaction } : {}),
        attributes: ATTRIBUTE_TEMPLATE_FIELDS,
        include: [{ model: AttributeValue, as: 'values', attributes: ATTRIBUTE_VALUE_FIELDS }],
    });
    if (!attr) throw new AppError('NOT_FOUND', 404, 'Attribute not found');
    return attr;
};

const updateAttribute = (id, data) => writeAttributeTemplate(async () => {
    if (data.unitCategory !== undefined) {
        return sequelize.transaction(async (transaction) => {
            await lockUnitSettings(transaction);
            const attr = await getAttributeById(id, transaction);
            const settings = await readUnitSettings(transaction);
            const unitCategory = validateAttributeCategory(data.unitCategory, settings);
            validateCategoryChange(attr, unitCategory, settings);
            const updates = { ...data, unitCategory };
            if (unitCategory !== (attr.unitCategory || null)) updates.unit = null;
            if (data.name && data.name !== attr.name) updates.slug = await generateSlug(data.name, AttributeTemplate, 'slug', { transaction, paranoid: true });
            await attr.update(updates, { transaction });
            return attr;
        });
    }
    const attr = await getAttributeById(id);
    if (data.name && data.name !== attr.name) {
        data.slug = await generateSlug(data.name, AttributeTemplate, 'slug', { paranoid: true });
    }
    await attr.update(data);
    return attr;
});

const deleteAttribute = (id) => sequelize.transaction(async (transaction) => {
    const attr = await AttributeTemplate.findByPk(id, {
        attributes: ['id'], transaction, lock: transaction.LOCK.UPDATE,
    });
    if (!attr) throw new AppError('NOT_FOUND', 404, 'Attribute not found');
    // Draft/hidden products and inactive variants still count; deleted products/variants do not.
    const [productAttrCount, variantOptCount] = await Promise.all([
        ProductAttribute.count({
            where: { attributeId: id }, transaction,
            include: [{ model: Product, as: 'product', attributes: [], required: true }],
        }),
        VariantOption.count({
            where: { attributeId: id }, transaction,
            include: [{ model: ProductVariant, as: 'variant', attributes: [], required: true,
                include: [{ model: Product, as: 'product', attributes: [], required: true }],
            }],
        }),
    ]);
    if (productAttrCount || variantOptCount) {
        throw new AppError('CONFLICT', 409, 'Cannot delete this attribute: it is still attached to product.');
    }
    // Archive only the template; historical links and values are retained.
    await attr.destroy({ transaction });
});

/**
 * Attribute Value CRUD
 */
const addValue = async (attributeId, data) => {
    return sequelize.transaction(async (transaction) => {
        await lockUnitSettings(transaction);
        const attr = await getAttributeById(attributeId, transaction);
        const settings = await readUnitSettings(transaction);
        const unitLabel = validateValueUnit(attr, data.unitLabel || attr.unit, settings);
        const slug = await generateSlug(data.value, AttributeValue, 'slug', { where: { attributeId }, transaction });
        return AttributeValue.create({ ...data, unitLabel, attributeId, slug }, { transaction });
    });
};

const updateValue = async (attributeId, valueId, data) => {
    return sequelize.transaction(async (transaction) => {
        await lockUnitSettings(transaction);
        const attr = await getAttributeById(attributeId, transaction);
        const val = await AttributeValue.findOne({ where: { id: valueId, attributeId }, transaction });
        if (!val) throw new AppError('NOT_FOUND', 404, 'Attribute value not found');

        const updates = { ...data };
        if (data.unitLabel !== undefined) {
            const settings = await readUnitSettings(transaction);
            updates.unitLabel = validateValueUnit(attr, data.unitLabel, settings, val.unitLabel || attr.unit || null);
        }
        if (updates.value && updates.value !== val.value) {
            updates.slug = await generateSlug(updates.value, AttributeValue, 'slug', { where: { attributeId }, transaction });
        }

        await val.update(updates, { transaction });
        return val;
    });
};

const removeValue = async (attributeId, valueId) => {
    await getAttributeById(attributeId);
    const val = await AttributeValue.findOne({ where: { id: valueId, attributeId } });
    if (!val) throw new AppError('NOT_FOUND', 404, 'Attribute value not found');

    const [productAttrCount, variantOptCount] = await Promise.all([
        ProductAttribute.count({ where: { valueId } }),
        VariantOption.count({ where: { valueId } }),
    ]);

    if (productAttrCount > 0 || variantOptCount > 0) {
        throw new AppError(
            'CONFLICT',
            409,
            `Cannot delete attribute value: in use by ${productAttrCount} product attribute(s) and ${variantOptCount} variant option(s)`
        );
    }

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
const getCategoryAttributes = async (categoryIdOrIds, inherit = false) => {
    let ids = categoryIdOrIds;
    if (typeof ids === 'string' && ids.includes(',')) {
        ids = ids.split(',');
    }
    const categoryIdsInput = Array.isArray(ids) ? ids : [ids];
    if (categoryIdsInput.length === 0) return [];

    const categories = await Category.findAll({ where: { id: categoryIdsInput } });
    if (categories.length === 0) return [];

    let allCategoryIds = [...categoryIdsInput];
    const catMap = {};
    categories.forEach(c => {
        catMap[c.id] = { name: c.name, isDirect: true };
    });

    if (inherit) {
        // Fetch all categories in the hierarchy using a Recursive CTE to avoid N+1
        const results = await sequelize.query(`
            WITH RECURSIVE CategoryPath AS (
                SELECT id, name, parent_id
                FROM categories
                WHERE id IN (:ids)
                
                UNION ALL
                
                SELECT c.id, c.name, c.parent_id
                FROM categories c
                JOIN CategoryPath cp ON c.id = cp.parent_id
                WHERE c.id IS NOT NULL
            )
            SELECT DISTINCT id, name, parent_id FROM CategoryPath
        `, {
            replacements: { ids: categoryIdsInput },
            type: sequelize.QueryTypes.SELECT
        });

        results.forEach(c => {
            if (!catMap[c.id]) {
                catMap[c.id] = { name: c.name, isDirect: false };
                if (!allCategoryIds.includes(c.id)) {
                    allCategoryIds.push(c.id);
                }
            }
        });
    }

    const links = await CategoryAttribute.findAll({
        where: { categoryId: allCategoryIds },
        attributes: ['attributeId', 'categoryId'],
    });

    const uniqueAttrIds = [...new Set(links.map((l) => l.attributeId))];
    if (uniqueAttrIds.length === 0) return [];

    const templates = await AttributeTemplate.findAll({
        where: { id: uniqueAttrIds },
        attributes: ATTRIBUTE_TEMPLATE_FIELDS,
        include: [{ model: AttributeValue, as: 'values', attributes: ATTRIBUTE_VALUE_FIELDS }],
        order: [['sortOrder', 'ASC'], [{ model: AttributeValue, as: 'values' }, 'sortOrder', 'ASC']],
    });

    return templates.map(template => {
        const json = template.get({ plain: true });
        const sources = links
            .filter(l => l.attributeId === template.id)
            .map(l => ({
                id: l.categoryId,
                name: catMap[l.categoryId]?.name || 'Unknown',
                isDirect: catMap[l.categoryId]?.isDirect || false
            }));
        return { ...json, sources };
    });
};

// Lock variants before the parent, matching the inventory service's lock order.
const loadVariantGenerationPlan = async (productId, transaction) => {
    const variants = await ProductVariant.findAll({
        where: { productId }, include: [variantInclude[0]], transaction,
        order: [['id', 'ASC']],
        ...(transaction ? { lock: { level: transaction.LOCK.UPDATE, of: ProductVariant } } : {}),
    });
    const product = await Product.findByPk(productId, {
        transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}),
    });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    assertVariableProduct(product);
    const rows = await ProductAttribute.findAll({
        where: { productId, isVariantAttr: true, attributeId: { [Op.ne]: null } },
        include: [
            { model: AttributeTemplate, as: 'attribute', attributes: ATTRIBUTE_TEMPLATE_FIELDS, paranoid: false },
            { model: AttributeValue, as: 'value', attributes: ATTRIBUTE_VALUE_FIELDS },
        ],
        order: [['sortOrder', 'ASC']], transaction,
    });
    return { product, ...buildVariantGenerationPlan(rows, variants) };
};

const previewVariantGeneration = async (productId) => {
    const { review } = await loadVariantGenerationPlan(productId);
    return review;
};

const bulkGenerateVariants = async (productId, { defaultPrice, defaultStockQty = 0, planToken, confirmRemovals = false, newVariants } = {}) => {
    const { features } = await SettingsService.getFeatures();
    await sequelize.transaction(async (transaction) => {
        // Also serialize concurrent creation when the product has no variants to lock.
        await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:scope), hashtext(:productId))', {
            replacements: { scope: 'product-variant-generation', productId }, transaction,
        });
        const { product, review, added, removed, keptStock } = await loadVariantGenerationPlan(productId, transaction);
        if (planToken && planToken !== review.token) {
            throw new AppError('CONFLICT', 409, 'Product options or variants changed. Close this review and preview the latest changes.');
        }
        if (removed.length && (!planToken || !confirmRemovals)) {
            throw new AppError('CONFLICT', 409, 'Review and confirm the variants to remove before updating options.');
        }
        if (review.blockedRemovalCount) {
            throw new AppError('CONFLICT', 409, 'Some variants have units reserved for active orders. Finish or cancel those orders before removing the variants.');
        }
        let creations = added.map((combo) => ({ combo, price: defaultPrice ?? Number(product.price), stockQty: defaultStockQty }));
        if (newVariants !== undefined) {
            if (!planToken || !Array.isArray(newVariants) || newVariants.length > 500) {
                throw new AppError('VALIDATION_ERROR', 400, 'Preview the combinations before customizing variants.');
            }
            const bySignature = new Map(added.map((combo) => [combo.map((value) => value.valueId).sort().join(','), combo]));
            const seen = new Set();
            creations = newVariants.map((entry) => {
                const key = Array.isArray(entry.valueIds) ? [...entry.valueIds].sort().join(',') : '';
                const combo = bySignature.get(key);
                if (!combo || seen.has(key)) throw new AppError('VALIDATION_ERROR', 400, 'Choose each new combination at most once from the current preview.');
                seen.add(key);
                if (typeof entry.price !== 'number' || !Number.isFinite(entry.price) || entry.price < 0 || entry.price > 99999999.99 || !/^\d+(\.\d{1,2})?$/.test(String(entry.price))
                    || !Number.isInteger(entry.stockQty) || entry.stockQty < 0 || entry.stockQty > 2147483647) {
                    throw new AppError('VALIDATION_ERROR', 400, 'Each variant needs a valid price and a whole stock quantity of 0 or more.');
                }
                return { combo, price: entry.price, stockQty: entry.stockQty };
            });
            if (!review.keptCount && !creations.length) throw new AppError('VALIDATION_ERROR', 400, 'Select at least one combination to keep or create.');
        }
        if (features.pricing && creations.some(({ price }) => !Number.isFinite(Number(price)) || Number(price) <= 0)) {
            throw new AppError('PRODUCT_NOT_READY', 400, 'Set a positive product and variant price before creating purchasable variants.');
        }
        if (keptStock + creations.reduce((sum, variant) => sum + variant.stockQty, 0) > 2147483647) {
            throw new AppError('VALIDATION_ERROR', 400, 'The combined variant stock is too large. Choose a lower starting stock quantity.');
        }
        for (const variant of removed) await variant.destroy({ transaction });
        let sortOrder = review.keptCount;
        for (const { combo, price, stockQty } of creations) {
            const variant = await ProductVariant.create({
                productId, price, stockQty,
                isActive: true, sortOrder: sortOrder++,
            }, { transaction });
            await VariantOption.bulkCreate(combo.map(({ attributeId, valueId }) => ({ variantId: variant.id, attributeId, valueId })), { transaction });
        }
        await syncProductVariantStock(productId, transaction);
    });
    return ProductVariant.findAll({ where: { productId }, include: variantInclude, order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']] });
};

// Clone missing combinations together with their product attribute assignments.
const cloneVariants = async (targetProductId, sourceProductId) => {
    const { cloneProductVariants } = require('./productVariantClone.service');
    const summary = await cloneProductVariants(targetProductId, sourceProductId);
    return { variants: await getProductVariants(targetProductId), summary };
};

/**
 * Per-product variant CRUD (new architecture)
 */
const getProductVariants = async (productId) => {
    const product = await Product.findByPk(productId, { attributes: ['id'] });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    const variants = await ProductVariant.findAll({
        where: { productId },
        include: variantInclude,
        order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
    });
    const attributes = await ProductAttribute.findAll({ where: { productId } });
    const plain = (row) => typeof row.toJSON === 'function' ? row.toJSON() : row;
    return orderProductPresentation({ attributes: attributes.map(plain), variants: variants.map(plain) }).variants;
};

const addProductVariant = async (productId, data) => {
    const product = await Product.findByPk(productId, { attributes: ['id', 'type'] });
    if (!product) throw new AppError('NOT_FOUND', 404, 'Product not found');
    assertVariableProduct(product);
    const { features } = await SettingsService.getFeatures();
    if (features.pricing && (!Number.isFinite(Number(data.price)) || Number(data.price) <= 0)) {
        throw new AppError('PRODUCT_NOT_READY', 400, 'Set a positive variant price before adding a purchasable variant.');
    }

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
    if (Array.isArray(data.images)) {
        await validateImageRows(data.images);
    }

    const t = await sequelize.transaction();
    try {
        await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:scope), hashtext(:productId))', { replacements: { scope: 'product-variant-generation', productId }, transaction: t });
        const currentProduct = await Product.findByPk(productId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!currentProduct) throw new AppError('NOT_FOUND', 404, 'Product not found');
        assertVariableProduct(currentProduct);
        const variant = await ProductVariant.create({
            productId,
            sku: data.sku ?? null,
            price: data.price,
            stockQty: data.stockQty ?? 0,
            isActive: data.isActive ?? true,
            sortOrder: data.sortOrder ?? 0,
            weightGrams: data.weightGrams ?? null,
            lengthCm: data.lengthCm ?? null,
            breadthCm: data.breadthCm ?? null,
            heightCm: data.heightCm ?? null,
        }, { transaction: t });

        for (const opt of data.options) {
            await VariantOption.create({
                variantId: variant.id,
                attributeId: opt.attributeId,
                valueId: opt.valueId,
            }, { transaction: t });
        }
        if (Array.isArray(data.images)) {
            await replaceVariantImageRows({
                productId,
                variantId: variant.id,
                images: data.images,
                transaction: t,
            });
        }

        await syncProductVariantStock(productId, t);
        await t.commit();
        return ProductVariant.findByPk(variant.id, { include: variantInclude });
    } catch (err) {
        await t.rollback();
        throw err;
    }
};

const updateProductVariant = async (productId, variantId, data, auditContext = null) => {
    const variant = await ProductVariant.findOne({ where: { id: variantId, productId } });
    if (!variant) throw new AppError('NOT_FOUND', 404, 'Variant not found');
    if (Array.isArray(data.images)) {
        await validateImageRows(data.images);
    }

    const allowed = ['sku', 'price', 'stockQty', 'isActive', 'sortOrder', 'mediaId', 'media_id', 'weightGrams', 'lengthCm', 'breadthCm', 'heightCm'];
    const updates = {};
    for (const field of allowed) {
        if (data[field] !== undefined) {
            // Map both mediaId and media_id to the model's mediaId property
            if (field === 'media_id' || field === 'mediaId') {
                updates.mediaId = data[field];
            } else {
                updates[field] = data[field];
            }
        }
    }

    // Stock-only edits do not need feature resolution; price/activation changes
    // must not make a zero-priced variant purchasable in ecommerce mode.
    if (data.price !== undefined || data.isActive !== undefined) {
        const { features } = await SettingsService.getFeatures();
        const nextActive = data.isActive !== undefined ? data.isActive : variant.isActive;
        const nextPrice = data.price !== undefined ? data.price : variant.price;
        if (features.pricing && nextActive && (!Number.isFinite(Number(nextPrice)) || Number(nextPrice) <= 0)) {
            throw new AppError('PRODUCT_NOT_READY', 400, 'Set a positive variant price before making it purchasable.');
        }
    }

    if (updates.stockQty !== undefined) {
        const nextQty = Number(updates.stockQty);
        if (!Number.isInteger(nextQty) || nextQty < 0) {
            throw new AppError('VALIDATION_ERROR', 400, 'Quantity must be a non-negative integer');
        }
        const reservedQty = Number(variant.reservedQty || 0);
        if (nextQty < reservedQty) {
            throw new AppError('VALIDATION_ERROR', 400, `Stock quantity (${nextQty}) cannot be less than reserved quantity (${reservedQty})`);
        }
        updates.stockQty = nextQty;
    }

    await sequelize.transaction(async (t) => {
        if (updates.stockQty !== undefined) {
            await inventoryService.adjust({
                productId,
                variantId,
                newQuantity: updates.stockQty,
                reason: data.stockAdjustmentReason || 'Admin variant stock adjustment',
                createdBy: auditContext?.userId || null,
                metadata: { source: 'variant_update' },
                transaction: t,
                syncParent: false,
            });
            delete updates.stockQty;
        }

        if (Object.keys(updates).length > 0) {
            await variant.update(updates, { transaction: t });
        }
        if (Array.isArray(data.images)) {
            await replaceVariantImageRows({
                productId,
                variantId,
                images: data.images,
                transaction: t,
            });
        }
        await syncProductVariantStock(productId, t);
    });
    return ProductVariant.findByPk(variantId, { include: variantInclude });
};

const deleteProductVariant = async (productId, variantId) => {
    await sequelize.transaction(async (t) => {
        const variant = await ProductVariant.findOne({ where: { id: variantId, productId }, transaction: t, lock: t.LOCK.UPDATE });
        if (!variant) throw new AppError('NOT_FOUND', 404, 'Variant not found');
        if (Number(variant.reservedQty || 0) > 0) {
            throw new AppError('CONFLICT', 409, `This variant has ${variant.reservedQty} units reserved for active orders. Turn off Available to hide it, or finish/cancel those orders before deleting it.`);
        }
        await variant.destroy({ transaction: t });
        await syncProductVariantStock(productId, t);
    });
};

const reorderValues = async (attributeId, valueIds) => {
    if (!attributeId || !Array.isArray(valueIds) || valueIds.length === 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Invalid attributeId or valueIds array');
    }

    await getAttributeById(attributeId);
    // Verify all valueIds belong to this attribute
    const count = await AttributeValue.count({
        where: {
            id: valueIds,
            attributeId
        }
    });

    if (count !== valueIds.length) {
        throw new AppError('VALIDATION_ERROR', 400, 'One or more value IDs are invalid or do not belong to this attribute');
    }

    const t = await sequelize.transaction();
    try {
        for (let i = 0; i < valueIds.length; i++) {
            await AttributeValue.update(
                { sortOrder: i },
                { where: { id: valueIds[i], attributeId }, transaction: t }
            );
        }
        await t.commit();
        return true;
    } catch (err) {
        await t.rollback();
        throw err;
    }
};


module.exports = {
    createAttribute,
    getAllAttributes,
    getAttributeById,
    updateAttribute,
    deleteAttribute,
    addValue,
    updateValue,
    removeValue,
    reorderValues,
    linkAttributeToCategory,
    unlinkAttributeFromCategory,
    getCategoryAttributes,
    bulkGenerateVariants,
    previewVariantGeneration,
    cloneVariants,
    getProductVariants,
    addProductVariant,
    updateProductVariant,
    deleteProductVariant,
    syncProductVariantStock,
};
