'use strict';

module.exports = {
    up: (queryInterface, Sequelize) => queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.addColumn('order_refunds', 'next_reconcile_at', { type: Sequelize.DATE }, { transaction });
        await queryInterface.addIndex('order_refunds', ['next_reconcile_at', 'created_at', 'id'], {
            name: 'order_refunds_reconciliation_due_idx',
            where: { status: { [Sequelize.Op.in]: ['refund_initiated', 'refund_processing'] } },
            transaction,
        });
    }),
    down: (queryInterface) => queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.removeIndex('order_refunds', 'order_refunds_reconciliation_due_idx', { transaction });
        await queryInterface.removeColumn('order_refunds', 'next_reconcile_at', { transaction });
    }),
};
