'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.removeIndex('wishlist_items', 'uniq_wishlist_product', { transaction });

            await queryInterface.addColumn('wishlist_items', 'variant_id', {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'product_variants', key: 'id' },
                onDelete: 'SET NULL',
            }, { transaction });

            await queryInterface.addIndex('wishlist_items', ['wishlist_id', 'product_id'], {
                unique: true,
                name: 'uniq_wishlist_product_no_variant',
                where: { variant_id: null },
                transaction,
            });

            await queryInterface.addIndex('wishlist_items', ['wishlist_id', 'product_id', 'variant_id'], {
                unique: true,
                name: 'uniq_wishlist_product_variant',
                where: { variant_id: { [Sequelize.Op.ne]: null } },
                transaction,
            });
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('wishlist_items', 'uniq_wishlist_product_no_variant');
        await queryInterface.removeIndex('wishlist_items', 'uniq_wishlist_product_variant');
        await queryInterface.removeColumn('wishlist_items', 'variant_id');
        await queryInterface.addIndex('wishlist_items', ['wishlist_id', 'product_id'], { unique: true, name: 'uniq_wishlist_product' });
    },
};