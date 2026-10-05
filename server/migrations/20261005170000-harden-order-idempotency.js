'use strict';

const UUID_PATTERN = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.sequelize.transaction(async (transaction) => {
            const [invalidKeys] = await queryInterface.sequelize.query(`
                SELECT id FROM orders
                WHERE idempotency_key IS NOT NULL
                  AND lower(idempotency_key) !~ '${UUID_PATTERN}'
                LIMIT 1
            `, { transaction });
            if (invalidKeys.length) {
                throw new Error(`Cannot enforce UUID idempotency keys: order ${invalidKeys[0].id} has a non-UUID key. Resolve the row before retrying this migration.`);
            }

            await queryInterface.addColumn('orders', 'idempotency_payload_hash', {
                type: Sequelize.STRING(64),
                allowNull: true,
            }, { transaction });
            await queryInterface.changeColumn('orders', 'idempotency_key', {
                type: Sequelize.STRING(36),
                allowNull: true,
            }, { transaction });
            await queryInterface.sequelize.query(`
                ALTER TABLE orders
                ADD CONSTRAINT orders_idempotency_key_uuid_check
                CHECK (idempotency_key IS NULL OR lower(idempotency_key) ~ '${UUID_PATTERN}')
            `, { transaction });
            await queryInterface.sequelize.query(`
                ALTER TABLE orders
                ADD CONSTRAINT orders_idempotency_payload_hash_check
                CHECK (idempotency_payload_hash IS NULL OR idempotency_payload_hash ~ '^[0-9a-f]{64}$')
            `, { transaction });
            await queryInterface.sequelize.query(`
                CREATE UNIQUE INDEX orders_guest_session_id_idempotency_key_unique
                ON orders (guest_session_id, idempotency_key)
                WHERE user_id IS NULL AND guest_session_id IS NOT NULL AND idempotency_key IS NOT NULL
            `, { transaction });
        });
    },
    down: async (queryInterface, Sequelize) => {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.sequelize.query('DROP INDEX IF EXISTS orders_guest_session_id_idempotency_key_unique', { transaction });
            await queryInterface.sequelize.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_idempotency_payload_hash_check', { transaction });
            await queryInterface.sequelize.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_idempotency_key_uuid_check', { transaction });
            await queryInterface.changeColumn('orders', 'idempotency_key', {
                type: Sequelize.STRING(255),
                allowNull: true,
            }, { transaction });
            await queryInterface.removeColumn('orders', 'idempotency_payload_hash', { transaction });
        });
    },
};
