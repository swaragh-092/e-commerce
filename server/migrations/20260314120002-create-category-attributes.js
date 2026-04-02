'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('category_attributes', {
            category_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'categories', key: 'id' }, onDelete: 'CASCADE', primaryKey: true },
            attribute_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'attribute_templates', key: 'id' }, onDelete: 'CASCADE', primaryKey: true },
        });

        await queryInterface.addIndex('category_attributes', ['attribute_id'], { name: 'idx_category_attributes_attr' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('category_attributes');
    },
};
