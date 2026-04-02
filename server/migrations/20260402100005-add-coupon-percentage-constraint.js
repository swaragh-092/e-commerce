'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.query(`
            ALTER TABLE coupons 
            ADD CONSTRAINT chk_coupon_percentage_limit 
            CHECK (type != 'percentage' OR value <= 100)
        `);
    },

    async down(queryInterface) {
        await queryInterface.sequelize.query(`
            ALTER TABLE coupons 
            DROP CONSTRAINT chk_coupon_percentage_limit
        `);
    },
};
