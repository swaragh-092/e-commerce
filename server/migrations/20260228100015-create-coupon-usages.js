'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('coupon_usages', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            coupon_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'coupons', key: 'id' }, onDelete: 'CASCADE' },
            user_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
            order_id: { type: Sequelize.UUID, references: { model: 'orders', key: 'id' }, onDelete: 'SET NULL' },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('coupon_usages', ['coupon_id', 'user_id'], { name: 'idx_coupon_usage_user' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('coupon_usages');
    },
};
