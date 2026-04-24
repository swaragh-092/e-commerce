'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('orders', 'payment_method', {
            type: Sequelize.STRING(20),
            allowNull: false,
            defaultValue: 'razorpay',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('orders', 'payment_method');
    },
};
