'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_related', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      related_product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    });
    await queryInterface.addIndex('product_related', ['product_id', 'related_product_id'], {
      unique: true,
      name: 'uniq_product_related_pair',
    });
    await queryInterface.addIndex('product_related', ['product_id', 'sort_order'], {
      name: 'idx_product_related_order',
    });
    await queryInterface.addIndex('product_related', ['related_product_id'], {
      name: 'idx_product_related_target',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('product_related');
  },
};
