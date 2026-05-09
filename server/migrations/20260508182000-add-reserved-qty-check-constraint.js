'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Clean up existing invalid data
        await queryInterface.sequelize.query(`
            UPDATE product_variants 
            SET reserved_qty = 0 
            WHERE reserved_qty < 0
        `);

        await queryInterface.sequelize.query(`
            ALTER TABLE product_variants 
            ADD CONSTRAINT chk_reserved_qty_non_negative 
            CHECK (reserved_qty >= 0)
        `);
    },


    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE product_variants 
            DROP CONSTRAINT chk_reserved_qty_non_negative
        `);
    },
};
