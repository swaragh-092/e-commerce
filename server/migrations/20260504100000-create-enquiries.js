'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('enquiries', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
      status: {
        type: Sequelize.ENUM('pending', 'responded', 'closed'),
        allowNull: false,
        defaultValue: 'pending',
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      variant_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'product_variants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      cart_items: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Indexes for efficient filtering
    await queryInterface.addIndex('enquiries', ['status']);
    await queryInterface.addIndex('enquiries', ['email']);
    await queryInterface.addIndex('enquiries', ['product_id']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('enquiries');
    // ENUM type needs to be dropped manually in postgres
    try {
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_enquiries_status";');
    } catch(e) {
        console.error('Failed to drop enum_enquiries_status during migration rollback:', e);
    }
  }
};
