'use strict';

const { Category, Product, ProductCategory, sequelize } = require('../index');
const { generateSlug } = require('../../utils/slugify');
const AppError = require('../../utils/AppError');

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

exports.getCategoryTree = async () => {
    const categories = await Category.findAll({
        order: [['sortOrder', 'ASC'], ['name', 'ASC']]
    });
    return buildTree(categories);
};

exports.getCategoryWithProducts = async (slug, page = 1, limit = 20) => {
    const category = await Category.findOne({
        where: { slug }
    });
    if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');

    const offset = (page - 1) * limit;

    const { count, rows: products } = await Product.findAndCountAll({
        where: { status: 'published', isEnabled: true },
        include: [{
            model: Category,
            as: 'categories',
            where: { id: category.id },
            through: { attributes: ['sortOrder'] }, 
            required: true
        }, {
            model: require('../index').ProductImage,
            as: 'images',
            limit: 1 
        }],
        limit: parseInt(limit),
        offset: parseInt(offset),
        distinct: true,
        order: [
            [ { model: Category, as: 'categories' }, 'ProductCategory', 'sortOrder', 'ASC' ],
            ['createdAt', 'DESC']
        ]
    });

    return {
        category,
        products,
        pagination: {
            totalItems: count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            limit: parseInt(limit)
        }
    };
};

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
