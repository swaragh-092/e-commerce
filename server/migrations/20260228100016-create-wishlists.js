'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('wishlists', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            user_id: { type: Sequelize.UUID, unique: true, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.createTable('wishlist_items', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            wishlist_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'wishlists', key: 'id' }, onDelete: 'CASCADE' },
            product_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('wishlist_items', ['wishlist_id', 'product_id'], { unique: true, name: 'uniq_wishlist_product' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('wishlist_items');
        await queryInterface.dropTable('wishlists');
    },
};
