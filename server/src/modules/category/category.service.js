'use strict';

const { Category, Product, ProductCategory, ProductImage, ProductVariant, Media, Sequelize, sequelize } = require('../index');
const { Op } = Sequelize;
const { generateSlug } = require('../../utils/slugify');
const AppError = require('../../utils/AppError');
const SettingsService = require('../settings/settings.service');
const { getSaleLabels } = require('../settings/saleLabel.service');
const { serializeProductPricing } = require('../product/product.pricing');

// ProductVariant has no salePrice column. Product-level sale rules are
// applied by serializeProductPricing after the query returns.
const CATEGORY_PRODUCT_VARIANT_ATTRIBUTES = ['id', 'price', 'stockQty', 'reservedQty', 'isActive'];

const getLabelPresets = () => getSaleLabels().catch(() => []);

/**
 * Build a nested category tree from a flat list
 */
const buildTree = (categories, parentId = null) => {
    return categories
        .filter(cat => cat.parentId === parentId)
        .map(cat => ({
            ...cat.toJSON(),
            children: buildTree(categories, cat.id)
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder);
};

/**
 * F-09: Detect if setting newParentId on `id` would create a cycle.
 * Walks UP the ancestor chain from newParentId; if it ever reaches `id`, it's a cycle.
 */
const wouldCreateCycle = async (id, newParentId) => {
    if (!newParentId) return false;
    let current = newParentId;
    const visited = new Set();
    while (current) {
        if (current === id) return true;
        if (visited.has(current)) return true; // safety: broken chain
        visited.add(current);
        const parent = await Category.findByPk(current, { attributes: ['id', 'parentId'] });
        if (!parent) break;
        current = parent.parentId;
    }
    return false;
};

/**
 * F-11: Collect IDs of a category and ALL its descendants (recursive).
 * Used by product.service.js to filter products by category subtree.
 */
exports.getCategoryAndDescendantIds = async (categoryId) => {
    const all = await Category.findAll({ attributes: ['id', 'parentId'] });
    const ids = [];
    const queue = [categoryId];
    while (queue.length) {
        const current = queue.shift();
        ids.push(current);
        all.filter(c => c.parentId === current).forEach(c => queue.push(c.id));
    }
    return ids;
};

/**
 * Trace the full ancestor chain from root to the specified category.
 * Returns array of { id, name, slug } ordered from root to target category.
 */
exports.getCategoryAncestors = async (categoryId) => {
    const all = await Category.findAll({ attributes: ['id', 'name', 'slug', 'parentId'] });
    const catMap = new Map(all.map(c => [c.id, c]));
    const chain = [];
    let currentId = categoryId;
    const visited = new Set();
    while (currentId && catMap.has(currentId)) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        const node = catMap.get(currentId);
        chain.unshift({ id: node.id, name: node.name, slug: node.slug });
        currentId = node.parentId;
    }
    return chain;
};

exports.getCategoryTree = async () => {
    const categories = await Category.findAll({
        order: [['sortOrder', 'ASC'], ['name', 'ASC']]
    });
    return buildTree(categories);
};

exports.getCategoryWithProducts = async (slug, pageOrOptions = 1, limitArg = 20, sortArg = 'newest', minPriceArg, maxPriceArg) => {
    let page = 1;
    let limit = 20;
    let sort = 'newest';
    let minPrice;
    let maxPrice;

    let includeSubcategories = true;

    if (typeof pageOrOptions === 'object' && pageOrOptions !== null) {
        page = pageOrOptions.page ?? 1;
        limit = pageOrOptions.limit ?? 20;
        sort = pageOrOptions.sort ?? 'newest';
        minPrice = pageOrOptions.minPrice;
        maxPrice = pageOrOptions.maxPrice;
        if (pageOrOptions.includeSubcategories !== undefined) {
            const raw = pageOrOptions.includeSubcategories;
            if (typeof raw === 'boolean') {
                includeSubcategories = raw;
            } else if (typeof raw === 'number') {
                includeSubcategories = raw !== 0;
            } else if (typeof raw === 'string') {
                const s = raw.toLowerCase().trim();
                includeSubcategories = !['false', '0', 'no'].includes(s);
            } else {
                includeSubcategories = Boolean(raw);
            }
        }
    } else {
        page = pageOrOptions ?? 1;
        limit = limitArg ?? 20;
        sort = sortArg ?? 'newest';
        minPrice = minPriceArg;
        maxPrice = maxPriceArg;
    }

    const category = await Category.findOne({
        where: { slug },
        include: [{ model: Category, as: 'parent', attributes: ['id', 'name', 'slug'] }]
    });
    if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');

    // Direct subcategories for the subcategory rail on the category page
    const subcategories = await Category.findAll({
        where: { parentId: category.id },
        order: [['sortOrder', 'ASC'], ['name', 'ASC']],
        attributes: ['id', 'name', 'slug', 'image', 'sortOrder'],
    });

    // Full ancestor chain for multi-level breadcrumbs
    const breadcrumbs = await exports.getCategoryAncestors(category.id);

    // Expand to category subtree (Anchor category standard) unless explicit includeSubcategories=false requested
    const targetCategoryIds = includeSubcategories
        ? await exports.getCategoryAndDescendantIds(category.id)
        : [category.id];
    const escapedCategoryIds = (targetCategoryIds.length > 0 ? targetCategoryIds : [category.id])
        .map(id => sequelize.escape(id))
        .join(',');
    const descendantCondition = Sequelize.literal(
        `"Product"."id" IN (SELECT "product_id" FROM "product_categories" WHERE "category_id" IN (${escapedCategoryIds}))`
    );

    const { getSqlEffectivePriceExpr } = require('../product/product.service');
    const labelPresets = await getLabelPresets();
    const { features } = await SettingsService.getFeatures();

    const now = new Date();
    const effectivePriceCol = getSqlEffectivePriceExpr(labelPresets, now, '"Product"');

    // Map sort param to Sequelize order
    const sortMap = {
        newest:     [['createdAt', 'DESC']],
        price_asc:  [[effectivePriceCol, 'ASC']],
        price_desc: [[effectivePriceCol, 'DESC']],
        name_asc:   [['name', 'ASC']],
    };
    const productOrder = sortMap[sort] || sortMap.newest;

    const baseWhere = { status: 'published', isEnabled: true };

    // Price range calculation for the category subtree
    const priceRangeResult = await Product.findOne({
        where: {
            ...baseWhere,
            [Op.and]: [descendantCondition],
        },
        attributes: [
            [Sequelize.fn('MIN', effectivePriceCol), 'min'],
            [Sequelize.fn('MAX', effectivePriceCol), 'max'],
        ],
        raw: true,
    });

    const priceRange = {
        min: priceRangeResult?.min != null ? Number(priceRangeResult.min) : 0,
        max: priceRangeResult?.max != null ? Number(priceRangeResult.max) : 0,
    };

    // Filter by effective price if minPrice or maxPrice provided
    const productWhere = {
        ...baseWhere,
        [Op.and]: [descendantCondition],
    };

    const hasMin = minPrice !== undefined && minPrice !== null && minPrice !== '';
    const hasMax = maxPrice !== undefined && maxPrice !== null && maxPrice !== '';

    if (hasMin && hasMax) {
        productWhere[Op.and].push(
            Sequelize.where(effectivePriceCol, { [Op.between]: [Number(minPrice), Number(maxPrice)] })
        );
    } else if (hasMin) {
        productWhere[Op.and].push(
            Sequelize.where(effectivePriceCol, { [Op.gte]: Number(minPrice) })
        );
    } else if (hasMax) {
        productWhere[Op.and].push(
            Sequelize.where(effectivePriceCol, { [Op.lte]: Number(maxPrice) })
        );
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows: products } = await Product.findAndCountAll({
        where: productWhere,
        include: [
            {
                model: ProductImage,
                as: 'images',
                where: { variantId: null },
                required: false,
                include: [{ model: Media, as: 'media', required: false }],
            },
            {
                model: ProductVariant,
                as: 'variants',
                required: false,
                attributes: CATEGORY_PRODUCT_VARIANT_ATTRIBUTES,
            },
        ],
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        distinct: true,
        order: [...productOrder, ['id', 'ASC']],
    });

    const serializedProducts = products.map((p) =>
        serializeProductPricing(p, { adminView: false, features }, labelPresets)
    );

    const categoryData = category.toJSON ? category.toJSON() : { ...category };
    categoryData.breadcrumbs = breadcrumbs;

    return {
        category: categoryData,
        subcategories,
        products: serializedProducts,
        priceRange,
        breadcrumbs,
        pagination: {
            totalItems: count,
            totalPages: Math.ceil(count / parseInt(limit, 10)),
            currentPage: parseInt(page, 10),
            limit: parseInt(limit, 10),
        },
    };
};

exports.CATEGORY_PRODUCT_VARIANT_ATTRIBUTES = CATEGORY_PRODUCT_VARIANT_ATTRIBUTES;


/**
 * Check if a root category with the same name already exists.
 * Root categories are those with parentId === null.
 * @param {string} name - category name to check
 * @param {string|null} excludeId - optional id to exclude (used for updates)
 */
const checkDuplicateRootCategoryName = async (name, transaction = null, excludeId = null) => {
    const existing = await Category.findOne({
        where: {
            name: name.trim(),
            parentId: null,
            ...(excludeId && { id: { [require('sequelize').Op.ne]: excludeId } }),
        },
        transaction,
    });
    if (existing) {
        throw new AppError('VALIDATION_ERROR', 400, 'A root category with this name already exists');
    }
};

exports.createCategory = async (data) => {
    const transaction = await sequelize.transaction();
    try {
        // Prevent duplicate root category names
        if (!data.parentId) {
            await checkDuplicateRootCategoryName(data.name, transaction);
        }
        const slug = await generateSlug(data.name, Category, 'slug', { transaction });
        const category = await Category.create({ ...data, slug }, { transaction });
        await transaction.commit();
        return category;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

exports.updateCategory = async (id, data) => {
    const transaction = await sequelize.transaction();
    try {
        const category = await Category.findByPk(id, { transaction });
        if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');

        // Determine what the effective parentId and name will be after update
        const newParentId = data.parentId !== undefined ? data.parentId : category.parentId;
        const newName = data.name !== undefined ? data.name : category.name;

        // Prevent duplicate root category names when updating
        if (!newParentId && (newName !== category.name || category.parentId)) {
            await checkDuplicateRootCategoryName(newName, transaction, id);
        }

        if (data.name && data.name !== category.name && !data.slug) {
            data.slug = await generateSlug(data.name, Category, 'slug', { transaction });
        }

        if (data.parentId !== undefined) {
            // F-09: exact self-parent guard
            if (data.parentId === id) {
                throw new AppError('VALIDATION_ERROR', 400, 'Category cannot be its own parent');
            }
            // F-09: full cycle guard (e.g. A→B→C and trying to set A's parent to C)
            if (await wouldCreateCycle(id, data.parentId)) {
                throw new AppError('VALIDATION_ERROR', 400, 'Setting this parent would create a circular reference');
            }
        }

        await category.update(data, { transaction });
        await transaction.commit();
        return category;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

exports.deleteCategory = async (id) => {
    const category = await Category.findByPk(id);
    if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');

    const childrenCount = await Category.count({ where: { parentId: id } });
    if (childrenCount > 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Cannot delete category with subcategories');
    }

    // F-10: guard against deleting a category that still has products
    const productCount = await category.countProducts();
    if (productCount > 0) {
        throw new AppError('VALIDATION_ERROR', 400, `Cannot delete category: ${productCount} product(s) are still assigned to it`);
    }

    await category.destroy();
    return true;
};

/**
 * Reorder a category relative to its siblings.
 * @param {string} id - category id
 * @param {string} direction - 'up' or 'down'
 */
exports.reorderCategory = async (id, direction) => {
    const category = await Category.findByPk(id);
    if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');

    const parentId = category.parentId;
    const siblings = await Category.findAll({
        where: { parentId: parentId ?? null },
        order: [['sortOrder', 'ASC'], ['name', 'ASC'], ['id', 'ASC']]
    });

    const currentIndex = siblings.findIndex(c => c.id === id);
    if (currentIndex === -1) throw new AppError('NOT_FOUND', 404, 'Category not found');

    await Category.sequelize.transaction(async (transaction) => {
        if (direction === 'up') {
            if (currentIndex === 0) throw new AppError('VALIDATION_ERROR', 400, 'Already at the top');
            const swapWith = siblings[currentIndex - 1];
            const tempSort = category.sortOrder;
            await category.update({ sortOrder: swapWith.sortOrder }, { transaction });
            await swapWith.update({ sortOrder: tempSort }, { transaction });
        } else if (direction === 'down') {
            if (currentIndex === siblings.length - 1) throw new AppError('VALIDATION_ERROR', 400, 'Already at the bottom');
            const swapWith = siblings[currentIndex + 1];
            const tempSort = category.sortOrder;
            await category.update({ sortOrder: swapWith.sortOrder }, { transaction });
            await swapWith.update({ sortOrder: tempSort }, { transaction });
        } else {
            throw new AppError('VALIDATION_ERROR', 400, 'Invalid direction. Use "up" or "down".');
        }
    });

    return true;
};

/**
 * Update the sort order of products within a category.
 * @param {string} categoryId - category id
 * @param {string[]} productIds - ordered list of product ids
 */
exports.reorderProducts = async (categoryId, productIds) => {
    const category = await Category.findByPk(categoryId);
    if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');

    await sequelize.transaction(async (transaction) => {
        for (let i = 0; i < productIds.length; i++) {
            await ProductCategory.update(
                { sortOrder: i },
                { 
                    where: { categoryId, productId: productIds[i] },
                    transaction 
                }
            );
        }
    });

    return true;
};
