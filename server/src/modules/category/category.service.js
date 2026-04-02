'use strict';

const { Category, Product } = require('../index');
const { generateSlug } = require('../../utils/slugify');

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
    if (!category) throw new Error('Category not found');
    return category;
};

exports.createCategory = async (data) => {
    const slug = await generateSlug(data.name, Category);
    return Category.create({ ...data, slug });
};

exports.updateCategory = async (id, data) => {
    const category = await Category.findByPk(id);
    if (!category) throw new Error('Category not found');

    if (data.name && data.name !== category.name) {
        data.slug = await generateSlug(data.name, Category);
    }
    
    // Prevent self-referencing check
    if (data.parentId === id) {
        throw new Error('Category cannot be its own parent');
    }

    return category.update(data);
};

exports.deleteCategory = async (id) => {
    const category = await Category.findByPk(id);
    if (!category) throw new Error('Category not found');
    
    // Check if it has children
    const childrenCount = await Category.count({ where: { parentId: id } });
    if (childrenCount > 0) {
        throw new Error('Cannot delete category with subcategories');
    }

    await category.destroy();
    return true;
};
