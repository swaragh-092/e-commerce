'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('order_history', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.literal('gen_random_uuid()'),
                primaryKey: true,
            },
            order_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: {
                    model: 'orders',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            event_type: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            actor_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: {
                    model: 'users',
                    key: 'id',
                },
                onDelete: 'SET NULL',
            },
            actor_type: {
                type: Sequelize.STRING(50),
                allowNull: false,
                defaultValue: 'system',
            },
            metadata: {
                type: Sequelize.JSONB,
                defaultValue: {},
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.literal('NOW()'),
            },
        });

        await queryInterface.addIndex('order_history', ['order_id']);
        await queryInterface.addIndex('order_history', ['order_id', 'created_at'], { name: 'idx_order_history_order_created' });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('order_history');
    }
};
