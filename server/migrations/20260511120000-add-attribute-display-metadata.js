'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('attribute_templates', 'display_type', {
            type: Sequelize.STRING(40),
            allowNull: false,
            defaultValue: 'auto',
        });
        await queryInterface.addColumn('attribute_templates', 'value_type', {
            type: Sequelize.STRING(40),
            allowNull: false,
            defaultValue: 'auto',
        });
        await queryInterface.addColumn('attribute_templates', 'unit', {
            type: Sequelize.STRING(20),
            allowNull: true,
        });

        await queryInterface.addColumn('attribute_values', 'display_label', {
            type: Sequelize.STRING(100),
            allowNull: true,
        });
        await queryInterface.addColumn('attribute_values', 'swatch_color', {
            type: Sequelize.STRING(32),
            allowNull: true,
        });
        await queryInterface.addColumn('attribute_values', 'image_url', {
            type: Sequelize.STRING(500),
            allowNull: true,
        });
        await queryInterface.addColumn('attribute_values', 'unit_label', {
            type: Sequelize.STRING(20),
            allowNull: true,
        });
        await queryInterface.addColumn('attribute_values', 'metadata', {
            type: Sequelize.JSONB,
            allowNull: false,
            defaultValue: {},
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('attribute_values', 'metadata');
        await queryInterface.removeColumn('attribute_values', 'unit_label');
        await queryInterface.removeColumn('attribute_values', 'image_url');
        await queryInterface.removeColumn('attribute_values', 'swatch_color');
        await queryInterface.removeColumn('attribute_values', 'display_label');
        await queryInterface.removeColumn('attribute_templates', 'unit');
        await queryInterface.removeColumn('attribute_templates', 'value_type');
        await queryInterface.removeColumn('attribute_templates', 'display_type');
    },
};
