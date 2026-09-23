'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('shipments', 'provider_request_id', {
            type: Sequelize.STRING(255),
            allowNull: true,
        });
        await queryInterface.addColumn('shipments', 'provider_state', {
            type: Sequelize.STRING(50),
            allowNull: false,
            defaultValue: 'pending',
        });
        await queryInterface.addColumn('shipments', 'last_provider_error', {
            type: Sequelize.TEXT,
            allowNull: true,
        });

        await queryInterface.createTable('shipping_operations', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            shipment_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'shipments', key: 'id' },
                onDelete: 'CASCADE',
            },
            provider_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'shipping_providers', key: 'id' },
                onDelete: 'SET NULL',
            },
            operation_type: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'create' },
            idempotency_key: { type: Sequelize.STRING(255), allowNull: false, unique: true },
            status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'queued' },
            attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
            max_attempts: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 8 },
            next_attempt_at: { type: Sequelize.DATE },
            locked_at: { type: Sequelize.DATE },
            completed_at: { type: Sequelize.DATE },
            last_error: { type: Sequelize.TEXT },
            request_payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
            response_payload: { type: Sequelize.JSONB },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.addIndex('shipping_operations', ['status', 'next_attempt_at'], {
            name: 'idx_shipping_operations_ready',
        });
        await queryInterface.addIndex('shipments', ['provider_id', 'provider_request_id'], {
            name: 'idx_shipments_provider_request',
            unique: true,
            where: { provider_request_id: { [Sequelize.Op.ne]: null } },
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('shipments', 'idx_shipments_provider_request');
        await queryInterface.removeIndex('shipping_operations', 'idx_shipping_operations_ready');
        await queryInterface.dropTable('shipping_operations');
        await queryInterface.removeColumn('shipments', 'last_provider_error');
        await queryInterface.removeColumn('shipments', 'provider_state');
        await queryInterface.removeColumn('shipments', 'provider_request_id');
    },
};
