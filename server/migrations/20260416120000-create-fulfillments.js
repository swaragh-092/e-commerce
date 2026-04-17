'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create fulfillments table
    await queryInterface.createTable('fulfillments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      tracking_number: {
        type: Sequelize.STRING(255),
      },
      courier: {
        type: Sequelize.STRING(100),
      },
      notes: {
        type: Sequelize.TEXT,
      },
      status: {
        type: Sequelize.STRING(50),
        defaultValue: 'shipped',
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // 2. Create fulfillment_items table
    await queryInterface.createTable('fulfillment_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      fulfillment_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'fulfillments',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      order_item_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'order_items',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Indexes
    await queryInterface.addIndex('fulfillments', ['order_id']);
    await queryInterface.addIndex('fulfillment_items', ['fulfillment_id']);
    await queryInterface.addIndex('fulfillment_items', ['order_item_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('fulfillment_items');
    await queryInterface.dropTable('fulfillments');
  }
};
