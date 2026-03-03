'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('orders', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            order_number: { type: Sequelize.STRING(50), unique: true, allowNull: false },
            user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' } },
            status: { type: Sequelize.STRING(30), defaultValue: 'pending_payment' },
            subtotal: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
            tax: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
            shipping_cost: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
            discount_amount: { type: Sequelize.DECIMAL(10, 2), defaultValue: 0 },
            total: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
            coupon_id: { type: Sequelize.UUID, references: { model: 'coupons', key: 'id' } },
            shipping_address_snapshot: { type: Sequelize.JSONB },
            notes: { type: Sequelize.TEXT },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.sequelize.query('ALTER TABLE orders ADD CONSTRAINT chk_order_total CHECK (total >= 0)');
        await queryInterface.addIndex('orders', ['user_id'], { name: 'idx_orders_user' });
        await queryInterface.addIndex('orders', ['status'], { name: 'idx_orders_status' });
        await queryInterface.addIndex('orders', ['order_number'], { name: 'idx_orders_number' });
        await queryInterface.addIndex('orders', ['created_at'], { name: 'idx_orders_created' });

        await queryInterface.createTable('order_items', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            order_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'orders', key: 'id' }, onDelete: 'CASCADE' },
            product_id: { type: Sequelize.UUID, references: { model: 'products', key: 'id' } },
            snapshot_name: { type: Sequelize.STRING(255), allowNull: false },
            snapshot_price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
            snapshot_image: { type: Sequelize.STRING(500) },
            snapshot_sku: { type: Sequelize.STRING(100) },
            variant_info: { type: Sequelize.JSONB },
            quantity: { type: Sequelize.INTEGER, allowNull: false },
            total: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.sequelize.query('ALTER TABLE order_items ADD CONSTRAINT chk_oi_qty CHECK (quantity > 0)');
        await queryInterface.sequelize.query('ALTER TABLE order_items ADD CONSTRAINT chk_oi_total CHECK (total > 0)');
        await queryInterface.addIndex('order_items', ['order_id'], { name: 'idx_order_items_order' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('order_items');
        await queryInterface.dropTable('orders');
    },
};
