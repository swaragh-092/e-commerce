'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('reviews', 'order_id', {
            type: Sequelize.UUID,
            references: { model: 'orders', key: 'id' },
            onDelete: 'SET NULL',
        });

        await queryInterface.addIndex('reviews', ['order_id'], { name: 'idx_reviews_order' });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('reviews', 'order_id');
    },
};
