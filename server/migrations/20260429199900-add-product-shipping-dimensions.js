'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add physical dimension + weight columns to products
        await queryInterface.addColumn('products', 'weight_grams', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: true,
            defaultValue: 500,  // sensible default: 500 g
            comment: 'Actual weight of the product in grams',
        });
        await queryInterface.addColumn('products', 'length_cm', {
            type: Sequelize.DECIMAL(8, 2),
            allowNull: true,
            defaultValue: 10,
            comment: 'Package length in centimetres',
        });
        await queryInterface.addColumn('products', 'breadth_cm', {
            type: Sequelize.DECIMAL(8, 2),
            allowNull: true,
            defaultValue: 10,
            comment: 'Package breadth in centimetres',
        });
        await queryInterface.addColumn('products', 'height_cm', {
            type: Sequelize.DECIMAL(8, 2),
            allowNull: true,
            defaultValue: 10,
            comment: 'Package height in centimetres',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('products', 'weight_grams');
        await queryInterface.removeColumn('products', 'length_cm');
        await queryInterface.removeColumn('products', 'breadth_cm');
        await queryInterface.removeColumn('products', 'height_cm');
    },
};
