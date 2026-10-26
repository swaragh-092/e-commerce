'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.addColumn('orders', 'guest_session_id', {
                type: Sequelize.STRING(255),
                allowNull: true,
            }, { transaction });
            await queryInterface.sequelize.query(`
                UPDATE orders
                SET guest_session_id = COALESCE(
                    NULLIF(shipping_address_snapshot->>'sessionId', ''),
                    (SELECT session_id FROM shipping_quotes WHERE id = orders.shipping_quote_id)
                )
                WHERE user_id IS NULL
            `, { transaction });
        });
    },
    down: async (queryInterface) => {
        await queryInterface.removeColumn('orders', 'guest_session_id');
    },
};
