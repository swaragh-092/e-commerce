'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('attribute_values', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            attribute_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'attribute_templates', key: 'id' }, onDelete: 'CASCADE' },
            value: { type: Sequelize.STRING(100), allowNull: false },
            slug: { type: Sequelize.STRING(100), allowNull: false },
            sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('attribute_values', ['attribute_id', 'slug'], { unique: true, name: 'idx_attribute_values_attr_slug' });
        await queryInterface.addIndex('attribute_values', ['attribute_id'], { name: 'idx_attribute_values_attr' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('attribute_values');
    },
};
