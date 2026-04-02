'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('notification_logs', 'user_id', {
            type: Sequelize.UUID,
            references: { model: 'users', key: 'id' },
            onDelete: 'SET NULL',
        });

        await queryInterface.addColumn('notification_logs', 'order_id', {
            type: Sequelize.UUID,
            references: { model: 'orders', key: 'id' },
            onDelete: 'SET NULL',
        });

        await queryInterface.addIndex('notification_logs', ['user_id'], { name: 'idx_notification_logs_user' });
        await queryInterface.addIndex('notification_logs', ['order_id'], { name: 'idx_notification_logs_order' });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('notification_logs', 'user_id');
        await queryInterface.removeColumn('notification_logs', 'order_id');
    },
};
