'use strict';

const { Category, Product } = require('../index');
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

exports.getCategoryWithProducts = async (slug) => {
    const category = await Category.findOne({
        where: { slug },
        include: [{
            model: Product,
            as: 'products',
            where: { status: 'published' },
            required: false // LEFT JOIN so we still get category if no products
        }]
    });
    if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');
    return category;
};

exports.createCategory = async (data) => {
    const slug = await generateSlug(data.name, Category);
    return Category.create({ ...data, slug });
};

exports.updateCategory = async (id, data) => {
    const category = await Category.findByPk(id);
    if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');

    if (data.name && data.name !== category.name) {
        data.slug = await generateSlug(data.name, Category);
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

    return category.update(data);
};

exports.deleteCategory = async (id) => {
    const category = await Category.findByPk(id);
    if (!category) throw new AppError('NOT_FOUND', 404, 'Category not found');

    const childrenCount = await Category.count({ where: { parentId: id } });
    if (childrenCount > 0) {
        throw new AppError('VALIDATION_ERROR', 400, 'Cannot delete category with subcategories');
    }

    // F-10: guard against deleting a category that still has products
    const productCount = await Product.count({ where: { categoryId: id } });
    if (productCount > 0) {
        throw new AppError('VALIDATION_ERROR', 400, `Cannot delete category: ${productCount} product(s) are still assigned to it`);
    }

    await category.destroy();
    return true;
};
