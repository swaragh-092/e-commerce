'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('attribute_templates', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            name: { type: Sequelize.STRING(100), unique: true, allowNull: false },
            slug: { type: Sequelize.STRING(100), unique: true, allowNull: false },
            sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('attribute_templates', ['slug'], { name: 'idx_attribute_templates_slug' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('attribute_templates');
    },
};
