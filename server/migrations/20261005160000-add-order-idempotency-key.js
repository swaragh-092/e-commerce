'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addColumn('orders', 'idempotency_key', {
                type: Sequelize.STRING(255),
                allowNull: true,
            }, { transaction });
            // Initial account-scoped uniqueness; the follow-up hardening
            // migration adds UUID constraints and the guest-session index.
            await queryInterface.sequelize.query(`
                CREATE UNIQUE INDEX orders_user_id_idempotency_key_unique
                ON orders (user_id, idempotency_key)
                WHERE user_id IS NOT NULL AND idempotency_key IS NOT NULL
            `, { transaction });
        });
    },
    down: async (queryInterface) => {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query('DROP INDEX IF EXISTS orders_user_id_idempotency_key_unique', { transaction });
            await queryInterface.removeColumn('orders', 'idempotency_key', { transaction });
        });
    },
};
