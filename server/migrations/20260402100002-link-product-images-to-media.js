'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('product_images', 'media_id', {
            type: Sequelize.UUID,
            references: { model: 'media', key: 'id' },
            onDelete: 'SET NULL',
        });

        await queryInterface.addIndex('product_images', ['media_id'], { name: 'idx_product_images_media' });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('product_images', 'media_id');
    },
};
