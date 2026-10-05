'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Addresses table: Allow guest address creation (userId nullable) and add session_id
    await queryInterface.changeColumn('addresses', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addColumn('addresses', 'session_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addIndex('addresses', ['session_id'], {
      name: 'idx_addresses_session_id',
    });

    // 2. Shipping quotes table: Allow guest quote creation (userId nullable) and add session_id
    await queryInterface.changeColumn('shipping_quotes', 'user_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addColumn('shipping_quotes', 'session_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addIndex('shipping_quotes', ['session_id'], {
      name: 'idx_shipping_quotes_session_id',
    });
    await queryInterface.addIndex('shipping_quotes', ['session_id', 'idempotency_key'], {
      name: 'idx_shipping_quotes_session_idempotency',
    });

    // 3. Product variants table: Add physical measurement overrides
    await queryInterface.addColumn('product_variants', 'weight_grams', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('product_variants', 'length_cm', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('product_variants', 'breadth_cm', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn('product_variants', 'height_cm', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('product_variants', 'height_cm');
    await queryInterface.removeColumn('product_variants', 'breadth_cm');
    await queryInterface.removeColumn('product_variants', 'length_cm');
    await queryInterface.removeColumn('product_variants', 'weight_grams');

    await queryInterface.removeIndex('shipping_quotes', 'idx_shipping_quotes_session_idempotency');
    await queryInterface.removeIndex('shipping_quotes', 'idx_shipping_quotes_session_id');
    await queryInterface.removeColumn('shipping_quotes', 'session_id');
    await queryInterface.changeColumn('shipping_quotes', 'user_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });

    await queryInterface.removeIndex('addresses', 'idx_addresses_session_id');
    await queryInterface.removeColumn('addresses', 'session_id');
    await queryInterface.changeColumn('addresses', 'user_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
  },
};
