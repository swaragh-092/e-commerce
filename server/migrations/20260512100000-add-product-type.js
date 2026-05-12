'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Step 1: Add column as nullable
        await queryInterface.addColumn('products', 'type', {
            type: Sequelize.ENUM('simple', 'variable', 'combo'),
            allowNull: true,
        });

        // Step 2: Backfill existing rows
        await queryInterface.sequelize.query("UPDATE products SET type = 'simple' WHERE type IS NULL");

        // Step 3: Set Not Null and Default
        await queryInterface.changeColumn('products', 'type', {
            type: Sequelize.ENUM('simple', 'variable', 'combo'),
            allowNull: false,
            defaultValue: 'simple',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('products', 'type');
        // Drop the ENUM type created by Postgres
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_products_type";');
    },
};
