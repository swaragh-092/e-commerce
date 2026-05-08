'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
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
