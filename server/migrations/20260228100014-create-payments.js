'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('payments', {
            id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
            order_id: { type: Sequelize.UUID, unique: true, references: { model: 'orders', key: 'id' } },
            provider: { type: Sequelize.STRING(50), allowNull: false },
            transaction_id: { type: Sequelize.STRING(255) },
            amount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
            currency: { type: Sequelize.STRING(10), defaultValue: 'usd' },
            status: { type: Sequelize.STRING(20), defaultValue: 'pending' },
            metadata: { type: Sequelize.JSONB },
            created_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
            updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });

        await queryInterface.sequelize.query('ALTER TABLE payments ADD CONSTRAINT chk_payment_amount CHECK (amount > 0)');

        await queryInterface.createTable('webhook_events', {
            id: { type: Sequelize.STRING(255), primaryKey: true },
            event_type: { type: Sequelize.STRING(100), allowNull: false },
            processed_at: { type: Sequelize.DATE, defaultValue: Sequelize.literal('NOW()') },
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('webhook_events');
        await queryInterface.dropTable('payments');
    },
};
