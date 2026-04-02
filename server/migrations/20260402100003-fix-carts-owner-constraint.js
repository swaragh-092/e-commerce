'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
            ALTER TABLE carts 
            ADD CONSTRAINT chk_cart_owner 
            CHECK (user_id IS NOT NULL OR session_id IS NOT NULL)
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE carts 
            DROP CONSTRAINT chk_cart_owner
        `);
    },
};
