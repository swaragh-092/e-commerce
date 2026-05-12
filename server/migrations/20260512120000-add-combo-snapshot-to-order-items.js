'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Flag: this order item represents a combo/bundle product
        await queryInterface.addColumn('order_items', 'is_combo', {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        });

        // Immutable snapshot of constituent child products captured at order-placement time.
        // Never updated after creation — the source of truth for historical invoicing.
        // Shape: Array<{ productId, variantId, quantity, snapshotName, snapshotSku, snapshotPrice, snapshotImage }>
        await queryInterface.addColumn('order_items', 'combo_snapshot', {
            type: Sequelize.JSONB,
            allowNull: true,
            defaultValue: null,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('order_items', 'is_combo');
        await queryInterface.removeColumn('order_items', 'combo_snapshot');
    },
};
