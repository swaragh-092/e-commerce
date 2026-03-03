'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('categories', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            name: { type: Sequelize.STRING(255), allowNull: false },
            slug: { type: Sequelize.STRING(255), unique: true, allowNull: false },
            description: { type: Sequelize.TEXT },
            parent_id: { type: Sequelize.UUID, references: { model: 'categories', key: 'id' }, onDelete: 'SET NULL' },
            image: { type: Sequelize.STRING(500) },
            sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('categories', ['slug'], { name: 'idx_categories_slug' });
        await queryInterface.addIndex('categories', ['parent_id'], { name: 'idx_categories_parent' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('categories');
    },
};
