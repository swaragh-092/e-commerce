'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('product_images', 'variant_id', {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'product_variants', key: 'id' },
            onDelete: 'CASCADE',
        });

        await queryInterface.addIndex('product_images', ['variant_id'], {
            name: 'idx_product_images_variant',
        });

        await queryInterface.addIndex('product_images', ['product_id'], {
            name: 'uniq_product_images_one_primary',
            unique: true,
            where: { is_primary: true },
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('product_images', 'uniq_product_images_one_primary');
        await queryInterface.removeIndex('product_images', 'idx_product_images_variant');
        await queryInterface.removeColumn('product_images', 'variant_id');
    },
};
