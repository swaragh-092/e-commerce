'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addIndex('product_attributes', ['product_id', 'attribute_id', 'value_id'], {
            unique: true,
            name: 'idx_product_attrs_unique_template_value',
            where: Sequelize.literal('attribute_id IS NOT NULL AND value_id IS NOT NULL')
        });

    },

    async down(queryInterface) {
        await queryInterface.removeIndex('product_attributes', 'idx_product_attrs_unique_template_value');
    },
};
