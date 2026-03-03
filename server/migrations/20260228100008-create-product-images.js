'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('product_images', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            product_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'products', key: 'id' }, onDelete: 'CASCADE' },
            url: { type: Sequelize.STRING(500), allowNull: false },
            alt: { type: Sequelize.STRING(255) },
            sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
            is_primary: { type: Sequelize.BOOLEAN, defaultValue: false },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('product_images', ['product_id'], { name: 'idx_product_images_product' });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('product_images');
    },
};
