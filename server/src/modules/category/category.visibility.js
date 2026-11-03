'use strict';

const { Category, Product } = require('../index');

// Include ancestors so a parent remains reachable when only a descendant has
// products. Sequelize's paranoid product join excludes soft-deleted products;
// stock is deliberately unrestricted because the catalog supports enquiries.
const getPopulatedCategoryIds = async (allCategories) => {
    const [categories, populated] = await Promise.all([
        allCategories || Category.findAll({ attributes: ['id', 'parentId'], raw: true }),
        Category.findAll({
            attributes: ['id'],
            include: [{
                model: Product,
                as: 'products',
                attributes: [],
                through: { attributes: [] },
                where: { status: 'published', isEnabled: true },
                required: true,
            }],
            group: ['Category.id'],
            raw: true,
        }),
    ]);
    const parents = new Map(categories.map(category => [category.id, category.parentId]));
    const ids = new Set();
    for (const category of populated) {
        let id = category.id;
        while (id && parents.has(id) && !ids.has(id)) {
            ids.add(id);
            id = parents.get(id);
        }
    }
    return ids;
};

module.exports = { getPopulatedCategoryIds };
