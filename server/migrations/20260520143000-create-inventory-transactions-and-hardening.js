'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventory_transactions', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'RESTRICT',
      },
      variant_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'product_variants', key: 'id' },
        onDelete: 'SET NULL',
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'orders', key: 'id' },
        onDelete: 'SET NULL',
      },
      order_item_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'order_items', key: 'id' },
        onDelete: 'SET NULL',
      },
      type: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      qty: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      before_stock: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      after_stock: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      before_reserved: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      after_reserved: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: {},
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions
      ADD CONSTRAINT chk_inventory_txn_type
      CHECK (type IN ('RESERVE', 'RELEASE', 'SHIP', 'RETURN', 'ADJUSTMENT'))
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions
      ADD CONSTRAINT chk_inventory_txn_qty_positive
      CHECK (qty > 0)
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions
      ADD CONSTRAINT chk_inventory_txn_stock_non_negative
      CHECK (
        (before_stock IS NULL OR before_stock >= 0)
        AND (after_stock IS NULL OR after_stock >= 0)
      )
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE inventory_transactions
      ADD CONSTRAINT chk_inventory_txn_reserved_non_negative
      CHECK (
        (before_reserved IS NULL OR before_reserved >= 0)
        AND (after_reserved IS NULL OR after_reserved >= 0)
      )
    `);

    await queryInterface.addIndex('inventory_transactions', ['created_at'], {
      name: 'idx_inventory_txn_created_at',
    });
    await queryInterface.addIndex('inventory_transactions', ['product_id'], {
      name: 'idx_inventory_txn_product',
    });
    await queryInterface.addIndex('inventory_transactions', ['variant_id'], {
      name: 'idx_inventory_txn_variant',
    });
    await queryInterface.addIndex('inventory_transactions', ['order_id'], {
      name: 'idx_inventory_txn_order',
    });
    await queryInterface.addIndex('inventory_transactions', ['type'], {
      name: 'idx_inventory_txn_type',
    });

    await queryInterface.addColumn('orders', 'inventory_released_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addIndex('orders', ['inventory_released_at'], {
      name: 'idx_orders_inventory_released_at',
    });

    await queryInterface.sequelize.query(`
      UPDATE product_variants
      SET reserved_qty = GREATEST(LEAST(COALESCE(reserved_qty, 0), COALESCE(stock_qty, 0)), 0)
      WHERE reserved_qty IS NULL
         OR reserved_qty < 0
         OR reserved_qty > COALESCE(stock_qty, 0)
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE product_variants
      DROP CONSTRAINT IF EXISTS chk_reserved_qty_lte_stock_qty
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE product_variants
      ADD CONSTRAINT chk_reserved_qty_lte_stock_qty
      CHECK (reserved_qty <= stock_qty)
    `);

    await queryInterface.addIndex('product_variants', ['product_id', 'is_active', 'deleted_at'], {
      name: 'idx_variants_product_active_deleted',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('product_variants', 'idx_variants_product_active_deleted');
    await queryInterface.sequelize.query(`
      ALTER TABLE product_variants
      DROP CONSTRAINT IF EXISTS chk_reserved_qty_lte_stock_qty
    `);

    await queryInterface.removeIndex('orders', 'idx_orders_inventory_released_at');
    await queryInterface.removeColumn('orders', 'inventory_released_at');

    await queryInterface.removeIndex('inventory_transactions', 'idx_inventory_txn_type');
    await queryInterface.removeIndex('inventory_transactions', 'idx_inventory_txn_order');
    await queryInterface.removeIndex('inventory_transactions', 'idx_inventory_txn_variant');
    await queryInterface.removeIndex('inventory_transactions', 'idx_inventory_txn_product');
    await queryInterface.removeIndex('inventory_transactions', 'idx_inventory_txn_created_at');
    await queryInterface.dropTable('inventory_transactions');
  },
};

