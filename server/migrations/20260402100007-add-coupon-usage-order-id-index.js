'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addIndex('coupon_usages', ['order_id'], {
            name: 'idx_coupon_usage_order_id'
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('coupon_usages', 'idx_coupon_usage_order_id');
    },
};
