'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('carts', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
            session_id: { type: Sequelize.STRING(255) },
            status: { type: Sequelize.STRING(20), defaultValue: 'active' },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('carts', ['user_id'], { name: 'idx_carts_user' });
        await queryInterface.addIndex('carts', ['status'], { name: 'idx_carts_status' });

        await queryInterface.createTable('cart_items', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            cart_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'carts', key: 'id' }, onDelete: 'CASCADE' },
            product_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
            variant_id: { type: Sequelize.UUID, references: { model: 'product_variants', key: 'id' }, onDelete: 'SET NULL' },
            quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.sequelize.query('ALTER TABLE cart_items ADD CONSTRAINT chk_cart_qty CHECK (quantity > 0)');
        await queryInterface.addIndex('cart_items', ['cart_id'], { name: 'idx_cart_items_cart' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('cart_items');
        await queryInterface.dropTable('carts');
    },
};
