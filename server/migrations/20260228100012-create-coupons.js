'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('coupons', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            code: { type: Sequelize.STRING(50), unique: true, allowNull: false },
            type: { type: Sequelize.STRING(20), allowNull: false },
            value: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
            min_order_amount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
            max_discount: { type: Sequelize.DECIMAL(10, 2) },
            usage_limit: { type: Sequelize.INTEGER },
            used_count: { type: Sequelize.INTEGER, defaultValue: 0 },
            per_user_limit: { type: Sequelize.INTEGER, defaultValue: 1 },
            start_date: { type: Sequelize.DATE, allowNull: false },
            end_date: { type: Sequelize.DATE, allowNull: false },
            is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
            applicable_to: { type: Sequelize.STRING(20), defaultValue: 'all' },
            applicable_ids: { type: Sequelize.JSONB },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.sequelize.query('ALTER TABLE coupons ADD CONSTRAINT chk_coupon_value CHECK (value > 0)');
        await queryInterface.sequelize.query('ALTER TABLE coupons ADD CONSTRAINT chk_coupon_dates CHECK (end_date > start_date)');
        await queryInterface.addIndex('coupons', ['code'], { name: 'idx_coupon_code' });
        await queryInterface.addIndex('coupons', ['is_active'], { name: 'idx_coupon_active' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('coupons');
    },
};
