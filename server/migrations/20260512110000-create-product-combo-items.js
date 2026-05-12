'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('product_combo_items', {
            id: {
                type: Sequelize.UUID,
                defaultValue: Sequelize.UUIDV4,
                primaryKey: true,
                allowNull: false,
            },
            combo_product_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'products', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE',
            },
            item_product_id: {
                type: Sequelize.UUID,
                allowNull: false,
                references: { model: 'products', key: 'id' },
                onUpdate: 'CASCADE',
                // RESTRICT: prevent deleting a product that is inside a combo
                onDelete: 'RESTRICT',
            },
            variant_id: {
                type: Sequelize.UUID,
                allowNull: true,
                references: { model: 'product_variants', key: 'id' },
                onUpdate: 'CASCADE',
                onDelete: 'RESTRICT',
            },
            quantity: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },
            sort_order: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        // Ensure quantity > 0
        await queryInterface.sequelize.query(
            'ALTER TABLE product_combo_items ADD CONSTRAINT chk_pci_quantity_positive CHECK (quantity > 0)'
        );

        // Composite Unique Indexes: Each item/variant appears only once per combo.
        // We use two partial indexes to handle the nullable variant_id correctly for deduplication.
        await queryInterface.addIndex('product_combo_items', ['combo_product_id', 'item_product_id'], {
            unique: true,
            where: { variant_id: null },
            name: 'uniq_pci_combo_item_no_variant'
        });

        await queryInterface.addIndex('product_combo_items', ['combo_product_id', 'item_product_id', 'variant_id'], {
            unique: true,
            where: { variant_id: { [Sequelize.Op.ne]: null } },
            name: 'uniq_pci_combo_item_with_variant'
        });

        // Fast combo constituent lookups
        await queryInterface.addIndex('product_combo_items', ['combo_product_id', 'sort_order'], {
            name: 'idx_pci_combo_id_sort',
        });
        await queryInterface.addIndex('product_combo_items', ['item_product_id'], {
            name: 'idx_pci_item_id',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('product_combo_items');
    },
};
