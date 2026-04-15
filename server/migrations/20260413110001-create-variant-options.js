'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('variant_options', {
            variant_id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                references: { model: 'product_variants', key: 'id' },
                onDelete: 'CASCADE',
            },
            attribute_id: {
                type: Sequelize.UUID,
                allowNull: false,
                primaryKey: true,
                references: { model: 'attribute_templates', key: 'id' },
                onDelete: 'CASCADE',
            },
            value_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'attribute_values', key: 'id' },
                onDelete: 'CASCADE',
            },
        });

        await queryInterface.addIndex('variant_options', ['variant_id'], {
            name: 'idx_variant_options_variant_id',
        });
        await queryInterface.addIndex('variant_options', ['attribute_id', 'value_id'], {
            name: 'idx_variant_options_attr_val',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('variant_options');
    },
};
