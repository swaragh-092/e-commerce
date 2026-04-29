'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add webhook_secret to shipping_providers
        await queryInterface.addColumn('shipping_providers', 'webhook_secret', {
            type: Sequelize.STRING(255),
            allowNull: true,
        });

        // Add unique index to idempotency_key in shipping_quotes
        // First remove existing non-unique index if it exists
        try {
            await queryInterface.removeIndex('shipping_quotes', 'idx_shipping_quotes_idempotency');
        } catch (e) {
            // Only ignore if the index does not exist.
            // Postgres error code for undefined_object is 42704, and MySQL/others might have different messages.
            if (e.name === 'SequelizeDatabaseError' && (e.message.includes('does not exist') || e.original?.code === '42704')) {
                // Safe to ignore
            } else {
                throw e;
            }
        }

        await queryInterface.addIndex('shipping_quotes', ['idempotency_key'], {
            name: 'idx_shipping_quotes_idempotency_unique',
            unique: true,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeIndex('shipping_quotes', 'idx_shipping_quotes_idempotency_unique');
        await queryInterface.addIndex('shipping_quotes', ['idempotency_key'], {
            name: 'idx_shipping_quotes_idempotency',
        });
        await queryInterface.removeColumn('shipping_providers', 'webhook_secret');
    },
};
